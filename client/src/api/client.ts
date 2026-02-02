import axios from 'axios';
import { demoData, isDemoMode } from './demoData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      window.location.href = '/Runny/login';
    }
    return Promise.reject(error);
  }
);

// Demo mode wrapper
function demoResponse<T>(data: T) {
  return Promise.resolve({ data });
}

// Auth API
export const authApi = {
  signup: (data: { email: string; password: string; name: string }) => {
    if (isDemoMode()) {
      localStorage.setItem('token', 'demo-token');
      localStorage.setItem('demoUser', JSON.stringify({ ...demoData.user, name: data.name, email: data.email }));
      return demoResponse({ token: 'demo-token', user: { ...demoData.user, name: data.name, email: data.email } });
    }
    return api.post('/auth/signup', data);
  },
  login: (data: { email: string; password: string }) => {
    if (isDemoMode()) {
      localStorage.setItem('token', 'demo-token');
      return demoResponse({ token: 'demo-token', user: demoData.user });
    }
    return api.post('/auth/login', data);
  },
  getMe: () => {
    if (isDemoMode()) {
      const savedUser = localStorage.getItem('demoUser');
      return demoResponse(savedUser ? JSON.parse(savedUser) : demoData.user);
    }
    return api.get('/auth/me');
  },
  verify: () => {
    if (isDemoMode()) {
      return demoResponse({ valid: true, userId: 1 });
    }
    return api.get('/auth/verify');
  },
};

// Users API
export const usersApi = {
  getProfile: (id: number) => {
    if (isDemoMode()) {
      return demoResponse({
        ...demoData.user,
        id,
        followerCount: 5,
        followingCount: 3,
        isFollowing: false,
        isOwnProfile: id === 1,
        recentRuns: [],
      });
    }
    return api.get(`/users/profile/${id}`);
  },
  updateProfile: (data: { name?: string; isPublic?: boolean }) => {
    if (isDemoMode()) {
      const savedUser = localStorage.getItem('demoUser');
      const user = savedUser ? JSON.parse(savedUser) : demoData.user;
      const updated = { ...user, ...data };
      localStorage.setItem('demoUser', JSON.stringify(updated));
      return demoResponse(updated);
    }
    return api.put('/users/profile', data);
  },
  uploadPhoto: (file: File) => {
    if (isDemoMode()) {
      return demoResponse({ photo: URL.createObjectURL(file) });
    }
    const formData = new FormData();
    formData.append('photo', file);
    return api.post('/users/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  changePassword: (data: { currentPassword: string; newPassword: string }) => {
    if (isDemoMode()) {
      return demoResponse({ message: 'Password updated' });
    }
    return api.put('/users/password', data);
  },
  searchUsers: (query: string) => {
    if (isDemoMode()) {
      const users = demoData.getDiscoverUsers().users.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase())
      );
      return demoResponse(users);
    }
    return api.get(`/users/search?q=${query}`);
  },
};

// Goals API
export const goalsApi = {
  create: (data: {
    raceDistance: string;
    raceDate: string;
    targetTime?: number;
    experienceLevel: string;
    currentFrequency: number;
    longestRecentRun: number;
    availableDays: string[];
    maxWeekdayTime: number;
    maxWeekendTime: number;
  }) => {
    if (isDemoMode()) {
      const goal = { ...demoData.goal, ...data, id: 1 };
      localStorage.setItem('demoGoal', JSON.stringify(goal));
      return demoResponse({ goal, planId: 1 });
    }
    return api.post('/goals', data);
  },
  getActive: () => {
    if (isDemoMode()) {
      const savedGoal = localStorage.getItem('demoGoal');
      const goal = savedGoal ? JSON.parse(savedGoal) : demoData.goal;
      return demoResponse({ goal, plan: { id: 1, startDate: new Date().toISOString(), endDate: goal.raceDate } });
    }
    return api.get('/goals/active');
  },
  update: (id: number, data: {
    availableDays?: string[];
    maxWeekdayTime?: number;
    maxWeekendTime?: number;
  }) => {
    if (isDemoMode()) {
      const savedGoal = localStorage.getItem('demoGoal');
      const goal = savedGoal ? JSON.parse(savedGoal) : demoData.goal;
      const updated = { ...goal, ...data };
      localStorage.setItem('demoGoal', JSON.stringify(updated));
      return demoResponse({ goal: updated, planId: 1 });
    }
    return api.put(`/goals/${id}`, data);
  },
  delete: (id: number) => {
    if (isDemoMode()) {
      localStorage.removeItem('demoGoal');
      return demoResponse({ message: 'Goal deleted' });
    }
    return api.delete(`/goals/${id}`);
  },
};

