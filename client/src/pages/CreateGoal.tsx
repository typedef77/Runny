import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { goalsApi } from '../api/client';
import './CreateGoal.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function CreateGoal() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Goal data
  const [raceDistance, setRaceDistance] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [currentFrequency, setCurrentFrequency] = useState(3);
  const [longestRecentRun, setLongestRecentRun] = useState(30);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [maxWeekdayTime, setMaxWeekdayTime] = useState(60);
  const [maxWeekendTime, setMaxWeekendTime] = useState(90);

  const toggleDay = (day: string) => {
    setAvailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      await goalsApi.create({
        raceDistance,
        raceDate,
        targetTime: targetTime ? parseInt(targetTime) : undefined,
        experienceLevel,
        currentFrequency,
        longestRecentRun,
        availableDays,
        maxWeekdayTime,
        maxWeekendTime,
      });
      navigate('/this-week');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create goal. Please try again.');
      setLoading(false);
    }
  };

  const canProceedStep1 = raceDistance && raceDate;
  const canProceedStep2 = experienceLevel;
  const canProceedStep3 = availableDays.length >= 2;

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="create-goal-page">
      <div className="create-goal-card card">
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className="step-line" />
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className="step-line" />
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {step === 1 && (
          <div className="step-content">
            <h2>What's Your Goal?</h2>
            <p className="text-light mb-3">Tell us about your upcoming race</p>

            <div className="form-group">
              <label>Race Distance</label>
              <div className="distance-grid">
                {[
                  { value: '5k', label: '5K' },
                  { value: '10k', label: '10K' },
                  { value: 'half', label: 'Half Marathon' },
                  { value: 'marathon', label: 'Marathon' },
                ].map(d => (
                  <button
                    key={d.value}
                    type="button"
                    className={`distance-btn ${raceDistance === d.value ? 'selected' : ''}`}
                    onClick={() => setRaceDistance(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="raceDate">Race Date</label>
              <input
                type="date"
                id="raceDate"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                min={today}
              />
            </div>

            <div className="form-group">
              <label htmlFor="targetTime">Target Time (optional, in minutes)</label>
              <input
                type="number"
                id="targetTime"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                placeholder="e.g., 30 for a 30-minute 5K"
              />
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <h2>Your Running Background</h2>
            <p className="text-light mb-3">Help us understand your current fitness</p>

            <div className="form-group">
              <label>Experience Level</label>
              <div className="experience-grid">
                {[
                  { value: 'beginner', label: 'Beginner', desc: 'New to running or returning after a break' },
                  { value: 'intermediate', label: 'Intermediate', desc: 'Running consistently for 6+ months' },
                  { value: 'advanced', label: 'Advanced', desc: 'Experienced runner, 2+ years' },
                ].map(e => (
                  <button
                    key={e.value}
                    type="button"
                    className={`experience-btn ${experienceLevel === e.value ? 'selected' : ''}`}
                    onClick={() => setExperienceLevel(e.value)}
                  >
                    <span className="experience-label">{e.label}</span>
                    <span className="experience-desc">{e.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="currentFrequency">
                How many times per week do you currently run?
              </label>
              <select
                id="currentFrequency"
                value={currentFrequency}
                onChange={(e) => setCurrentFrequency(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'time' : 'times'} per week</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="longestRecentRun">
                Longest run in the past 2 weeks (minutes)
              </label>
              <input
                type="number"
                id="longestRecentRun"
                value={longestRecentRun}
                onChange={(e) => setLongestRecentRun(parseInt(e.target.value))}
                min={10}
                max={180}
              />
            </div>

            <div className="step-buttons">
              <button className="btn btn-outline" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-content">
            <h2>Your Schedule</h2>
            <p className="text-light mb-3">When can you run each week?</p>

            <div className="form-group">
              <label>Available Days (select at least 2)</label>
              <div className="days-grid">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    className={`day-btn ${availableDays.includes(day) ? 'selected' : ''}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="maxWeekdayTime">
                Maximum time on weekdays (minutes)
              </label>
              <input
                type="number"
                id="maxWeekdayTime"
                value={maxWeekdayTime}
                onChange={(e) => setMaxWeekdayTime(parseInt(e.target.value))}
                min={20}
                max={120}
              />
            </div>

            <div className="form-group">
              <label htmlFor="maxWeekendTime">
                Maximum time on weekends (minutes)
              </label>
              <input
                type="number"
                id="maxWeekendTime"
                value={maxWeekendTime}
                onChange={(e) => setMaxWeekendTime(parseInt(e.target.value))}
                min={30}
                max={180}
              />
            </div>

            <div className="step-buttons">
              <button className="btn btn-outline" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!canProceedStep3 || loading}
              >
                {loading ? 'Creating Plan...' : 'Create My Plan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
