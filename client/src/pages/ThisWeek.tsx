import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { workoutsApi, goalsApi } from '../api/client';
import { format, parseISO, isToday, isPast } from 'date-fns';
import './ThisWeek.css';

interface Workout {
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
}

interface WeekData {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  workouts: Workout[];
  plan: {
    id: number;
    raceDistance: string;
    raceDate: string;
    startDate: string;
    endDate: string;
  } | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ThisWeek() {
  const navigate = useNavigate();
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    loadWeekData();
  }, []);

  const loadWeekData = async () => {
    try {
      const response = await workoutsApi.getThisWeek();
      setWeekData(response.data);

      // Load current available days from goal
      const goalResponse = await goalsApi.getActive();
      if (goalResponse.data.goal) {
        setSelectedDays(goalResponse.data.goal.availableDays);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        navigate('/create-goal');
      } else {
        setError('Failed to load workout data');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleReschedule = async () => {
    if (selectedDays.length < 2) {
      alert('Please select at least 2 days');
      return;
    }

    setRescheduling(true);
    try {
      await workoutsApi.rescheduleWeek(selectedDays);
      await loadWeekData();
      setShowReschedule(false);
    } catch (err) {
      setError('Failed to reschedule week');
    } finally {
      setRescheduling(false);
    }
  };

  const getWorkoutStatus = (workout: Workout) => {
    if (workout.completed) return 'completed';
    const workoutDate = parseISO(workout.date);
    if (isPast(workoutDate) && !isToday(workoutDate)) return 'missed';
    if (isToday(workoutDate)) return 'today';
    return 'upcoming';
  };

  if (loading) {
    return (
      <div className="container loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!weekData || !weekData.plan) {
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

  const completedCount = weekData.workouts.filter(w => w.completed).length;
  const totalMinutes = weekData.workouts.reduce((sum, w) => sum + w.durationMinutes, 0);
  const daysToRace = Math.ceil(
    (new Date(weekData.plan.raceDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="container this-week-page">
      {error && <div className="error-message">{error}</div>}

      <div className="week-header">
        <div>
          <h1>This Week</h1>
          <p className="text-light">
            Week {weekData.weekNumber} of your {weekData.plan.raceDistance.toUpperCase()} training
            {daysToRace > 0 && ` - ${daysToRace} days to race`}
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setShowReschedule(!showReschedule)}
        >
          Reschedule Week
        </button>
      </div>

      {showReschedule && (
        <div className="reschedule-panel card">
          <h3>Reschedule This Week</h3>
          <p className="text-light mb-2">Select the days you can run this week:</p>
          <div className="days-grid">
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                className={`day-btn ${selectedDays.includes(day) ? 'selected' : ''}`}
                onClick={() => toggleDay(day)}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="reschedule-actions">
            <button
              className="btn btn-outline"
              onClick={() => setShowReschedule(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleReschedule}
              disabled={selectedDays.length < 2 || rescheduling}
            >
              {rescheduling ? 'Rescheduling...' : 'Apply Changes'}
            </button>
          </div>
        </div>
      )}

      <div className="week-stats">
        <div className="stat-card card">
          <span className="stat-value">{completedCount}/{weekData.workouts.length}</span>
          <span className="stat-label">Workouts Completed</span>
        </div>
        <div className="stat-card card">
          <span className="stat-value">{totalMinutes}</span>
          <span className="stat-label">Planned Minutes</span>
        </div>
        <div className="stat-card card">
          <span className="stat-value">{daysToRace}</span>
          <span className="stat-label">Days to Race</span>
        </div>
      </div>

      <div className="workouts-list">
        {weekData.workouts.length === 0 ? (
          <div className="card text-center">
            <p className="text-light">No workouts scheduled for this week.</p>
          </div>
        ) : (
          weekData.workouts.map(workout => {
            const status = getWorkoutStatus(workout);
            return (
              <Link
                key={workout.id}
                to={`/workout/${workout.id}`}
                className={`workout-card card status-${status}`}
              >
                <div className="workout-date">
                  <span className="workout-day">
                    {format(parseISO(workout.date), 'EEE')}
                  </span>
                  <span className="workout-date-num">
                    {format(parseISO(workout.date), 'd')}
                  </span>
                </div>
                <div className="workout-info">
                  <div className="workout-header">
                    <h3>{workout.title}</h3>
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
                  <p className="workout-desc">{workout.description}</p>
                  <div className="workout-meta">
                    <span>{workout.durationMinutes} min</span>
                    {status === 'completed' && <span className="completed-badge">Completed</span>}
                    {status === 'today' && <span className="today-badge">Today</span>}
                    {status === 'missed' && <span className="missed-badge">Missed</span>}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="quick-actions">
        <Link to="/log-run" className="btn btn-primary">
          Log a Run
        </Link>
        <Link to="/plan" className="btn btn-outline">
          View Full Plan
        </Link>
      </div>
    </div>
  );
}
