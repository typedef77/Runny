import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { runLogsApi } from '../api/client';
import { format } from 'date-fns';
import './LogRun.css';

export default function LogRun() {
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [effortLevel, setEffortLevel] = useState(5);
  const [painLevel, setPainLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await runLogsApi.log({
        date,
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

  return (
    <div className="container log-run-page">
      <Link to="/this-week" className="back-link">&larr; Back to This Week</Link>

      <div className="card log-run-card">
        <h1>Log a Run</h1>
        <p className="text-light mb-3">Record an unplanned run or activity</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              required
            />
          </div>

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
              placeholder="How did it go? Any observations?"
            />
          </div>

          <div className="form-actions">
            <Link to="/this-week" className="btn btn-outline">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
