import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db_helpers } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'atlas-knowledge-infrastructure-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if user already exists
        const existingUser = await db_helpers.getUserByEmailOrUsername(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email or username already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user (first user is admin, rest are viewers)
        const { count, error: countError } = await db_helpers.getUserCount();
        const isFirstUser = count === 0;
        const role = isFirstUser ? 'admin' : 'viewer';
        const result = await db_helpers.createUser(username, email, passwordHash, role);

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.lastInsertRowid, username, role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.lastInsertRowid,
                username,
                email,
                role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * Login with email/username and password
 */
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier can be email or username

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/username and password are required' });
        }

        // Find user
        const user = await db_helpers.getUserByEmailOrUsername(identifier);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires authentication)
 */
router.get('/me', authenticateToken, (req, res) => {
    res.json({
        user: req.user
    });
});

/**
 * POST /api/auth/logout
 * Logout (client-side should remove token)
 */
router.post('/logout', (req, res) => {
    // In JWT, logout is handled client-side by removing the token
    // This endpoint exists for consistency and future server-side session handling
    res.json({ message: 'Logout successful' });
});

export default router;
