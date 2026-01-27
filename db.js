import { supabase } from './supabase.js';
export { supabase };

// Helper functions for common database operations
export const db_helpers = {
  // Get user by email or username
  getUserByEmailOrUsername: async (identifier) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
    return data;
  },

  // Get user by ID
  getUserById: async (id) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email, role, created_at')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Get total user count
  getUserCount: async () => {
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    return { count };
  },

  // Create new user (used for manual creation/testing)
  createUser: async (username, email, passwordHash, role = 'viewer') => {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{ username, email, password_hash: passwordHash, role }])
      .select()
      .single();

    if (error) throw error;
    return { lastInsertRowid: data.id };
  },

  // Get content with author and tags
  getContentWithDetails: async (id) => {
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select(`
        *,
        author:profiles(username, id)
      `)
      .eq('id', id)
      .single();

    if (contentError) {
      if (contentError.code === 'PGRST116') return null;
      throw contentError;
    }

    // Get tags
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('*, content_tags!inner(content_id)')
      .eq('content_tags.content_id', id);

    if (tagsError) throw tagsError;

    // Get sources
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .eq('content_id', id);

    if (sourcesError) throw sourcesError;

    return {
      ...content,
      author_name: content.author?.username,
      author_id: content.author?.id,
      tags,
      sources
    };
  },

  // Increment view count
  incrementViewCount: async (id) => {
    const { data, error } = await supabase.rpc('increment_view_count', { row_id: id });
    // Note: Need to add this RPC function to schema.sql or use a manual update
    if (error) {
      // Fallback to manual update if RPC doesn't exist
      await supabase
        .from('content')
        .update({ view_count: supabase.sql`view_count + 1` }) // Note: Supabase JS client doesn't support .sql directly easily
        .eq('id', id);
    }
  },

  // Search content using PostgreSQL Full-Text Search
  searchContent: async (query) => {
    const { data, error } = await supabase
      .from('content')
      .select(`
        *,
        profiles(username)
      `)
      .textSearch('search_vector', query)
      .order('id', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data.map(item => ({
      ...item,
      author_name: item.profiles?.username
    }));
  },

  // Get or create tag
  getOrCreateTag: async (name, slug, category = 'topic') => {
    let { data: tag, error } = await supabase
      .from('tags')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: newTag, error: insertError } = await supabase
        .from('tags')
        .insert([{ name, slug, category }])
        .select()
        .single();

      if (insertError) throw insertError;
      tag = newTag;
    } else if (error) {
      throw error;
    }
    return tag;
  },

  // Attach tag to content
  attachTag: async (contentId, tagId) => {
    const { error } = await supabase
      .from('content_tags')
      .upsert([{ content_id: contentId, tag_id: tagId }], { onConflict: 'content_id,tag_id' });

    if (error) throw error;
  },

  // Get all tags with usage count
  getTagsWithCount: async () => {
    // This requires a more complex query or a view in Supabase
    const { data, error } = await supabase
      .from('tags')
      .select('*, content_tags(count)');

    if (error) throw error;
    return data.map(tag => ({
      ...tag,
      usage_count: tag.content_tags[0]?.count || 0
    })).sort((a, b) => b.usage_count - a.usage_count);
  },

  // API Key operations
  createApiKey: async (userId, name, keyHash) => {
    const { data, error } = await supabase
      .from('api_keys')
      .insert([{ user_id: userId, name, key_hash: keyHash }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getApiKeysByUser: async (userId) => {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, last_used_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  deleteApiKey: async (id, userId) => {
    const { error, count } = await supabase
      .from('api_keys')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return { changes: count };
  },

  getApiKeyByHash: async (keyHash) => {
    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        *,
        profiles(username, email, role)
      `)
      .eq('key_hash', keyHash)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      ...data,
      username: data.profiles?.username,
      email: data.profiles?.email,
      role: data.profiles?.role
    };
  },

  updateApiKeyLastUsed: async (id) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }
};

export default supabase;
