"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Configure multer for photo uploads
const storage = multer_1.default.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
// Get user profile
router.get('/profile/:id', auth_1.optionalAuth, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const isOwnProfile = req.userId === userId;
        const user = database_1.default.prepare(`
      SELECT id, name, photo, is_public, created_at
      FROM users WHERE id = ?
    `).get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // If profile is private and not own profile, deny access
        if (!user.is_public && !isOwnProfile) {
            return res.status(403).json({ error: 'This profile is private' });
        }
        // Get follower/following counts
        const followerCount = database_1.default.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(userId);
        const followingCount = database_1.default.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(userId);
        // Check if current user follows this user
        let isFollowing = false;
        if (req.userId && req.userId !== userId) {
            const follow = database_1.default.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.userId, userId);
            isFollowing = !!follow;
        }
        // Get recent activity (last 5 runs) if public or own profile
        const recentRuns = database_1.default.prepare(`
      SELECT rl.id, rl.date, rl.duration_minutes, rl.effort_level, w.title, w.workout_type
      FROM run_logs rl
      LEFT JOIN workouts w ON rl.workout_id = w.id
      WHERE rl.user_id = ?
      ORDER BY rl.date DESC
      LIMIT 5
    `).all(userId);
        res.json({
            id: user.id,
            name: user.name,
            photo: user.photo,
            isPublic: user.is_public === 1,
            createdAt: user.created_at,
            followerCount: followerCount.count,
            followingCount: followingCount.count,
            isFollowing,
            isOwnProfile,
            recentRuns
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});
// Update profile
router.put('/profile', auth_1.authenticateToken, (req, res) => {
    try {
        const { name, isPublic } = req.body;
        if (name !== undefined && (!name || name.trim().length === 0)) {
            return res.status(400).json({ error: 'Name cannot be empty' });
        }
        const updates = [];
        const params = [];
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name.trim());
        }
        if (isPublic !== undefined) {
            updates.push('is_public = ?');
            params.push(isPublic ? 1 : 0);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.userId);
        database_1.default.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        const user = database_1.default.prepare('SELECT id, email, name, photo, is_public FROM users WHERE id = ?').get(req.userId);
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            photo: user.photo,
            isPublic: user.is_public === 1
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// Upload profile photo
router.post('/profile/photo', auth_1.authenticateToken, upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo uploaded' });
        }
        const photoPath = '/uploads/' + req.file.filename;
        database_1.default.prepare('UPDATE users SET photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(photoPath, req.userId);
        res.json({ photo: photoPath });
    }
    catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});
// Change password
router.put('/password', auth_1.authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        const user = database_1.default.prepare('SELECT password FROM users WHERE id = ?')
            .get(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const validPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        database_1.default.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(hashedPassword, req.userId);
        res.json({ message: 'Password updated successfully' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
// Search users
router.get('/search', auth_1.authenticateToken, (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }
        const users = database_1.default.prepare(`
      SELECT id, name, photo, is_public
      FROM users
      WHERE name LIKE ? AND is_public = 1 AND id != ?
      LIMIT 20
    `).all(`%${query}%`, req.userId);
        res.json(users.map(u => ({
            id: u.id,
            name: u.name,
            photo: u.photo,
            isPublic: u.is_public === 1
        })));
    }
    catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map