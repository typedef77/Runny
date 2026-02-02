import { Router, Response } from 'express';
import db from '../database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { analyzeWeeklyPerformance, applyWeeklyAdjustment, getRecentAdjustments } from '../services/autoAdjust';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

const router = Router();

// Get progress overview
router.get('/overview', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    // Get total stats
    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as total_runs,
        SUM(duration_minutes) as total_minutes,
        AVG(effort_level) as avg_effort,
        AVG(pain_level) as avg_pain
      FROM run_logs
      WHERE user_id = ?
    `).get(req.userId) as any;

    // Get active plan info
    const plan = db.prepare(`
      SELECT tp.*, g.race_distance, g.race_date
      FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId) as any;

    let planProgress = null;
    if (plan) {
      const totalWorkouts = db.prepare(
        'SELECT COUNT(*) as count FROM workouts WHERE plan_id = ?'
      ).get(plan.id) as { count: number };

      const completedWorkouts = db.prepare(`
        SELECT COUNT(*) as count FROM workouts w
        JOIN run_logs rl ON w.id = rl.workout_id
        WHERE w.plan_id = ? AND rl.completed = 1
      `).get(plan.id) as { count: number };

      planProgress = {
        raceDistance: plan.race_distance,
        raceDate: plan.race_date,
        totalWorkouts: totalWorkouts.count,
        completedWorkouts: completedWorkouts.count,
        completionRate: totalWorkouts.count > 0
          ? Math.round((completedWorkouts.count / totalWorkouts.count) * 100)
          : 0
      };
    }

    res.json({
      totalRuns: totalStats.total_runs || 0,
      totalMinutes: Math.round(totalStats.total_minutes || 0),
      averageEffort: totalStats.avg_effort ? parseFloat(totalStats.avg_effort.toFixed(1)) : 0,
      averagePain: totalStats.avg_pain ? parseFloat(totalStats.avg_pain.toFixed(1)) : 0,
      planProgress
    });
  } catch (error) {
    console.error('Get progress overview error:', error);
    res.status(500).json({ error: 'Failed to get progress overview' });
  }
});

// Get weekly trends
router.get('/weekly', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 8;
    const weeklyData: any[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const targetWeek = subWeeks(new Date(), i);
      const weekStart = format(startOfWeek(targetWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(targetWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const stats = db.prepare(`
        SELECT
          COUNT(*) as run_count,
          SUM(duration_minutes) as total_minutes,
          AVG(effort_level) as avg_effort,
          MAX(duration_minutes) as longest_run
        FROM run_logs
        WHERE user_id = ? AND date >= ? AND date <= ?
      `).get(req.userId, weekStart, weekEnd) as any;

      const completionStats = db.prepare(`
        SELECT
          COUNT(*) as planned,
          SUM(CASE WHEN rl.id IS NOT NULL THEN 1 ELSE 0 END) as completed
        FROM workouts w
        LEFT JOIN run_logs rl ON w.id = rl.workout_id
        WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
      `).get(req.userId, weekStart, weekEnd) as any;

      weeklyData.push({
        weekStart,
        weekEnd,
        runCount: stats.run_count || 0,
        totalMinutes: stats.total_minutes || 0,
        avgEffort: stats.avg_effort ? parseFloat(stats.avg_effort.toFixed(1)) : 0,
        longestRun: stats.longest_run || 0,
        plannedWorkouts: completionStats.planned || 0,
        completedWorkouts: completionStats.completed || 0
      });
    }

    res.json({ weeks: weeklyData });
  } catch (error) {
    console.error('Get weekly trends error:', error);
    res.status(500).json({ error: 'Failed to get weekly trends' });
  }
});

// Get long run progression
router.get('/long-runs', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const longRuns = db.prepare(`
      SELECT rl.date, rl.duration_minutes, rl.effort_level, w.title
      FROM run_logs rl
      JOIN workouts w ON rl.workout_id = w.id
      WHERE rl.user_id = ? AND w.is_long_run = 1
      ORDER BY rl.date ASC
    `).all(req.userId) as any[];

    res.json({
      longRuns: longRuns.map(r => ({
        date: r.date,
        durationMinutes: r.duration_minutes,
        effortLevel: r.effort_level,
        title: r.title
      }))
    });
  } catch (error) {
    console.error('Get long runs error:', error);
    res.status(500).json({ error: 'Failed to get long runs' });
  }
});

