"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const auth_1 = require("../middleware/auth");
const trainingPlan_1 = require("../services/trainingPlan");
const router = (0, express_1.Router)();
// Create a new goal
router.post('/', auth_1.authenticateToken, (req, res) => {
    try {
        const { raceDistance, raceDate, targetTime, experienceLevel, currentFrequency, longestRecentRun, availableDays, maxWeekdayTime, maxWeekendTime } = req.body;
        // Validation
        if (!raceDistance || !raceDate || !experienceLevel || !availableDays) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!['5k', '10k', 'half', 'marathon'].includes(raceDistance)) {
            return res.status(400).json({ error: 'Invalid race distance' });
        }
        if (!['beginner', 'intermediate', 'advanced'].includes(experienceLevel)) {
            return res.status(400).json({ error: 'Invalid experience level' });
        }
        if (!Array.isArray(availableDays) || availableDays.length < 2) {
            return res.status(400).json({ error: 'At least 2 available days required' });
        }
        const raceDateTime = new Date(raceDate);
        if (raceDateTime <= new Date()) {
            return res.status(400).json({ error: 'Race date must be in the future' });
        }
        // Deactivate any existing active goal
        database_1.default.prepare('UPDATE goals SET is_active = 0 WHERE user_id = ? AND is_active = 1')
            .run(req.userId);
        // Create new goal
        const result = database_1.default.prepare(`
      INSERT INTO goals (
        user_id, race_distance, race_date, target_time, experience_level,
        current_frequency, longest_recent_run, available_days,
        max_weekday_time, max_weekend_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, raceDistance, raceDate, targetTime || null, experienceLevel, currentFrequency || 3, longestRecentRun || 30, JSON.stringify(availableDays), maxWeekdayTime || 60, maxWeekendTime || 90);
        const goalId = result.lastInsertRowid;
        // Get the created goal
        const goal = database_1.default.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
        // Generate training plan
        const planId = (0, trainingPlan_1.generateTrainingPlan)(goal);
        res.status(201).json({
            message: 'Goal created and training plan generated',
            goal: {
                id: goal.id,
                raceDistance: goal.race_distance,
                raceDate: goal.race_date,
                targetTime: goal.target_time,
                experienceLevel: goal.experience_level,
                currentFrequency: goal.current_frequency,
                longestRecentRun: goal.longest_recent_run,
                availableDays: JSON.parse(goal.available_days),
                maxWeekdayTime: goal.max_weekday_time,
                maxWeekendTime: goal.max_weekend_time,
                isActive: true
            },
            planId
        });
    }
    catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ error: 'Failed to create goal' });
    }
});
// Get active goal
router.get('/active', auth_1.authenticateToken, (req, res) => {
    try {
        const goal = database_1.default.prepare(`
      SELECT * FROM goals WHERE user_id = ? AND is_active = 1
    `).get(req.userId);
        if (!goal) {
            return res.json({ goal: null });
        }
        const plan = database_1.default.prepare(`
      SELECT * FROM training_plans WHERE goal_id = ?
    `).get(goal.id);
        res.json({
            goal: {
                id: goal.id,
                raceDistance: goal.race_distance,
                raceDate: goal.race_date,
                targetTime: goal.target_time,
                experienceLevel: goal.experience_level,
                currentFrequency: goal.current_frequency,
                longestRecentRun: goal.longest_recent_run,
                availableDays: JSON.parse(goal.available_days),
                maxWeekdayTime: goal.max_weekday_time,
                maxWeekendTime: goal.max_weekend_time,
                isActive: true
            },
            plan: plan ? {
                id: plan.id,
                startDate: plan.start_date,
                endDate: plan.end_date
            } : null
        });
    }
    catch (error) {
        console.error('Get active goal error:', error);
        res.status(500).json({ error: 'Failed to get active goal' });
    }
});
// Update goal (availability changes)
router.put('/:id', auth_1.authenticateToken, (req, res) => {
    try {
        const goalId = parseInt(req.params.id);
        const { availableDays, maxWeekdayTime, maxWeekendTime } = req.body;
        // Verify ownership
        const goal = database_1.default.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?')
            .get(goalId, req.userId);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        // Update goal
        const updates = [];
        const params = [];
        if (availableDays !== undefined) {
            if (!Array.isArray(availableDays) || availableDays.length < 2) {
                return res.status(400).json({ error: 'At least 2 available days required' });
            }
            updates.push('available_days = ?');
            params.push(JSON.stringify(availableDays));
        }
        if (maxWeekdayTime !== undefined) {
            updates.push('max_weekday_time = ?');
            params.push(maxWeekdayTime);
        }
        if (maxWeekendTime !== undefined) {
            updates.push('max_weekend_time = ?');
            params.push(maxWeekendTime);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(goalId);
        database_1.default.prepare(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        // Regenerate the training plan
        const planId = (0, trainingPlan_1.regeneratePlan)(goalId, req.userId);
        const updatedGoal = database_1.default.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
        res.json({
            message: 'Goal updated and plan regenerated',
            goal: {
                id: updatedGoal.id,
                raceDistance: updatedGoal.race_distance,
                raceDate: updatedGoal.race_date,
                targetTime: updatedGoal.target_time,
                experienceLevel: updatedGoal.experience_level,
                currentFrequency: updatedGoal.current_frequency,
                longestRecentRun: updatedGoal.longest_recent_run,
                availableDays: JSON.parse(updatedGoal.available_days),
                maxWeekdayTime: updatedGoal.max_weekday_time,
                maxWeekendTime: updatedGoal.max_weekend_time,
                isActive: updatedGoal.is_active === 1
            },
            planId
        });
    }
    catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Failed to update goal' });
    }
});
// Delete goal
router.delete('/:id', auth_1.authenticateToken, (req, res) => {
    try {
        const goalId = parseInt(req.params.id);
        // Verify ownership
        const goal = database_1.default.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?')
            .get(goalId, req.userId);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        // Delete goal (cascades to training plans and workouts)
        database_1.default.prepare('DELETE FROM goals WHERE id = ?').run(goalId);
        res.json({ message: 'Goal deleted successfully' });
    }
    catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});
exports.default = router;
//# sourceMappingURL=goals.js.map