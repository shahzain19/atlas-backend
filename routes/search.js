import express from 'express';
import { supabase as db, db_helpers } from '../db.js';

const router = express.Router();

/**
 * GET /api/search
 * Advanced search with filters
 */
router.get('/', async (req, res) => {
    try {
        const { q, limit = 50 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Search content using PostgreSQL Full-Text Search
        const results = await db_helpers.searchContent(q);

        // Apply limit
        const limitedResults = results.slice(0, parseInt(limit));

        res.json({
            query: q,
            count: limitedResults.length,
            results: limitedResults
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions based on partial query
 */
router.get('/suggestions', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        const { data: suggestions, error } = await db
            .from('content')
            .select('title, id, category')
            .ilike('title', `%${q}%`)
            .eq('status', 'published')
            .order('view_count', { ascending: false })
            .limit(10);

        if (error) throw error;

        res.json(suggestions);
    } catch (error) {
        console.error('Suggestions error:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

export default router;
