import express from 'express';
import { supabase as db, db_helpers } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/tags
 * Get all tags with usage count
 */
router.get('/', async (req, res) => {
    try {
        const tags = await db_helpers.getTagsWithCount();
        res.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});

/**
 * GET /api/tags/:slug/content
 * Get all content with a specific tag
 */
router.get('/:slug/content', async (req, res) => {
    try {
        const { slug } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const { data, error } = await db
            .from('content')
            .select(`
                *,
                profiles(username),
                tags!inner(slug)
            `)
            .eq('tags.slug', slug)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;

        res.json(data.map(item => ({
            ...item,
            author_name: item.profiles?.username
        })));
    } catch (error) {
        console.error('Error fetching content by tag:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

/**
 * POST /api/tags
 * Create a new tag (admin only)
 */
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { name, description, category = 'topic' } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        const slug = name.toLowerCase().replace(/\s+/g, '-');
        const tag = await db_helpers.getOrCreateTag(name, slug, category);

        // Update description if provided
        if (description && !tag.description) {
            const { error: updateError } = await db
                .from('tags')
                .update({ description })
                .eq('id', tag.id);

            if (updateError) throw updateError;
            tag.description = description;
        }

        res.status(201).json(tag);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({ error: 'Failed to create tag' });
    }
});

/**
 * GET /api/tags/autocomplete
 * Autocomplete tag search
 */
router.get('/autocomplete', async (req, res) => {
    try {
        const { q = '' } = req.query;

        if (q.length < 2) {
            return res.json([]);
        }

        const { data: tags, error } = await db
            .from('tags')
            .select('*')
            .ilike('name', `%${q}%`)
            .order('name', { ascending: true })
            .limit(10);

        if (error) throw error;

        res.json(tags);
    } catch (error) {
        console.error('Error in tag autocomplete:', error);
        res.status(500).json({ error: 'Autocomplete failed' });
    }
});

export default router;