// Workouts API
export const workoutsApi = {
  getThisWeek: () => {
    if (isDemoMode()) {
      return demoResponse(demoData.getThisWeek());
    }
    return api.get('/workouts/this-week');
  },
  getPlan: () => {
    if (isDemoMode()) {
      return demoResponse(demoData.getPlan());
    }
    return api.get('/workouts/plan');
  },
  getWorkout: (id: number) => {
    if (isDemoMode()) {
      const workout = demoData.workouts.find(w => w.id === id) || demoData.workouts[0];
      return demoResponse(workout);
    }
    return api.get(`/workouts/${id}`);
  },
  rescheduleWeek: (availableDays: string[]) => {
    if (isDemoMode()) {
      return demoResponse({ message: 'Week rescheduled' });
    }
    return api.post('/workouts/reschedule-week', { availableDays });
  },
  getWeek: (weekNumber: number) => {
    if (isDemoMode()) {
      return demoResponse({ weekNumber, workouts: demoData.workouts, totalMinutes: 170 });
    }
    return api.get(`/workouts/week/${weekNumber}`);
  },
};

// Run Logs API
export const runLogsApi = {
  log: (data: {
    workoutId?: number;
    completed?: boolean;
    durationMinutes: number;
    effortLevel: number;
    painLevel?: number;
    notes?: string;
    date?: string;
  }) => {
    if (isDemoMode()) {
      return demoResponse({ message: 'Run logged', logId: Date.now() });
    }
    return api.post('/runs', data);
  },
  getLogs: (limit?: number, offset?: number) => {
    if (isDemoMode()) {
      return demoResponse({ logs: [], total: 0, hasMore: false });
    }
    return api.get(`/runs?limit=${limit || 20}&offset=${offset || 0}`);
  },
  updateLog: (id: number, data: {
    completed?: boolean;
    durationMinutes?: number;
    effortLevel?: number;
    painLevel?: number;
    notes?: string;
  }) => {
    if (isDemoMode()) {
      return demoResponse({ message: 'Log updated' });
    }
    return api.put(`/runs/${id}`, data);
  },
  deleteLog: (id: number) => {
    if (isDemoMode()) {
      return demoResponse({ message: 'Log deleted' });
    }
    return api.delete(`/runs/${id}`);
  },
};

// Progress API
export const progressApi = {
  getOverview: () => {
    if (isDemoMode()) {
      return demoResponse(demoData.getProgressOverview());
    }
    return api.get('/progress/overview');
  },
  getWeekly: (weeks?: number) => {
    if (isDemoMode()) {
      return demoResponse(demoData.getWeeklyProgress());
    }
    return api.get(`/progress/weekly?weeks=${weeks || 8}`);
  },
  getLongRuns: () => {
    if (isDemoMode()) {
      return demoResponse({ longRuns: [] });
    }
    return api.get('/progress/long-runs');
  },
  getWorkoutTypes: () => {
    if (isDemoMode()) {
      return demoResponse({ breakdown: [] });
    }
    return api.get('/progress/workout-types');
  },
  checkAdjustment: () => {
    if (isDemoMode()) {
      return demoResponse({ adjustmentApplied: false, recommendation: null });
    }
    return api.post('/progress/check-adjustment');
  },
  getAdjustments: () => {
    if (isDemoMode()) {
      return demoResponse({ adjustments: [] });
    }
    return api.get('/progress/adjustments');
  },
  getRaceEstimate: () => {
    if (isDemoMode()) {
      return demoResponse({ estimate: null });
    }
    return api.get('/progress/race-estimate');
  },
};

// Community API
export const communityApi = {
  follow: (userId: number) => {
    if (isDemoMode()) {
      return demoResponse({ message: 'Now following user' });
    }
    return api.post(`/community/follow/${userId}`);
  },
  unfollow: (userId: number) => {
    if (isDemoMode()) {
      return demoResponse({ message: 'Unfollowed user' });
    }
    return api.delete(`/community/follow/${userId}`);
  },
  getFollowers: () => {
    if (isDemoMode()) {
      return demoResponse({ followers: [] });
    }
    return api.get('/community/followers');
  },
  getFollowing: () => {
    if (isDemoMode()) {
      return demoResponse({ following: [] });
    }
    return api.get('/community/following');
  },
  getFeed: (limit?: number, offset?: number) => {
    if (isDemoMode()) {
      return demoResponse(demoData.getCommunityFeed());
    }
    return api.get(`/community/feed?limit=${limit || 20}&offset=${offset || 0}`);
  },
  getWeeklySummaries: () => {
    if (isDemoMode()) {
      return demoResponse({ summaries: [] });
    }
    return api.get('/community/weekly-summaries');
  },
  discover: (limit?: number) => {
    if (isDemoMode()) {
      return demoResponse(demoData.getDiscoverUsers());
    }
    return api.get(`/community/discover?limit=${limit || 10}`);
  },
};

export default api;
