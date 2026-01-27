import express from 'express';
import crypto from 'crypto';
import { db_helpers } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/keys
 * List API keys for the current user
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const keys = await db_helpers.getApiKeysByUser(req.user.id);
        res.json(keys);
    } catch (error) {
        console.error('Error fetching API keys:', error);
        res.status(500).json({ error: 'Failed to list API keys' });
    }
});

/**
 * POST /api/keys
 * Create a new API key
 */
router.post('/', authenticateToken, async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Key name is required' });
    }

    try {
        // Generate a random key with prefix
        const key = `atla_${crypto.randomBytes(32).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(key).digest('hex');

        await db_helpers.createApiKey(req.user.id, name, keyHash);

        // Return the key only once
        res.status(201).json({
            name,
            key,
            message: 'Make sure to copy your API key now. You won\'t be able to see it again!'
        });
    } catch (error) {
        console.error('Failed to create API key:', error);
        res.status(500).json({ error: 'Failed to create API key' });
    }
});

/**
 * DELETE /api/keys/:id
 * Revoke an API key
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db_helpers.deleteApiKey(id, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }

        res.json({ message: 'API key revoked successfully' });
    } catch (error) {
        console.error('Error revoking API key:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});

export default router;
