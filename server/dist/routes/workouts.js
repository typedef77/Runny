"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const auth_1 = require("../middleware/auth");
const trainingPlan_1 = require("../services/trainingPlan");
const date_fns_1 = require("date-fns");
const router = (0, express_1.Router)();
// Get this week's workouts
router.get('/this-week', auth_1.authenticateToken, (req, res) => {
    try {
        const today = new Date();
        const weekStart = (0, date_fns_1.format)((0, date_fns_1.startOfWeek)(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekEnd = (0, date_fns_1.format)((0, date_fns_1.endOfWeek)(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const workouts = database_1.default.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed,
             rl.duration_minutes as logged_duration, rl.effort_level, rl.pain_level
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
      ORDER BY w.date ASC
    `).all(req.userId, weekStart, weekEnd);
        // Get the current week number from any workout
        const weekNumber = workouts.length > 0 ? workouts[0].week_number : 1;
        // Get plan info
        const plan = database_1.default.prepare(`
      SELECT tp.*, g.race_distance, g.race_date
      FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId);
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
    }
    catch (error) {
        console.error('Get this week error:', error);
        res.status(500).json({ error: 'Failed to get workouts' });
    }
});
// Get full training plan
router.get('/plan', auth_1.authenticateToken, (req, res) => {
    try {
        const plan = database_1.default.prepare(`
      SELECT tp.*, g.race_distance, g.race_date, g.available_days
      FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId);
        if (!plan) {
            return res.json({ plan: null, weeks: [] });
        }
        const workouts = database_1.default.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.plan_id = ?
      ORDER BY w.date ASC
    `).all(plan.id);
        // Group by week
        const weekMap = new Map();
        workouts.forEach(w => {
            if (!weekMap.has(w.week_number)) {
                weekMap.set(w.week_number, []);
            }
            weekMap.get(w.week_number).push({
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
    }
    catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ error: 'Failed to get training plan' });
    }
});
// Get single workout
router.get('/:id', auth_1.authenticateToken, (req, res) => {
    try {
        const workoutId = parseInt(req.params.id);
        const workout = database_1.default.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed,
             rl.duration_minutes as logged_duration, rl.effort_level,
             rl.pain_level, rl.notes as log_notes
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.id = ? AND w.user_id = ?
    `).get(workoutId, req.userId);
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
    }
    catch (error) {
        console.error('Get workout error:', error);
        res.status(500).json({ error: 'Failed to get workout' });
    }
});
// Reschedule current week
router.post('/reschedule-week', auth_1.authenticateToken, (req, res) => {
    try {
        const { availableDays } = req.body;
        if (!Array.isArray(availableDays) || availableDays.length < 2) {
            return res.status(400).json({ error: 'At least 2 available days required' });
        }
        // Get current plan and week
        const plan = database_1.default.prepare(`
      SELECT tp.id, tp.goal_id
      FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId);
        if (!plan) {
            return res.status(404).json({ error: 'No active training plan' });
        }
        const today = new Date();
        const weekStart = (0, date_fns_1.format)((0, date_fns_1.startOfWeek)(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        // Get current week number
        const currentWeekWorkout = database_1.default.prepare(`
      SELECT week_number FROM workouts
      WHERE plan_id = ? AND date >= ?
      ORDER BY date ASC
      LIMIT 1
    `).get(plan.id, weekStart);
        if (!currentWeekWorkout) {
            return res.status(404).json({ error: 'No workouts found for this week' });
        }
        // Reschedule the week
        (0, trainingPlan_1.rescheduleWeek)(plan.id, req.userId, currentWeekWorkout.week_number, availableDays);
        // Update goal's available days
        database_1.default.prepare('UPDATE goals SET available_days = ? WHERE id = ?')
            .run(JSON.stringify(availableDays), plan.goal_id);
        res.json({ message: 'Week rescheduled successfully' });
    }
    catch (error) {
        console.error('Reschedule week error:', error);
        res.status(500).json({ error: 'Failed to reschedule week' });
    }
});
// Get upcoming week preview
router.get('/week/:weekNumber', auth_1.authenticateToken, (req, res) => {
    try {
        const weekNumber = parseInt(req.params.weekNumber);
        const plan = database_1.default.prepare(`
      SELECT tp.id FROM training_plans tp
      JOIN goals g ON tp.goal_id = g.id
      WHERE tp.user_id = ? AND g.is_active = 1
    `).get(req.userId);
        if (!plan) {
            return res.status(404).json({ error: 'No active training plan' });
        }
        const workouts = database_1.default.prepare(`
      SELECT w.*, rl.id as log_id, rl.completed as log_completed
      FROM workouts w
      LEFT JOIN run_logs rl ON w.id = rl.workout_id
      WHERE w.plan_id = ? AND w.week_number = ?
      ORDER BY w.date ASC
    `).all(plan.id, weekNumber);
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
    }
    catch (error) {
        console.error('Get week error:', error);
        res.status(500).json({ error: 'Failed to get week' });
    }
});
exports.default = router;
//# sourceMappingURL=workouts.js.map