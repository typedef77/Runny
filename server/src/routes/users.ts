import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import db from '../database';
import { authenticateToken, AuthRequest, optionalAuth } from '../middleware/auth';

const router = Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get user profile
router.get('/profile/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);
    const isOwnProfile = req.userId === userId;

    const user = db.prepare(`
      SELECT id, name, photo, is_public, created_at
      FROM users WHERE id = ?
    `).get(userId) as { id: number; name: string; photo: string | null; is_public: number; created_at: string } | undefined;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If profile is private and not own profile, deny access
    if (!user.is_public && !isOwnProfile) {
      return res.status(403).json({ error: 'This profile is private' });
    }

    // Get follower/following counts
    const followerCount = db.prepare(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = ?'
    ).get(userId) as { count: number };

    const followingCount = db.prepare(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?'
    ).get(userId) as { count: number };

    // Check if current user follows this user
    let isFollowing = false;
    if (req.userId && req.userId !== userId) {
      const follow = db.prepare(
        'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?'
      ).get(req.userId, userId);
      isFollowing = !!follow;
    }

    // Get recent activity (last 5 runs) if public or own profile
    const recentRuns = db.prepare(`
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
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update profile
router.put('/profile', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { name, isPublic } = req.body;

    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

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
    params.push(req.userId!);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare(
      'SELECT id, email, name, photo, is_public FROM users WHERE id = ?'
    ).get(req.userId) as { id: number; email: string; name: string; photo: string | null; is_public: number };

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      photo: user.photo,
      isPublic: user.is_public === 1
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload profile photo
router.post('/profile/photo', authenticateToken, upload.single('photo'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const photoPath = '/uploads/' + req.file.filename;

    db.prepare('UPDATE users SET photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(photoPath, req.userId);

    res.json({ photo: photoPath });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Change password
router.put('/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = db.prepare('SELECT password FROM users WHERE id = ?')
      .get(req.userId) as { password: string } | undefined;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.userId);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Search users
router.get('/search', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = db.prepare(`
      SELECT id, name, photo, is_public
      FROM users
      WHERE name LIKE ? AND is_public = 1 AND id != ?
      LIMIT 20
    `).all(`%${query}%`, req.userId) as { id: number; name: string; photo: string | null; is_public: number }[];

    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      photo: u.photo,
      isPublic: u.is_public === 1
    })));
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
