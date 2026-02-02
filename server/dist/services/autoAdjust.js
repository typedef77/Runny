"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWeeklyPerformance = analyzeWeeklyPerformance;
exports.getAdjustmentRecommendation = getAdjustmentRecommendation;
exports.applyWeeklyAdjustment = applyWeeklyAdjustment;
exports.getRecentAdjustments = getRecentAdjustments;
const database_1 = __importDefault(require("../database"));
const date_fns_1 = require("date-fns");
function analyzeWeeklyPerformance(userId, weekOffset = 1) {
    const targetWeek = (0, date_fns_1.subWeeks)(new Date(), weekOffset);
    const weekStart = (0, date_fns_1.format)((0, date_fns_1.startOfWeek)(targetWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = (0, date_fns_1.format)((0, date_fns_1.endOfWeek)(targetWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    // Get planned workouts for the week
    const plannedWorkouts = database_1.default.prepare(`
    SELECT w.*, rl.id as log_id, rl.completed as log_completed,
           rl.effort_level, rl.pain_level
    FROM workouts w
    LEFT JOIN run_logs rl ON w.id = rl.workout_id
    WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
  `).all(userId, weekStart, weekEnd);
    if (plannedWorkouts.length === 0) {
        return null;
    }
    // Get all run logs for the week (including unplanned)
    const allLogs = database_1.default.prepare(`
    SELECT * FROM run_logs
    WHERE user_id = ? AND date >= ? AND date <= ?
  `).all(userId, weekStart, weekEnd);
    const completedPlanned = plannedWorkouts.filter(w => w.log_completed === 1);
    const missedKeyWorkouts = plannedWorkouts.filter(w => (w.is_key_workout === 1 || w.is_long_run === 1) && w.log_completed !== 1).length;
    const effortSum = allLogs.reduce((sum, l) => sum + (l.effort_level || 0), 0);
    const painSum = allLogs.reduce((sum, l) => sum + (l.pain_level || 0), 0);
    const totalMinutes = allLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
    return {
        totalRuns: allLogs.length,
        completedRuns: completedPlanned.length,
        plannedRuns: plannedWorkouts.length,
        averageEffort: allLogs.length > 0 ? effortSum / allLogs.length : 0,
        averagePain: allLogs.length > 0 ? painSum / allLogs.length : 0,
        totalMinutes,
        missedKeyWorkouts
    };
}
function getAdjustmentRecommendation(stats) {
    // High pain level - reduce training
    if (stats.averagePain >= 5) {
        return {
            type: 'reduce',
            reason: 'Pain levels are elevated. Reducing training to aid recovery.',
            volumeMultiplier: 0.7,
            intensityAdjustment: -1
        };
    }
    // Missing many workouts - reduce
    const completionRate = stats.plannedRuns > 0
        ? stats.completedRuns / stats.plannedRuns
        : 0;
    if (completionRate < 0.5) {
        return {
            type: 'reduce',
            reason: 'Low workout completion rate. Adjusting plan to be more achievable.',
            volumeMultiplier: 0.8,
            intensityAdjustment: 0
        };
    }
    // Missing key workouts
    if (stats.missedKeyWorkouts >= 2) {
        return {
            type: 'reduce',
            reason: 'Missing key workouts. Reducing volume to prioritize important sessions.',
            volumeMultiplier: 0.85,
            intensityAdjustment: 0
        };
    }
    // High effort but completing workouts - might be overdoing it
    if (stats.averageEffort >= 8 && completionRate >= 0.8) {
        return {
            type: 'maintain',
            reason: 'Training feels hard but manageable. Maintaining current level.',
            volumeMultiplier: 1.0,
            intensityAdjustment: 0
        };
    }
    // Low effort and high completion - can increase
    if (stats.averageEffort < 6 && completionRate >= 0.9 && stats.averagePain < 2) {
        return {
            type: 'increase',
            reason: 'Consistent training with low perceived effort. Gradually increasing.',
            volumeMultiplier: 1.05,
            intensityAdjustment: 0
        };
    }
    // Default - maintain
    return {
        type: 'maintain',
        reason: 'Training is progressing well. Maintaining current plan.',
        volumeMultiplier: 1.0,
        intensityAdjustment: 0
    };
}
function applyWeeklyAdjustment(userId) {
    const stats = analyzeWeeklyPerformance(userId);
    if (!stats) {
        return { applied: false, adjustment: null };
    }
    const recommendation = getAdjustmentRecommendation(stats);
    // Only apply if not maintaining
    if (recommendation.type === 'maintain') {
        return { applied: false, adjustment: recommendation };
    }
    // Get current week's workouts
    const today = new Date();
    const weekStart = (0, date_fns_1.format)((0, date_fns_1.startOfWeek)(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = (0, date_fns_1.format)((0, date_fns_1.endOfWeek)(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const plan = database_1.default.prepare(`
    SELECT tp.id FROM training_plans tp
    JOIN goals g ON tp.goal_id = g.id
    WHERE tp.user_id = ? AND g.is_active = 1
  `).get(userId);
    if (!plan) {
        return { applied: false, adjustment: recommendation };
    }
    // Get current week number
    const currentWorkout = database_1.default.prepare(`
    SELECT week_number FROM workouts
    WHERE plan_id = ? AND date >= ?
    ORDER BY date ASC LIMIT 1
  `).get(plan.id, weekStart);
    if (!currentWorkout) {
        return { applied: false, adjustment: recommendation };
    }
    // Adjust future workouts (current week and beyond)
    const futureWorkouts = database_1.default.prepare(`
    SELECT id, duration_minutes, is_key_workout, is_long_run
    FROM workouts
    WHERE plan_id = ? AND date >= ? AND completed = 0
  `).all(plan.id, weekStart);
    const updateStmt = database_1.default.prepare(`
    UPDATE workouts SET duration_minutes = ? WHERE id = ?
  `);
    futureWorkouts.forEach(w => {
        // Don't reduce key workouts as much
        let multiplier = recommendation.volumeMultiplier;
        if ((w.is_key_workout || w.is_long_run) && recommendation.type === 'reduce') {
            multiplier = Math.max(multiplier, 0.85);
        }
        const newDuration = Math.round(w.duration_minutes * multiplier);
        updateStmt.run(newDuration, w.id);
    });
    // Log the adjustment
    database_1.default.prepare(`
    INSERT INTO weekly_adjustments (user_id, plan_id, week_number, adjustment_type, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, plan.id, currentWorkout.week_number, recommendation.type, recommendation.reason);
    return { applied: true, adjustment: recommendation };
}
function getRecentAdjustments(userId, limit = 5) {
    return database_1.default.prepare(`
    SELECT * FROM weekly_adjustments
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);
}
//# sourceMappingURL=autoAdjust.js.map