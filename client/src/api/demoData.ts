// Demo mode data and utilities for GitHub Pages deployment
import { addDays, format, startOfWeek, addWeeks } from 'date-fns';

const DEMO_USER = {
  id: 1,
  email: 'demo@runny.app',
  name: 'Demo Runner',
  photo: null,
  isPublic: true,
};

const DEMO_GOAL = {
  id: 1,
  raceDistance: '10k',
  raceDate: format(addWeeks(new Date(), 10), 'yyyy-MM-dd'),
  targetTime: 50,
  experienceLevel: 'intermediate',
  currentFrequency: 3,
  longestRecentRun: 45,
  availableDays: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'],
  maxWeekdayTime: 60,
  maxWeekendTime: 90,
  isActive: true,
};

interface DemoWorkout {
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

function generateDemoWorkouts(): DemoWorkout[] {
  const workouts: DemoWorkout[] = [];
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const workoutTemplates = [
    { day: 1, type: 'easy', title: 'Easy Run', duration: 35, intensity: 'low', isKey: false, isLong: false },
    { day: 3, type: 'tempo', title: 'Tempo Run', duration: 45, intensity: 'moderate', isKey: true, isLong: false },
    { day: 5, type: 'easy', title: 'Easy Run', duration: 30, intensity: 'low', isKey: false, isLong: false },
    { day: 6, type: 'long', title: 'Long Run', duration: 60, intensity: 'low', isKey: true, isLong: true },
  ];

  workoutTemplates.forEach((template, index) => {
    workouts.push({
      id: index + 1,
      date: format(addDays(weekStart, template.day), 'yyyy-MM-dd'),
      weekNumber: 1,
      workoutType: template.type,
      title: template.title,
      description: getWorkoutDescription(template.type),
      durationMinutes: template.duration,
      intensity: template.intensity,
      tiredAlternative: 'Take it easy or rest if needed.',
      isKeyWorkout: template.isKey,
      isLongRun: template.isLong,
      completed: index < 2, // First two completed
    });
  });

  return workouts;
}

function getWorkoutDescription(type: string): string {
  switch (type) {
    case 'easy':
      return 'Run at a comfortable, conversational pace. You should be able to hold a conversation throughout.';
    case 'tempo':
      return 'Warm up for 10 minutes, then run at a "comfortably hard" pace for the main portion. Cool down for 10 minutes.';
    case 'long':
      return 'Your weekly long run. Start slow and maintain an easy, sustainable pace throughout. Focus on time on feet.';
    default:
      return 'Complete the workout as planned.';
  }
}

export const demoData = {
  user: DEMO_USER,
  goal: DEMO_GOAL,
  workouts: generateDemoWorkouts(),

  getThisWeek() {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return {
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
      weekNumber: 1,
      workouts: this.workouts,
      plan: {
        id: 1,
        raceDistance: DEMO_GOAL.raceDistance,
        raceDate: DEMO_GOAL.raceDate,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: DEMO_GOAL.raceDate,
      },
    };
  },

  getPlan() {
    return {
      plan: {
        id: 1,
        raceDistance: DEMO_GOAL.raceDistance,
        raceDate: DEMO_GOAL.raceDate,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: DEMO_GOAL.raceDate,
        availableDays: DEMO_GOAL.availableDays,
      },
      weeks: [
        { weekNumber: 1, workouts: this.workouts, totalMinutes: 170, completedCount: 2 },
        { weekNumber: 2, workouts: [], totalMinutes: 180, completedCount: 0 },
        { weekNumber: 3, workouts: [], totalMinutes: 190, completedCount: 0 },
      ],
    };
  },

  getProgressOverview() {
    return {
      totalRuns: 12,
      totalMinutes: 420,
      averageEffort: 5.5,
      averagePain: 1.2,
      planProgress: {
        raceDistance: DEMO_GOAL.raceDistance,
        raceDate: DEMO_GOAL.raceDate,
        totalWorkouts: 40,
        completedWorkouts: 12,
        completionRate: 30,
      },
    };
  },

  getWeeklyProgress() {
    return {
      weeks: [
        { weekStart: '2024-01-01', runCount: 3, totalMinutes: 90, avgEffort: 5, longestRun: 45 },
        { weekStart: '2024-01-08', runCount: 4, totalMinutes: 120, avgEffort: 5.5, longestRun: 50 },
        { weekStart: '2024-01-15', runCount: 3, totalMinutes: 100, avgEffort: 6, longestRun: 55 },
        { weekStart: '2024-01-22', runCount: 4, totalMinutes: 130, avgEffort: 5.5, longestRun: 60 },
      ],
    };
  },

  getCommunityFeed() {
    return {
      feed: [
        {
          id: 1,
          date: format(addDays(new Date(), -1), 'yyyy-MM-dd'),
          durationMinutes: 45,
          effortLevel: 6,
          user: { id: 2, name: 'Sarah Runner', photo: null },
          workout: { title: 'Tempo Run', type: 'tempo', isLongRun: false },
        },
        {
          id: 2,
          date: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
          durationMinutes: 60,
          effortLevel: 5,
          user: { id: 3, name: 'Mike Marathoner', photo: null },
          workout: { title: 'Long Run', type: 'long', isLongRun: true },
        },
      ],
    };
  },

  getDiscoverUsers() {
    return {
      users: [
        { id: 2, name: 'Sarah Runner', photo: null, recentRunCount: 8, recentMinutes: 320 },
        { id: 3, name: 'Mike Marathoner', photo: null, recentRunCount: 12, recentMinutes: 480 },
        { id: 4, name: 'Jane Jogger', photo: null, recentRunCount: 6, recentMinutes: 180 },
      ],
    };
  },
};

export function isDemoMode(): boolean {
  return import.meta.env.PROD && !import.meta.env.VITE_API_URL;
}