// Get workout type breakdown
router.get('/workout-types', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const breakdown = db.prepare(`
      SELECT w.workout_type, COUNT(*) as count, SUM(rl.duration_minutes) as total_minutes
      FROM run_logs rl
      JOIN workouts w ON rl.workout_id = w.id
      WHERE rl.user_id = ?
      GROUP BY w.workout_type
    `).all(req.userId) as any[];

    res.json({
      breakdown: breakdown.map(b => ({
        type: b.workout_type,
        count: b.count,
        totalMinutes: b.total_minutes || 0
      }))
    });
  } catch (error) {
    console.error('Get workout types error:', error);
    res.status(500).json({ error: 'Failed to get workout types' });
  }
});

// Trigger weekly adjustment check
router.post('/check-adjustment', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const result = applyWeeklyAdjustment(req.userId!);

    res.json({
      adjustmentApplied: result.applied,
      recommendation: result.adjustment ? {
        type: result.adjustment.type,
        reason: result.adjustment.reason
      } : null
    });
  } catch (error) {
    console.error('Check adjustment error:', error);
    res.status(500).json({ error: 'Failed to check for adjustments' });
  }
});

// Get recent adjustments
router.get('/adjustments', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const adjustments = getRecentAdjustments(req.userId!);

    res.json({
      adjustments: adjustments.map((a: any) => ({
        weekNumber: a.week_number,
        type: a.adjustment_type,
        reason: a.reason,
        createdAt: a.created_at
      }))
    });
  } catch (error) {
    console.error('Get adjustments error:', error);
    res.status(500).json({ error: 'Failed to get adjustments' });
  }
});

// Get estimated race performance (simplified)
router.get('/race-estimate', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    // Get recent training data
    const recentStats = db.prepare(`
      SELECT AVG(duration_minutes) as avg_duration,
             MAX(duration_minutes) as max_duration,
             AVG(effort_level) as avg_effort
      FROM run_logs
      WHERE user_id = ?
        AND date >= date('now', '-4 weeks')
    `).get(req.userId) as any;

    const goal = db.prepare(`
      SELECT race_distance, target_time FROM goals
      WHERE user_id = ? AND is_active = 1
    `).get(req.userId) as any;

    if (!goal || !recentStats.avg_duration) {
      return res.json({ estimate: null });
    }

    // Simple estimation based on longest run and average effort
    // This is a simplified model - real estimates would be more complex
    const raceDistanceMinutes: { [key: string]: number } = {
      '5k': 30,
      '10k': 60,
      'half': 120,
      'marathon': 240
    };

    const baseTime = raceDistanceMinutes[goal.race_distance] || 60;
    const effortModifier = (recentStats.avg_effort - 5) * 2; // Higher effort = slower
    const fitnessBonus = (recentStats.max_duration / 60) * -1; // Longer runs = faster

    const estimatedMinutes = Math.max(
      baseTime * 0.7,
      baseTime + effortModifier + fitnessBonus
    );

    res.json({
      estimate: {
        raceDistance: goal.race_distance,
        targetTime: goal.target_time,
        estimatedMinutes: Math.round(estimatedMinutes),
        confidence: recentStats.avg_duration > 30 ? 'moderate' : 'low',
        basedOnWeeks: 4
      }
    });
  } catch (error) {
    console.error('Get race estimate error:', error);
    res.status(500).json({ error: 'Failed to get race estimate' });
  }
});

export default router;
