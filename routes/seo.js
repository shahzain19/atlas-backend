import express from 'express';
import { supabase as db } from '../db.js';

const router = express.Router();
const DOMAIN = 'https://atlas-frontend-omega.vercel.app';

// All 24 Atlas categories with SEO metadata
const CATEGORIES = [
    { slug: 'money', name: 'Finance & Money', description: 'Understanding the flow of value and the mechanics of debt', priority: 0.9 },
    { slug: 'business', name: 'Business & Strategy', description: 'Building scalable operations and understanding incentives', priority: 0.9 },
    { slug: 'intelligence', name: 'Intelligence Analysis', description: 'Gathering and analyzing data to build actionable intelligence', priority: 0.8 },
    { slug: 'technology', name: 'Technology Research', description: 'AI, automation, software engineering, and digital systems', priority: 0.95 },
    { slug: 'health', name: 'Health & Biology', description: 'Optimizing the human hardware for longevity and performance', priority: 0.8 },
    { slug: 'politics', name: 'Politics & Governance', description: 'Analyzing the structures of power, laws, and systemic control', priority: 0.8 },
    { slug: 'logistics', name: 'Logistics & Supply Chain', description: 'Understanding supply chains, energy, and mechanics of movement', priority: 0.7 },
    { slug: 'security', name: 'Security & Defense', description: 'Physical security, cybersecurity, and digital encryption', priority: 0.8 },
    { slug: 'energy', name: 'Energy & Resources', description: 'Energy production, thermodynamics, and resource sovereignty', priority: 0.8 },
    { slug: 'science', name: 'Science & Research', description: 'Fundamental laws of nature and the scientific method', priority: 0.85 },
    { slug: 'history', name: 'Historical Analysis', description: 'Pattern recognition and recurring systemic cycles', priority: 0.9 },
    { slug: 'philosophy', name: 'Philosophy & Reasoning', description: 'First principles, ethical frameworks, and the search for truth', priority: 0.9 },
    { slug: 'law', name: 'Law & Jurisdiction', description: 'Legal structures, contracts, and jurisdictional resilience', priority: 0.7 },
    { slug: 'psychology', name: 'Psychology & Cognition', description: 'Cognitive science, mental models, and behavioral patterns', priority: 0.95 },
    { slug: 'environment', name: 'Environment & Ecology', description: 'Sustaining the habitat and managing natural assets', priority: 0.7 },
    { slug: 'strategy', name: 'Strategy & Game Theory', description: 'Analyzing incentives, competition, and optimal decision-making', priority: 0.85 },
    { slug: 'economics', name: 'Economics & Finance', description: 'Allocation of scarce resources and economic incentives', priority: 0.95 },
    { slug: 'geopolitics', name: 'Geopolitics & Strategy', description: 'Geography, power dynamics, and international relations', priority: 0.9 },
    { slug: 'engineering', name: 'Engineering & Systems', description: 'Building systems and structures that command the physical world', priority: 0.8 },
    { slug: 'agriculture', name: 'Agriculture & Food', description: 'Food security and biological production systems', priority: 0.7 },
    { slug: 'architecture', name: 'Architecture & Design', description: 'Designing structures and spaces that shape human experience', priority: 0.7 },
    { slug: 'media', name: 'Media & Information', description: 'Information warfare, propaganda analysis, and signal detection', priority: 0.8 },
    { slug: 'education', name: 'Education & Learning', description: 'Knowledge transfer and optimized learning systems', priority: 0.8 },
    { slug: 'culture', name: 'Culture & Narrative', description: 'Stories and signals that shape collective reality', priority: 0.8 }
];

/**
 * GET /robots.txt
 * Enhanced robots.txt with comprehensive crawl directives
 */
router.get('/robots.txt', (req, res) => {
    const robots = `# Atlas Research Platform - Robots.txt
# Last Updated: ${new Date().toISOString().split('T')[0]}

# Welcome all major search engine crawlers
User-agent: Googlebot
Allow: /
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 2

User-agent: Slurp
Allow: /
Crawl-delay: 2

User-agent: DuckDuckBot
Allow: /
Crawl-delay: 2

User-agent: Baiduspider
Allow: /
Crawl-delay: 3

User-agent: YandexBot
Allow: /
Crawl-delay: 3

# Default rules for all other bots
User-agent: *
Allow: /

# Block access to admin and dashboard areas
Disallow: /dashboard
Disallow: /admin
Disallow: /api
Disallow: /login
Disallow: /register

# Allow access to all content categories
Allow: /money
Allow: /business
Allow: /intelligence
Allow: /technology
Allow: /health
Allow: /politics
Allow: /logistics
Allow: /security
Allow: /energy
Allow: /science
Allow: /history
Allow: /philosophy
Allow: /law
Allow: /psychology
Allow: /environment
Allow: /strategy
Allow: /economics
Allow: /geopolitics
Allow: /engineering
Allow: /agriculture
Allow: /architecture
Allow: /media
Allow: /education
Allow: /culture
Allow: /read
Allow: /search

# Sitemaps
Sitemap: ${DOMAIN}/sitemap.xml
Sitemap: ${DOMAIN}/sitemap-categories.xml
Sitemap: ${DOMAIN}/sitemap-articles.xml

# Host
Host: ${DOMAIN}
`;
    res.type('text/plain').send(robots);
});

