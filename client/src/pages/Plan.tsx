import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workoutsApi } from '../api/client';
import { format, parseISO } from 'date-fns';
import './Plan.css';

interface Workout {
  id: number;
  date: string;
  workoutType: string;
  title: string;
  description: string;
  durationMinutes: number;
  intensity: string;
  isKeyWorkout: boolean;
  isLongRun: boolean;
  completed: boolean;
}

interface Week {
  weekNumber: number;
  workouts: Workout[];
  totalMinutes: number;
  completedCount: number;
}

interface PlanData {
  plan: {
    id: number;
    raceDistance: string;
    raceDate: string;
    startDate: string;
    endDate: string;
    availableDays: string[];
  };
  weeks: Week[];
}

export default function Plan() {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    try {
      const response = await workoutsApi.getPlan();
      setPlanData(response.data);

      // Expand current week by default
      if (response.data.weeks.length > 0) {
        const now = new Date();
        const currentWeek = response.data.weeks.find((w: Week) =>
          w.workouts.some(workout => {
            const workoutDate = parseISO(workout.date);
            const weekStart = new Date(workoutDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            return now >= weekStart && now <= weekEnd;
          })
        );
        if (currentWeek) {
          setExpandedWeek(currentWeek.weekNumber);
        }
      }
    } catch (err) {
      setError('Failed to load training plan');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!planData || !planData.plan) {
    return (
      <div className="container">
        <div className="no-plan-card card text-center">
          <h2>No Active Training Plan</h2>
          <p className="text-light mb-3">Create a goal to get your personalized training plan.</p>
          <Link to="/create-goal" className="btn btn-primary">
            Create Your Goal
          </Link>
        </div>
      </div>
    );
  }

  const totalWeeks = planData.weeks.length;
  const totalWorkouts = planData.weeks.reduce((sum, w) => sum + w.workouts.length, 0);
  const completedWorkouts = planData.weeks.reduce((sum, w) => sum + w.completedCount, 0);

  return (
    <div className="container plan-page">
      {error && <div className="error-message">{error}</div>}

      <div className="plan-header">
        <div>
          <h1>Training Plan</h1>
          <p className="text-light">
            {planData.plan.raceDistance.toUpperCase()} - Race on{' '}
            {format(parseISO(planData.plan.raceDate), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      <div className="plan-summary">
        <div className="summary-stat">
          <span className="summary-value">{totalWeeks}</span>
          <span className="summary-label">Weeks</span>
        </div>
        <div className="summary-stat">
          <span className="summary-value">{completedWorkouts}/{totalWorkouts}</span>
          <span className="summary-label">Workouts Done</span>
        </div>
        <div className="summary-stat">
          <span className="summary-value">
            {Math.round((completedWorkouts / totalWorkouts) * 100)}%
          </span>
          <span className="summary-label">Complete</span>
        </div>
      </div>

      <div className="weeks-list">
        {planData.weeks.map(week => (
          <div key={week.weekNumber} className="week-card card">
            <button
              className="week-header-btn"
              onClick={() => setExpandedWeek(
                expandedWeek === week.weekNumber ? null : week.weekNumber
              )}
            >
              <div className="week-info">
                <h3>Week {week.weekNumber}</h3>
                <span className="week-meta">
                  {week.workouts.length} workouts · {week.totalMinutes} min
                </span>
              </div>
              <div className="week-progress">
                <span className="week-completion">
                  {week.completedCount}/{week.workouts.length}
                </span>
                <span className={`expand-icon ${expandedWeek === week.weekNumber ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>
            </button>

            {expandedWeek === week.weekNumber && (
              <div className="week-workouts">
                {week.workouts.map(workout => (
                  <Link
                    key={workout.id}
                    to={`/workout/${workout.id}`}
                    className={`week-workout ${workout.completed ? 'completed' : ''}`}
                  >
                    <span className="workout-date-mini">
                      {format(parseISO(workout.date), 'EEE d')}
                    </span>
                    <span className="workout-title-mini">{workout.title}</span>
                    <span className="workout-duration-mini">{workout.durationMinutes}m</span>
                    <span className={`workout-type workout-${workout.workoutType}`}>
                      {workout.workoutType}
                    </span>
                    {workout.completed && <span className="check-mark">✓</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
