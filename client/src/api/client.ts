import axios from 'axios';

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
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  signup: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  verify: () => api.get('/auth/verify'),
};

// Users API
export const usersApi = {
  getProfile: (id: number) => api.get(`/users/profile/${id}`),
  updateProfile: (data: { name?: string; isPublic?: boolean }) =>
    api.put('/users/profile', data),
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post('/users/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/users/password', data),
  searchUsers: (query: string) => api.get(`/users/search?q=${query}`),
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
  }) => api.post('/goals', data),
  getActive: () => api.get('/goals/active'),
  update: (id: number, data: {
    availableDays?: string[];
    maxWeekdayTime?: number;
    maxWeekendTime?: number;
  }) => api.put(`/goals/${id}`, data),
  delete: (id: number) => api.delete(`/goals/${id}`),
};

// Workouts API
export const workoutsApi = {
  getThisWeek: () => api.get('/workouts/this-week'),
  getPlan: () => api.get('/workouts/plan'),
  getWorkout: (id: number) => api.get(`/workouts/${id}`),
  rescheduleWeek: (availableDays: string[]) =>
    api.post('/workouts/reschedule-week', { availableDays }),
  getWeek: (weekNumber: number) => api.get(`/workouts/week/${weekNumber}`),
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
  }) => api.post('/runs', data),
  getLogs: (limit?: number, offset?: number) =>
    api.get(`/runs?limit=${limit || 20}&offset=${offset || 0}`),
  updateLog: (id: number, data: {
    completed?: boolean;
    durationMinutes?: number;
    effortLevel?: number;
    painLevel?: number;
    notes?: string;
  }) => api.put(`/runs/${id}`, data),
  deleteLog: (id: number) => api.delete(`/runs/${id}`),
};

// Progress API
export const progressApi = {
  getOverview: () => api.get('/progress/overview'),
  getWeekly: (weeks?: number) => api.get(`/progress/weekly?weeks=${weeks || 8}`),
  getLongRuns: () => api.get('/progress/long-runs'),
  getWorkoutTypes: () => api.get('/progress/workout-types'),
  checkAdjustment: () => api.post('/progress/check-adjustment'),
  getAdjustments: () => api.get('/progress/adjustments'),
  getRaceEstimate: () => api.get('/progress/race-estimate'),
};

// Community API
export const communityApi = {
  follow: (userId: number) => api.post(`/community/follow/${userId}`),
  unfollow: (userId: number) => api.delete(`/community/follow/${userId}`),
  getFollowers: () => api.get('/community/followers'),
  getFollowing: () => api.get('/community/following'),
  getFeed: (limit?: number, offset?: number) =>
    api.get(`/community/feed?limit=${limit || 20}&offset=${offset || 0}`),
  getWeeklySummaries: () => api.get('/community/weekly-summaries'),
  discover: (limit?: number) => api.get(`/community/discover?limit=${limit || 10}`),
};

export default api;
