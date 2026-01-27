import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import tagRoutes from './routes/tags.js';
import searchRoutes from './routes/search.js';
import userRoutes from './routes/users.js';
import seoRoutes from './routes/seo.js';
import apiKeyRoutes from './routes/api_keys.js';
import { supabase as db } from './db.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['https://atlas-frontend-omega.vercel.app'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const { data, error } = await db.from('profiles').select('count', { count: 'exact', head: true });
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: error ? 'disconnected' : 'connected',
        ...(error && { error: error.message })
    });
});

// Mount routes
app.use('/', seoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/keys', apiKeyRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);

    res.status(error.status || 500).json({
        error: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down...');
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Atlas Knowledge Engine running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Authentication: Supabase Auth & JWT enabled`);
    console.log(`🔍 Search: PostgreSQL Full-Text Search enabled\n`);
});
