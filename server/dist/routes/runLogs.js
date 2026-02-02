"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const auth_1 = require("../middleware/auth");
const date_fns_1 = require("date-fns");
const router = (0, express_1.Router)();
// Log a workout
router.post('/', auth_1.authenticateToken, (req, res) => {
    try {
        const { workoutId, completed, durationMinutes, effortLevel, painLevel, notes, date } = req.body;
        // Validation
        if (durationMinutes === undefined || effortLevel === undefined) {
            return res.status(400).json({ error: 'Duration and effort level are required' });
        }
        if (effortLevel < 1 || effortLevel > 10) {
            return res.status(400).json({ error: 'Effort level must be between 1 and 10' });
        }
        if (painLevel !== undefined && (painLevel < 0 || painLevel > 10)) {
            return res.status(400).json({ error: 'Pain level must be between 0 and 10' });
        }
        const isUnplanned = !workoutId;
        const logDate = date || (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        // If logging a planned workout, verify ownership
        if (workoutId) {
            const workout = database_1.default.prepare('SELECT id FROM workouts WHERE id = ? AND user_id = ?')
                .get(workoutId, req.userId);
            if (!workout) {
                return res.status(404).json({ error: 'Workout not found' });
            }
            // Check if already logged
            const existingLog = database_1.default.prepare('SELECT id FROM run_logs WHERE workout_id = ?').get(workoutId);
            if (existingLog) {
                return res.status(400).json({ error: 'Workout already logged' });
            }
        }
        const result = database_1.default.prepare(`
      INSERT INTO run_logs (
        user_id, workout_id, date, completed, duration_minutes,
        effort_level, pain_level, notes, is_unplanned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, workoutId || null, logDate, completed !== false ? 1 : 0, durationMinutes, effortLevel, painLevel || 0, notes || null, isUnplanned ? 1 : 0);
        // Update workout completed status
        if (workoutId && completed !== false) {
            database_1.default.prepare('UPDATE workouts SET completed = 1 WHERE id = ?').run(workoutId);
        }
        res.status(201).json({
            message: 'Run logged successfully',
            logId: result.lastInsertRowid
        });
    }
    catch (error) {
        console.error('Log run error:', error);
        res.status(500).json({ error: 'Failed to log run' });
    }
});
// Get user's run logs
router.get('/', auth_1.authenticateToken, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const logs = database_1.default.prepare(`
      SELECT rl.*, w.title as workout_title, w.workout_type
      FROM run_logs rl
      LEFT JOIN workouts w ON rl.workout_id = w.id
      WHERE rl.user_id = ?
      ORDER BY rl.date DESC, rl.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.userId, limit, offset);
        const total = database_1.default.prepare('SELECT COUNT(*) as count FROM run_logs WHERE user_id = ?')
            .get(req.userId);
        res.json({
            logs: logs.map(log => ({
                id: log.id,
                date: log.date,
                completed: log.completed === 1,
                durationMinutes: log.duration_minutes,
                effortLevel: log.effort_level,
                painLevel: log.pain_level,
                notes: log.notes,
                isUnplanned: log.is_unplanned === 1,
                workoutTitle: log.workout_title,
                workoutType: log.workout_type
            })),
            total: total.count,
            hasMore: offset + logs.length < total.count
        });
    }
    catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to get run logs' });
    }
});
// Update a log
router.put('/:id', auth_1.authenticateToken, (req, res) => {
    try {
        const logId = parseInt(req.params.id);
        const { completed, durationMinutes, effortLevel, painLevel, notes } = req.body;
        // Verify ownership
        const log = database_1.default.prepare('SELECT * FROM run_logs WHERE id = ? AND user_id = ?')
            .get(logId, req.userId);
        if (!log) {
            return res.status(404).json({ error: 'Log not found' });
        }
        const updates = [];
        const params = [];
        if (completed !== undefined) {
            updates.push('completed = ?');
            params.push(completed ? 1 : 0);
        }
        if (durationMinutes !== undefined) {
            updates.push('duration_minutes = ?');
            params.push(durationMinutes);
        }
        if (effortLevel !== undefined) {
            if (effortLevel < 1 || effortLevel > 10) {
                return res.status(400).json({ error: 'Effort level must be between 1 and 10' });
            }
            updates.push('effort_level = ?');
            params.push(effortLevel);
        }
        if (painLevel !== undefined) {
            if (painLevel < 0 || painLevel > 10) {
                return res.status(400).json({ error: 'Pain level must be between 0 and 10' });
            }
            updates.push('pain_level = ?');
            params.push(painLevel);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        params.push(logId);
        database_1.default.prepare(`UPDATE run_logs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        // Update workout completed status if applicable
        if (log.workout_id && completed !== undefined) {
            database_1.default.prepare('UPDATE workouts SET completed = ? WHERE id = ?')
                .run(completed ? 1 : 0, log.workout_id);
        }
        res.json({ message: 'Log updated successfully' });
    }
    catch (error) {
        console.error('Update log error:', error);
        res.status(500).json({ error: 'Failed to update log' });
    }
});
// Delete a log
router.delete('/:id', auth_1.authenticateToken, (req, res) => {
    try {
        const logId = parseInt(req.params.id);
        // Verify ownership
        const log = database_1.default.prepare('SELECT * FROM run_logs WHERE id = ? AND user_id = ?')
            .get(logId, req.userId);
        if (!log) {
            return res.status(404).json({ error: 'Log not found' });
        }
        // Mark workout as not completed
        if (log.workout_id) {
            database_1.default.prepare('UPDATE workouts SET completed = 0 WHERE id = ?').run(log.workout_id);
        }
        database_1.default.prepare('DELETE FROM run_logs WHERE id = ?').run(logId);
        res.json({ message: 'Log deleted successfully' });
    }
    catch (error) {
        console.error('Delete log error:', error);
        res.status(500).json({ error: 'Failed to delete log' });
    }
});
exports.default = router;
//# sourceMappingURL=runLogs.js.map