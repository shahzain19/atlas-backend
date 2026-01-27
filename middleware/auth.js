import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db_helpers } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'atlas-knowledge-infrastructure-secret-key-2026';

/**
 * Middleware to verify JWT token or API Key and attach user to request
 */
export const authenticateToken = async (req, res, next) => {
    if (req.user) return next();

    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Try JWT first
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await db_helpers.getUserById(decoded.userId);

            if (!user) {
                return res.status(401).json({ error: 'Invalid token: user not found' });
            }

            req.user = user;
            req.authType = 'jwt';
            return next();
        } catch (error) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
    }

    // Try API Key if no JWT
    if (apiKey) {
        try {
            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            const keyRecord = await db_helpers.getApiKeyByHash(keyHash);

            if (!keyRecord) {
                return res.status(401).json({ error: 'Invalid API key' });
            }

            // Sync user object structure with getUserById
            req.user = {
                id: keyRecord.user_id,
                username: keyRecord.username,
                email: keyRecord.email,
                role: keyRecord.role
            };
            req.authType = 'apikey';

            // Update last used timestamp
            await db_helpers.updateApiKeyLastUsed(keyRecord.id);

            return next();
        } catch (error) {
            return res.status(500).json({ error: 'Internal server error during authentication' });
        }
    }

    return res.status(401).json({ error: 'Authentication required' });
};

/**
 * Middleware to check if user has required role
 * @param {string[]} allowedRoles - Array of allowed roles
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
};

/**
 * Optional authentication - attaches user if token is valid, but doesn't fail if missing
 */
export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await db_helpers.getUserById(decoded.userId);
        if (user) {
            req.user = user;
        }
    } catch (error) {
        // Token invalid, but that's okay for optional auth
    }

    next();
};

