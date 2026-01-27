import express from 'express';
import { supabase as db } from '../db.js';

const router = express.Router();
const DOMAIN = 'https://atlas.com'; // In production, this would be env var

/**
 * GET /robots.txt
 * Dynamic robots.txt
 */
router.get('/robots.txt', (req, res) => {
    const robots = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /api

Sitemap: ${DOMAIN}/sitemap.xml
`;
    res.type('text/plain').send(robots);
});

/**
 * GET /sitemap.xml
 * Dynamic sitemap generation
 */
router.get('/sitemap.xml', async (req, res) => {
    try {
        // Fetch all public content
        const { data: articles, error } = await db
            .from('content')
            .select('id, updated_at, created_at')
            .eq('status', 'published')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Fetch all categories (hardcoded for now as they are static in frontend)
        const categories = ['money', 'business'];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Static Pages -->
    <url>
        <loc>${DOMAIN}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${DOMAIN}/search</loc>
        <changefreq>weekly</changefreq>
        <priority>0.5</priority>
    </url>
    
    <!-- Categories -->
    ${categories.map(cat => `
    <url>
        <loc>${DOMAIN}/${cat}</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
    `).join('')}

    <!-- Articles -->
    ${articles.map(article => `
    <url>
        <loc>${DOMAIN}/read/${article.id}</loc>
        <lastmod>${new Date(article.updated_at || article.created_at).toISOString()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    `).join('')}
</urlset>`;

        res.type('application/xml').send(xml);
    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('Error generating sitemap');
    }
});

export default router;
