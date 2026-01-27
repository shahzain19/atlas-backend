import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { supabase as db } from '../db.js';

const router = express.Router();

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { data: users, error } = await db
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * PATCH /api/users/:id/role
 * Update user role (admin only)
 */
router.patch('/:id/role', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Validate role
        if (!['admin', 'contributor', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be admin, contributor, or viewer.' });
        }

        // Prevent demoting yourself if you're the only admin
        if (req.user.id === id) { // id from params is string, req.user.id is string
            const { data: adminCount, error: countError } = await db
                .from('profiles')
                .select('id', { count: 'exact' })
                .eq('role', 'admin');

            if (countError) throw countError;

            if (adminCount.length === 1 && role !== 'admin') {
                return res.status(400).json({ error: 'Cannot demote the only admin user' });
            }
        }

        // Update role
        const { error } = await db
            .from('profiles')
            .update({ role })
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'User role updated successfully', userId: id, newRole: role });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only, cannot delete yourself)
 */
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting yourself
        if (req.user.id === id) { // id from params is string, req.user.id is string
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Check if user exists
        const { data: user, error: fetchError } = await db
            .from('profiles')
            .select('id')
            .eq('id', id)
            .single();

        if (fetchError && fetchError.code === 'PGRST116') { // No rows found
            return res.status(404).json({ error: 'User not found' });
        }
        if (fetchError) throw fetchError;

        // Delete user
        const { error: deleteError } = await db
            .from('profiles')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ message: 'User deleted successfully', userId: id });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * PATCH /api/users/me/onboarding
 * Mark onboarding as complete for the authenticated user
 */
router.patch('/me/onboarding', authenticateToken, async (req, res) => {
    try {
        const { completed } = req.body; // Expecting { completed: true/false }

        const { error } = await db
            .from('profiles')
            .update({ onboarding_completed: !!completed })
            .eq('id', req.user.id);

        if (error) throw error;
        res.json({ message: 'Onboarding status updated' });
    } catch (error) {
        console.error('Error updating onboarding status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

export default router;