/**
 * GET /sitemap.xml
 * Combined sitemap (homepage + categories + articles)
 */
router.get('/sitemap.xml', async (req, res) => {
    try {
        const now = new Date().toISOString();

        // Fetch published articles to include
        const { data: articles, error } = await db
            .from('content')
            .select('id, title, category, updated_at, created_at')
            .eq('status', 'published')
            .order('updated_at', { ascending: false })
            .limit(1000);

        if (error) throw error;

        const articleUrls = (articles || []).map(article => {
            const lastmod = new Date(article.updated_at || article.created_at).toISOString();
            return `\n    <url>\n        <loc>${DOMAIN}/read/${article.id}</loc>\n        <lastmod>${lastmod}</lastmod>\n        <changefreq>monthly</changefreq>\n        <priority>0.7</priority>\n    </url>`;
        }).join('');

        const categoryUrls = CATEGORIES.map(cat => `\n    <url>\n        <loc>${DOMAIN}/${cat.slug}</loc>\n        <lastmod>${now}</lastmod>\n        <changefreq>daily</changefreq>\n        <priority>${cat.priority}</priority>\n    </url>`).join('');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n    <!-- Homepage -->\n    <url>\n        <loc>${DOMAIN}/</loc>\n        <lastmod>${now}</lastmod>\n        <changefreq>daily</changefreq>\n        <priority>1.0</priority>\n        <image:image>\n            <image:loc>${DOMAIN}/og-image.png</image:loc>\n            <image:title>Atlas - Deep Research and Analysis Platform</image:title>\n        </image:image>\n    </url>\n    \n    <!-- Search Page -->\n    <url>\n        <loc>${DOMAIN}/search</loc>\n        <lastmod>${now}</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>0.6</priority>\n    </url>\n    <!-- Categories -->${categoryUrls}\n    <!-- Articles -->${articleUrls}\n</urlset>`;

        res.type('application/xml').send(xml);
    } catch (error) {
        console.error('Sitemap error:', error);
        res.status(500).send('Error generating sitemap');
    }
});

/**
 * GET /sitemap-main.xml
 * Static pages sitemap
 */
router.get('/sitemap-main.xml', (req, res) => {
    const now = new Date().toISOString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <!-- Homepage -->
    <url>
        <loc>${DOMAIN}/</loc>
        <lastmod>${now}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
        <image:image>
            <image:loc>${DOMAIN}/og-image.png</image:loc>
            <image:title>Atlas - Deep Research and Analysis Platform</image:title>
        </image:image>
    </url>
    
    <!-- Search Page -->
    <url>
        <loc>${DOMAIN}/search</loc>
        <lastmod>${now}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.6</priority>
    </url>
</urlset>`;

    res.type('application/xml').send(xml);
});

/**
 * GET /sitemap-categories.xml
 * All 24 category pages
 */
router.get('/sitemap-categories.xml', (req, res) => {
    const now = new Date().toISOString();

    const categoryUrls = CATEGORIES.map(cat => `
    <url>
        <loc>${DOMAIN}/${cat.slug}</loc>
        <lastmod>${now}</lastmod>
        <changefreq>daily</changefreq>
        <priority>${cat.priority}</priority>
    </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Atlas Knowledge Categories (24 Sectors) -->${categoryUrls}
</urlset>`;

    res.type('application/xml').send(xml);
});

/**
 * GET /sitemap-articles.xml
 * All published articles
 */
router.get('/sitemap-articles.xml', async (req, res) => {
    try {
        const { data: articles, error } = await db
            .from('content')
            .select('id, title, category, updated_at, created_at')
            .eq('status', 'published')
            .order('updated_at', { ascending: false })
            .limit(1000);

        if (error) throw error;

        const articleUrls = (articles || []).map(article => {
            const lastmod = new Date(article.updated_at || article.created_at).toISOString();
            return `
    <url>
        <loc>${DOMAIN}/read/${article.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>`;
        }).join('');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Atlas Published Articles -->${articleUrls}
</urlset>`;

        res.type('application/xml').send(xml);
    } catch (error) {
        console.error('Articles sitemap error:', error);
        res.status(500).send('Error generating articles sitemap');
    }
});

/**
 * GET /category-metadata
 * API endpoint for category SEO metadata
 */
router.get('/category-metadata', (req, res) => {
    res.json(CATEGORIES);
});

/**
 * GET /category-metadata/:slug
 * Get specific category metadata
 */
router.get('/category-metadata/:slug', (req, res) => {
    const category = CATEGORIES.find(c => c.slug === req.params.slug);
    if (!category) {
        return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
});

export default router;
export { CATEGORIES };
