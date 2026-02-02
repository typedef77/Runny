import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workoutsApi, runLogsApi } from '../api/client';
import { format, parseISO } from 'date-fns';
import './Workout.css';

interface WorkoutData {
  id: number;
  date: string;
  weekNumber: number;
  workoutType: string;
  title: string;
  description: string;
  durationMinutes: number;
  intensity: string;
  tiredAlternative: string;
  isKeyWorkout: boolean;
  isLongRun: boolean;
  completed: boolean;
  log: {
    id: number;
    durationMinutes: number;
    effortLevel: number;
    painLevel: number;
    notes: string;
  } | null;
}

export default function Workout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Log form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [effortLevel, setEffortLevel] = useState(5);
  const [painLevel, setPainLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWorkout();
  }, [id]);

  const loadWorkout = async () => {
    try {
      const response = await workoutsApi.getWorkout(parseInt(id!));
      setWorkout(response.data);
      setDurationMinutes(response.data.durationMinutes);
    } catch (err) {
      setError('Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  const handleLogRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await runLogsApi.log({
        workoutId: workout!.id,
        completed: true,
        durationMinutes,
        effortLevel,
        painLevel,
        notes: notes || undefined,
      });
      navigate('/this-week');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to log run');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="container">
        <div className="card text-center">
          <p>Workout not found</p>
          <Link to="/this-week" className="btn btn-primary mt-2">
            Back to This Week
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container workout-page">
      <Link to="/this-week" className="back-link">&larr; Back to This Week</Link>

      {error && <div className="error-message">{error}</div>}

      <div className="workout-detail card">
        <div className="workout-detail-header">
          <div>
            <span className="workout-date-label">
              {format(parseISO(workout.date), 'EEEE, MMMM d')}
            </span>
            <h1>{workout.title}</h1>
          </div>
          <div className="workout-badges">
            {workout.isLongRun && (
              <span className="workout-type workout-long">Long Run</span>
            )}
            {workout.isKeyWorkout && !workout.isLongRun && (
              <span className="workout-type workout-tempo">Key Workout</span>
            )}
            <span className={`intensity-badge intensity-${workout.intensity}`}>
              {workout.intensity}
            </span>
          </div>
        </div>

        <div className="workout-stats">
          <div className="workout-stat">
            <span className="workout-stat-value">{workout.durationMinutes}</span>
            <span className="workout-stat-label">minutes</span>
          </div>
          <div className="workout-stat">
            <span className="workout-stat-value">{workout.intensity}</span>
            <span className="workout-stat-label">intensity</span>
          </div>
          <div className="workout-stat">
            <span className="workout-stat-value">Week {workout.weekNumber}</span>
            <span className="workout-stat-label">of training</span>
          </div>
        </div>

        <div className="workout-section">
          <h3>What to Do</h3>
          <p>{workout.description}</p>
        </div>

        {workout.tiredAlternative && (
          <div className="workout-section tired-section">
            <h3>If You're Tired</h3>
            <p>{workout.tiredAlternative}</p>
          </div>
        )}

        {workout.completed && workout.log ? (
          <div className="workout-section completed-section">
            <h3>Completed</h3>
            <div className="log-summary">
              <div className="log-stat">
                <span className="log-stat-label">Duration</span>
                <span className="log-stat-value">{workout.log.durationMinutes} min</span>
              </div>
              <div className="log-stat">
                <span className="log-stat-label">Effort</span>
                <span className="log-stat-value">{workout.log.effortLevel}/10</span>
              </div>
              {workout.log.painLevel > 0 && (
                <div className="log-stat">
                  <span className="log-stat-label">Pain</span>
                  <span className="log-stat-value">{workout.log.painLevel}/10</span>
                </div>
              )}
            </div>
            {workout.log.notes && (
              <p className="log-notes">"{workout.log.notes}"</p>
            )}
          </div>
        ) : (
          <div className="workout-actions">
            {showLogForm ? (
              <form onSubmit={handleLogRun} className="log-form">
                <h3>Log This Run</h3>

                <div className="form-group">
                  <label htmlFor="duration">Duration (minutes)</label>
                  <input
                    type="number"
                    id="duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                    min={1}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>How hard did it feel? ({effortLevel}/10)</label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={effortLevel}
                    onChange={(e) => setEffortLevel(parseInt(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>Easy</span>
                    <span>Hard</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Any pain? ({painLevel}/10)</label>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={painLevel}
                    onChange={(e) => setPainLevel(parseInt(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>None</span>
                    <span>Severe</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Notes (optional)</label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="How did it go?"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowLogForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save Run'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="btn btn-primary btn-large"
                onClick={() => setShowLogForm(true)}
              >
                Log This Run
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
