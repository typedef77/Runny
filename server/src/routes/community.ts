import { Router, Response } from 'express';
import db from '../database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

const router = Router();

// Follow a user
router.post('/follow/:userId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId as string);

    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if target user exists and is public
    const targetUser = db.prepare('SELECT id, is_public FROM users WHERE id = ?')
      .get(targetUserId) as { id: number; is_public: number } | undefined;

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.is_public !== 1) {
      return res.status(403).json({ error: 'Cannot follow private profiles' });
    }

    // Check if already following
    const existingFollow = db.prepare(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?'
    ).get(req.userId, targetUserId);

    if (existingFollow) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)')
      .run(req.userId, targetUserId);

    res.status(201).json({ message: 'Now following user' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/follow/:userId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId as string);

    const result = db.prepare(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?'
    ).run(req.userId, targetUserId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    res.json({ message: 'Unfollowed user' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get followers
router.get('/followers', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const followers = db.prepare(`
      SELECT u.id, u.name, u.photo
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
    `).all(req.userId) as any[];

    res.json({
      followers: followers.map(f => ({
        id: f.id,
        name: f.name,
        photo: f.photo
      }))
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// Get following
router.get('/following', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const following = db.prepare(`
      SELECT u.id, u.name, u.photo
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `).all(req.userId) as any[];

    res.json({
      following: following.map(f => ({
        id: f.id,
        name: f.name,
        photo: f.photo
      }))
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

// Get activity feed (completed runs from followed users)
router.get('/feed', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const feed = db.prepare(`
      SELECT
        rl.id, rl.date, rl.duration_minutes, rl.effort_level,
        u.id as user_id, u.name as user_name, u.photo as user_photo,
        w.title as workout_title, w.workout_type, w.is_long_run
      FROM run_logs rl
      JOIN users u ON rl.user_id = u.id
      LEFT JOIN workouts w ON rl.workout_id = w.id
      WHERE rl.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = ?
      )
      AND u.is_public = 1
      AND rl.completed = 1
      ORDER BY rl.date DESC, rl.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.userId, limit, offset) as any[];

    res.json({
      feed: feed.map(item => ({
        id: item.id,
        date: item.date,
        durationMinutes: item.duration_minutes,
        effortLevel: item.effort_level,
        user: {
          id: item.user_id,
          name: item.user_name,
          photo: item.user_photo
        },
        workout: item.workout_title ? {
          title: item.workout_title,
          type: item.workout_type,
          isLongRun: item.is_long_run === 1
        } : null
      }))
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// Get weekly summaries of followed users
router.get('/weekly-summaries', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const summaries = db.prepare(`
      SELECT
        u.id as user_id, u.name, u.photo,
        COUNT(rl.id) as run_count,
        SUM(rl.duration_minutes) as total_minutes,
        MAX(rl.duration_minutes) as longest_run
      FROM follows f
      JOIN users u ON f.following_id = u.id
      LEFT JOIN run_logs rl ON u.id = rl.user_id
        AND rl.date >= ? AND rl.date <= ?
        AND rl.completed = 1
      WHERE f.follower_id = ? AND u.is_public = 1
      GROUP BY u.id
      HAVING run_count > 0
      ORDER BY total_minutes DESC
    `).all(weekStart, weekEnd, req.userId) as any[];

    res.json({
      weekStart,
      weekEnd,
      summaries: summaries.map(s => ({
        user: {
          id: s.user_id,
          name: s.name,
          photo: s.photo
        },
        runCount: s.run_count,
        totalMinutes: s.total_minutes || 0,
        longestRun: s.longest_run || 0
      }))
    });
  } catch (error) {
    console.error('Get weekly summaries error:', error);
    res.status(500).json({ error: 'Failed to get weekly summaries' });
  }
});

// Discover public users
router.get('/discover', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    // Get active public users who the current user doesn't follow
    const users = db.prepare(`
      SELECT u.id, u.name, u.photo,
             COUNT(DISTINCT rl.id) as run_count,
             SUM(rl.duration_minutes) as total_minutes
      FROM users u
      LEFT JOIN run_logs rl ON u.id = rl.user_id AND rl.date >= date('now', '-30 days')
      WHERE u.is_public = 1
        AND u.id != ?
        AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
      GROUP BY u.id
      HAVING run_count > 0
      ORDER BY run_count DESC
      LIMIT ?
    `).all(req.userId, req.userId, limit) as any[];

    res.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        photo: u.photo,
        recentRunCount: u.run_count,
        recentMinutes: u.total_minutes || 0
      }))
    });
  } catch (error) {
    console.error('Discover users error:', error);
    res.status(500).json({ error: 'Failed to discover users' });
  }
});

export default router;
