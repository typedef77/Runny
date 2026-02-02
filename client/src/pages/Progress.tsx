import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { progressApi } from '../api/client';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import './Progress.css';

interface Overview {
  totalRuns: number;
  totalMinutes: number;
  averageEffort: number;
  averagePain: number;
  planProgress: {
    raceDistance: string;
    raceDate: string;
    totalWorkouts: number;
    completedWorkouts: number;
    completionRate: number;
  } | null;
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  runCount: number;
  totalMinutes: number;
  avgEffort: number;
  longestRun: number;
  plannedWorkouts: number;
  completedWorkouts: number;
}

interface LongRun {
  date: string;
  durationMinutes: number;
  effortLevel: number;
  title: string;
}

export default function Progress() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [longRuns, setLongRuns] = useState<LongRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [overviewRes, weeklyRes, longRunsRes] = await Promise.all([
        progressApi.getOverview(),
        progressApi.getWeekly(8),
        progressApi.getLongRuns(),
      ]);

      setOverview(overviewRes.data);
      setWeeklyData(weeklyRes.data.weeks);
      setLongRuns(longRunsRes.data.longRuns);
    } catch (err) {
      setError('Failed to load progress data');
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

  const chartData = weeklyData.map(w => ({
    name: format(parseISO(w.weekStart), 'MMM d'),
    minutes: w.totalMinutes,
    runs: w.runCount,
    effort: w.avgEffort,
    longestRun: w.longestRun,
  }));

  const longRunChartData = longRuns.map(r => ({
    date: format(parseISO(r.date), 'MMM d'),
    duration: r.durationMinutes,
  }));

  return (
    <div className="container progress-page">
      {error && <div className="error-message">{error}</div>}

      <h1>Progress</h1>
      <p className="text-light mb-3">Track your training journey</p>

      {overview && (
        <div className="overview-grid">
          <div className="overview-card card">
            <span className="overview-value">{overview.totalRuns}</span>
            <span className="overview-label">Total Runs</span>
          </div>
          <div className="overview-card card">
            <span className="overview-value">{Math.round(overview.totalMinutes / 60)}h</span>
            <span className="overview-label">Total Time</span>
          </div>
          <div className="overview-card card">
            <span className="overview-value">{overview.averageEffort.toFixed(1)}</span>
            <span className="overview-label">Avg Effort</span>
          </div>
          {overview.planProgress && (
            <div className="overview-card card">
              <span className="overview-value">{overview.planProgress.completionRate}%</span>
              <span className="overview-label">Plan Complete</span>
            </div>
          )}
        </div>
      )}

      {chartData.length > 0 && (
        <>
          <div className="chart-section card">
            <h3>Weekly Training Volume</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="minutes" fill="#10b981" name="Minutes" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-section card">
            <h3>Weekly Runs & Effort</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="runs"
                    stroke="#6366f1"
                    name="Runs"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="effort"
                    stroke="#f59e0b"
                    name="Avg Effort"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {longRunChartData.length > 0 && (
        <div className="chart-section card">
          <h3>Long Run Progression</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={longRunChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="#10b981"
                  name="Duration (min)"
                  strokeWidth={2}
                  dot={{ fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="no-data card text-center">
          <p className="text-light">No training data yet. Start logging your runs!</p>
          <Link to="/this-week" className="btn btn-primary mt-2">
            View This Week
          </Link>
        </div>
      )}
    </div>
  );
}
