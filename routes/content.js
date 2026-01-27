import express from 'express';
import { supabase as db, db_helpers } from '../db.js';
import { authenticateToken, requireRole, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/content
 * Get all content (optionally filter by category, status, or author)
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { category, status = 'published', author_id, featured } = req.query;

        let query = db
            .from('content')
            .select(`
                *,
                author:profiles(username)
            `)
            .eq('status', status);

        if (category) {
            query = query.eq('category', category);
        }

        if (author_id) {
            query = query.eq('author_id', author_id);
        }

        if (featured === 'true') {
            query = query.eq('featured', true);
        }

        const { data: items, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        // Map author.username to author_name for compatibility
        const formattedItems = items.map(item => ({
            ...item,
            author_name: item.author?.username
        }));

        res.json(formattedItems);
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

/**
 * GET /api/content/:id
 * Get single content node with full details (tags, sources, author)
 */
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const content = await db_helpers.getContentWithDetails(req.params.id);

        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Only allow viewing drafts if user is author or admin
        if (content.status === 'draft') {
            if (!req.user || (req.user.id !== content.author_id && req.user.role !== 'admin')) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // Increment view count
        await db_helpers.incrementViewCount(req.params.id);

        res.json(content);
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

/**
 * POST /api/content
 * Create new content node (requires authentication)
 */
router.post('/', authenticateToken, requireRole('admin', 'contributor'), async (req, res) => {
    try {
        const { title, body, category, status = 'published', tags = [], sources = [] } = req.body;

        if (!title || !body || !category) {
            return res.status(400).json({ error: 'Title, body, and category are required' });
        }

        // Create content
        const { data: content, error: contentError } = await db
            .from('content')
            .insert([{ title, body, category, author_id: req.user.id, status }])
            .select()
            .single();

        if (contentError) throw contentError;
        const contentId = content.id;

        // Add tags
        if (tags.length > 0) {
            for (const tagName of tags) {
                const slug = tagName.toLowerCase().replace(/\s+/g, '-');
                const tag = await db_helpers.getOrCreateTag(tagName, slug);
                await db_helpers.attachTag(contentId, tag.id);
            }
        }

        // Add sources
        if (sources.length > 0) {
            const formattedSources = sources.map(source => ({
                content_id: contentId,
                title: source.title,
                url: source.url || null,
                type: source.type || 'article',
                author: source.author || null,
                published_date: source.published_date || null
            }));

            const { error: sourceError } = await db.from('sources').insert(formattedSources);
            if (sourceError) throw sourceError;
        }

        res.status(201).json({
            message: 'Content created successfully',
            id: contentId,
            title,
            category
        });
    } catch (error) {
        console.error('Error creating content:', error);
        res.status(500).json({ error: 'Failed to create content' });
    }
});

/**
 * PUT /api/content/:id
 * Update existing content (requires authentication and ownership/admin)
 */
router.put('/:id', authenticateToken, requireRole('admin', 'contributor'), async (req, res) => {
    try {
        const { title, body, category, status, featured } = req.body;
        const contentId = req.params.id;

        // Check if content exists and user has permission
        const { data: existing, error: findError } = await db
            .from('content')
            .select('*')
            .eq('id', contentId)
            .single();

        if (findError || !existing) {
            return res.status(404).json({ error: 'Content not found' });
        }

        if (req.user.role !== 'admin' && existing.author_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own content' });
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (body !== undefined) updates.body = body;
        if (category !== undefined) updates.category = category;
        if (status !== undefined) updates.status = status;
        if (featured !== undefined && req.user.role === 'admin') updates.featured = featured;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const { error: updateError } = await db
            .from('content')
            .update(updates)
            .eq('id', contentId);

        if (updateError) throw updateError;

        res.json({ message: 'Content updated successfully' });
    } catch (error) {
        console.error('Error updating content:', error);
        res.status(500).json({ error: 'Failed to update content' });
    }
});

/**
 * DELETE /api/content/:id
 * Delete content (admin only or owner)
 */
router.delete('/:id', authenticateToken, requireRole('admin', 'contributor'), async (req, res) => {
    try {
        const contentId = req.params.id;
        const { data: existing, error: findError } = await db
            .from('content')
            .select('*')
            .eq('id', contentId)
            .single();

        if (findError || !existing) {
            return res.status(404).json({ error: 'Content not found' });
        }

        if (req.user.role !== 'admin' && existing.author_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own content' });
        }

        const { error: deleteError } = await db.from('content').delete().eq('id', contentId);
        if (deleteError) throw deleteError;

        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        console.error('Error deleting content:', error);
        res.status(500).json({ error: 'Failed to delete content' });
    }
});

/**
 * POST /api/content/:id/tags
 * Add tags to content
 */
router.post('/:id/tags', authenticateToken, requireRole('admin', 'contributor'), async (req, res) => {
    try {
        const { tags } = req.body;
        const contentId = req.params.id;

        if (!Array.isArray(tags) || tags.length === 0) {
            return res.status(400).json({ error: 'Tags array is required' });
        }

        for (const tagName of tags) {
            const slug = tagName.toLowerCase().replace(/\s+/g, '-');
            const tag = await db_helpers.getOrCreateTag(tagName, slug);
            await db_helpers.attachTag(contentId, tag.id);
        }

        res.json({ message: 'Tags added successfully' });
    } catch (error) {
        console.error('Error adding tags:', error);
        res.status(500).json({ error: 'Failed to add tags' });
    }
});

/**
 * Seed data route (dev only)
 */
router.post('/seed', async (req, res) => {
    try {
        const seedData = [
            {
                title: 'The Fiat Illusion',
                body: 'Money is not wealth. Money is a claim on wealth. When currency is printed without production, the claim is diluted.',
                category: 'money',
                status: 'published'
            },
            {
                title: 'Leverage Explained',
                body: 'Leverage is the ratio of output to input. Code and Media are the new forms of leverage because the marginal cost of replication is zero.',
                category: 'business',
                status: 'published'
            },
            {
                title: 'Strategic Foresight',
                body: 'Intelligence is not about predicting the future, but about being prepared for multiple futures. Signal detection is the first step.',
                category: 'intelligence',
                status: 'published'
            },
            {
                title: 'Base Protocols',
                body: 'In the digital age, those who control the protocols control the flow of information. Decentralization is the only hedge.',
                category: 'technology',
                status: 'published'
            },
            {
                title: 'Biological Agency',
                body: 'Your body is the ultimate piece of hardware. Optimization starts with metabolic health and sleep architecture.',
                category: 'health',
                status: 'published'
            },
            {
                title: 'Meme Warfare',
                body: 'Ideas are viruses. Competing narratives are fighting for limited attention span. Conscious consumption is required.',
                category: 'culture',
                status: 'published'
            },
            {
                title: 'Systemic Governance',
                body: 'Power is not given, it is taken. Understanding the architecture of governance is essential for sovereignty.',
                category: 'politics',
                status: 'published'
            },
            {
                title: 'Supply Chain Fragility',
                body: 'Complexity is a feature, not a bug, until it collapses. Redundancy is the only insurance in a globalized world.',
                category: 'logistics',
                status: 'published'
            },
            {
                title: 'Digital Perimeter',
                body: 'Encryption is the ultimate leverage for the individual. Protecting your digital footprint is the first step toward sovereignty.',
                category: 'security',
                status: 'published'
            },
            {
                title: 'Thermodynamic Reality',
                body: 'Energy is the master resource. Civilization is a function of our ability to capture and utilize energy efficiently.',
                category: 'energy',
                status: 'published'
            },
            {
                title: 'First Principles',
                body: 'Reasoning from first principles allows you to solve complex problems by breaking them down into fundamental truths.',
                category: 'science',
                status: 'published'
            },
            {
                title: 'Recurring Cycles',
                body: 'History does not repeat, but it rhymes. Identifying the cycles of expansion and contraction is key to long-term survival.',
                category: 'history',
                status: 'published'
            }
        ];

        const { error } = await db.from('content').insert(seedData);
        if (error) throw error;

        res.json({ message: 'Database seeded successfully' });
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ error: 'Failed to seed database' });
    }
});

export default router;
