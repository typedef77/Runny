import { Router, Response } from 'express';
import db from '../database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { rescheduleWeek } from '../services/trainingPlan';
import { format, startOfWeek, endOfWeek, parseISO, addWeeks } from 'date-fns';

const router = Router();

// Get this week's workouts
router.get('/this-week', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const workouts = db.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed,
             rl.duration_minutes as logged_duration, rl.effort_level, rl.pain_level
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
      ORDER BY w.date ASC
    `).all(req.userId, weekStart, weekEnd) as any[];

    // Get the current week number from any workout
    const weekNumber = workouts.length > 0 ? workouts[0].week_number : 1;

    // Get plan info
    const plan = db.prepare(`
      SELECT tp.*, g.race_distance, g.race_date
      FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId) as any;

    res.json({
      weekStart,
      weekEnd,
      weekNumber,
      workouts: workouts.map(w => ({
        id: w.id,
        date: w.date,
        weekNumber: w.week_number,
        workoutType: w.workout_type,
        title: w.title,
        description: w.description,
        durationMinutes: w.duration_minutes,
        intensity: w.intensity,
        tiredAlternative: w.tired_alternative,
        isKeyWorkout: w.is_key_workout === 1,
        isLongRun: w.is_long_run === 1,
        completed: w.log_completed === 1,
        logId: w.log_id,
        loggedDuration: w.logged_duration,
        effortLevel: w.effort_level,
        painLevel: w.pain_level
      })),
      plan: plan ? {
        id: plan.id,
        raceDistance: plan.race_distance,
        raceDate: plan.race_date,
        startDate: plan.start_date,
        endDate: plan.end_date
      } : null
    });
  } catch (error) {
    console.error('Get this week error:', error);
    res.status(500).json({ error: 'Failed to get workouts' });
  }
});

// Get full training plan
router.get('/plan', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const plan = db.prepare(`
      SELECT tp.*, g.race_distance, g.race_date, g.available_days
      FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId) as any;

    if (!plan) {
      return res.json({ plan: null, weeks: [] });
    }

    const workouts = db.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.plan_id = ?
      ORDER BY w.date ASC
    `).all(plan.id) as any[];

    // Group by week
    const weekMap = new Map<number, any[]>();
    workouts.forEach(w => {
      if (!weekMap.has(w.week_number)) {
        weekMap.set(w.week_number, []);
      }
      weekMap.get(w.week_number)!.push({
        id: w.id,
        date: w.date,
        workoutType: w.workout_type,
        title: w.title,
        description: w.description,
        durationMinutes: w.duration_minutes,
        intensity: w.intensity,
        isKeyWorkout: w.is_key_workout === 1,
        isLongRun: w.is_long_run === 1,
        completed: w.log_completed === 1
      });
    });

    const weeks = Array.from(weekMap.entries()).map(([weekNumber, workouts]) => ({
      weekNumber,
      workouts,
      totalMinutes: workouts.reduce((sum, w) => sum + w.durationMinutes, 0),
      completedCount: workouts.filter(w => w.completed).length
    }));

    res.json({
      plan: {
        id: plan.id,
        raceDistance: plan.race_distance,
        raceDate: plan.race_date,
        startDate: plan.start_date,
        endDate: plan.end_date,
        availableDays: JSON.parse(plan.available_days)
      },
      weeks
    });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ error: 'Failed to get training plan' });
  }
});

// Get single workout
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const workoutId = parseInt(req.params.id as string);

    const workout = db.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed,
             rl.duration_minutes as logged_duration, rl.effort_level,
             rl.pain_level, rl.notes as log_notes
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.id = ? AND w.user_id = ?
    `).get(workoutId, req.userId) as any;

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    res.json({
      id: workout.id,
      date: workout.date,
      weekNumber: workout.week_number,
      workoutType: workout.workout_type,
      title: workout.title,
      description: workout.description,
      durationMinutes: workout.duration_minutes,
      intensity: workout.intensity,
      tiredAlternative: workout.tired_alternative,
      isKeyWorkout: workout.is_key_workout === 1,
      isLongRun: workout.is_long_run === 1,
      completed: workout.log_completed === 1,
      log: workout.log_id ? {
        id: workout.log_id,
        durationMinutes: workout.logged_duration,
        effortLevel: workout.effort_level,
        painLevel: workout.pain_level,
        notes: workout.log_notes
      } : null
    });
  } catch (error) {
    console.error('Get workout error:', error);
    res.status(500).json({ error: 'Failed to get workout' });
  }
});

// Reschedule current week
router.post('/reschedule-week', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { availableDays } = req.body;

    if (!Array.isArray(availableDays) || availableDays.length < 2) {
      return res.status(400).json({ error: 'At least 2 available days required' });
    }

    // Get current plan and week
    const plan = db.prepare(`
      SELECT tp.id, tp.goal_id
      FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId) as any;

    if (!plan) {
      return res.status(404).json({ error: 'No active training plan' });
    }

    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // Get current week number
    const currentWeekWorkout = db.prepare(`
      SELECT week_number FROM workouts
      WHERE plan_id = ? AND date >= ?
      ORDER BY date ASC
      LIMIT 1
    `).get(plan.id, weekStart) as { week_number: number } | undefined;

    if (!currentWeekWorkout) {
      return res.status(404).json({ error: 'No workouts found for this week' });
    }

    // Reschedule the week
    rescheduleWeek(plan.id, req.userId!, currentWeekWorkout.week_number, availableDays);

    // Update goal's available days
    db.prepare('UPDATE goals SET available_days = ? WHERE id = ?')
      .run(JSON.stringify(availableDays), plan.goal_id);

    res.json({ message: 'Week rescheduled successfully' });
  } catch (error) {
    console.error('Reschedule week error:', error);
    res.status(500).json({ error: 'Failed to reschedule week' });
  }
});

// Get upcoming week preview
router.get('/week/:weekNumber', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const weekNumber = parseInt(req.params.weekNumber as string);

    const plan = db.prepare(`
      SELECT tp.id FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId) as any;

    if (!plan) {
      return res.status(404).json({ error: 'No active training plan' });
    }

    const workouts = db.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.plan_id = ? AND w.week_number = ?
      ORDER BY w.date ASC
    `).all(plan.id, weekNumber) as any[];

    res.json({
      weekNumber,
      workouts: workouts.map(w => ({
        id: w.id,
        date: w.date,
        workoutType: w.workout_type,
        title: w.title,
        description: w.description,
        durationMinutes: w.duration_minutes,
        intensity: w.intensity,
        tiredAlternative: w.tired_alternative,
        isKeyWorkout: w.is_key_workout === 1,
        isLongRun: w.is_long_run === 1,
        completed: w.log_completed === 1
      })),
      totalMinutes: workouts.reduce((sum, w) => sum + w.duration_minutes, 0)
    });
  } catch (error) {
    console.error('Get week error:', error);
    res.status(500).json({ error: 'Failed to get week' });
  }
});

export default router;
