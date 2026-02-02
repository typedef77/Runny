import db from '../database';
import { addDays, differenceInWeeks, format, parseISO, startOfWeek, addWeeks, getDay } from 'date-fns';

interface Goal {
  id: number;
  user_id: number;
  race_distance: string;
  race_date: string;
  target_time: number | null;
  experience_level: string;
  current_frequency: number;
  longest_recent_run: number;
  available_days: string;
  max_weekday_time: number;
  max_weekend_time: number;
}

interface WorkoutTemplate {
  type: 'easy' | 'tempo' | 'interval' | 'long' | 'rest';
  title: string;
  description: string;
  durationMultiplier: number;
  intensity: 'low' | 'moderate' | 'high';
  isKeyWorkout: boolean;
  isLongRun: boolean;
  tiredAlternative: string;
}

// Race distance configurations
const RACE_CONFIGS = {
  '5k': { baseWeeks: 8, peakLongRun: 45, peakWeeklyMinutes: 150 },
  '10k': { baseWeeks: 10, peakLongRun: 60, peakWeeklyMinutes: 200 },
  'half': { baseWeeks: 12, peakLongRun: 90, peakWeeklyMinutes: 280 },
  'marathon': { baseWeeks: 16, peakLongRun: 150, peakWeeklyMinutes: 360 }
};

// Experience level multipliers
const EXPERIENCE_MULTIPLIERS = {
  'beginner': 0.7,
  'intermediate': 1.0,
  'advanced': 1.3
};

// Day name to number mapping (0 = Sunday)
const DAY_MAP: { [key: string]: number } = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};

function getWorkoutTemplates(experienceLevel: string, weekPhase: 'build' | 'peak' | 'taper'): WorkoutTemplate[] {
  const isAdvanced = experienceLevel === 'advanced';
  const isBeginner = experienceLevel === 'beginner';

  const templates: WorkoutTemplate[] = [
    {
      type: 'easy',
      title: 'Easy Run',
      description: 'Run at a comfortable, conversational pace. You should be able to hold a conversation throughout.',
      durationMultiplier: 1.0,
      intensity: 'low',
      isKeyWorkout: false,
      isLongRun: false,
      tiredAlternative: 'Take a complete rest day or do a 20-minute walk instead.'
    },
    {
      type: 'long',
      title: 'Long Run',
      description: 'Your weekly long run. Start slow and maintain an easy, sustainable pace throughout. Focus on time on feet.',
      durationMultiplier: 1.5,
      intensity: 'low',
      isKeyWorkout: true,
      isLongRun: true,
      tiredAlternative: 'Reduce duration by 20-30% but still complete the run at an easy effort.'
    }
  ];

  // Add harder workouts for non-beginners
  if (!isBeginner) {
    templates.push({
      type: 'tempo',
      title: 'Tempo Run',
      description: 'Warm up for 10 minutes, then run at a "comfortably hard" pace for the main portion. Cool down for 10 minutes.',
      durationMultiplier: 1.1,
      intensity: 'moderate',
      isKeyWorkout: true,
      isLongRun: false,
      tiredAlternative: 'Convert to an easy run at the same duration.'
    });
  }

  // Add intervals for intermediate and advanced
  if (isAdvanced || (experienceLevel === 'intermediate' && weekPhase === 'peak')) {
    templates.push({
      type: 'interval',
      title: 'Interval Training',
      description: 'Warm up 10 minutes. Run hard efforts with recovery jogs between. Intensity should be challenging but controlled.',
      durationMultiplier: 0.9,
      intensity: 'high',
      isKeyWorkout: true,
      isLongRun: false,
      tiredAlternative: 'Reduce the number of intervals by half, or convert to a tempo run.'
    });
  }

  return templates;
}

function calculateWeeklyVolume(
  weekNumber: number,
  totalWeeks: number,
  raceConfig: typeof RACE_CONFIGS['5k'],
  experienceMultiplier: number,
  currentFrequency: number,
  longestRecentRun: number
): number {
  // Determine phase
  const buildPhaseEnd = Math.floor(totalWeeks * 0.6);
  const peakPhaseEnd = Math.floor(totalWeeks * 0.85);

  let baseVolume: number;

  if (weekNumber <= buildPhaseEnd) {
    // Build phase: gradual increase
    const progress = weekNumber / buildPhaseEnd;
    const startVolume = Math.max(currentFrequency * 30, longestRecentRun * 2);
    baseVolume = startVolume + (raceConfig.peakWeeklyMinutes * 0.7 - startVolume) * progress;
  } else if (weekNumber <= peakPhaseEnd) {
    // Peak phase: maintain high volume with slight increases
    const progress = (weekNumber - buildPhaseEnd) / (peakPhaseEnd - buildPhaseEnd);
    baseVolume = raceConfig.peakWeeklyMinutes * (0.7 + 0.3 * progress);
  } else {
    // Taper phase: reduce volume
    const weeksToRace = totalWeeks - weekNumber;
    const taperMultiplier = 0.4 + (weeksToRace / (totalWeeks - peakPhaseEnd)) * 0.4;
    baseVolume = raceConfig.peakWeeklyMinutes * taperMultiplier;
  }

  // Apply experience multiplier
  baseVolume *= experienceMultiplier;

  // Limit weekly increase to 10% from previous week base
  const previousWeekVolume = weekNumber > 1
    ? calculateWeeklyVolume(weekNumber - 1, totalWeeks, raceConfig, experienceMultiplier, currentFrequency, longestRecentRun)
    : currentFrequency * 30;

  return Math.min(baseVolume, previousWeekVolume * 1.1);
}

export function generateTrainingPlan(goal: Goal): number {
  const availableDays = JSON.parse(goal.available_days) as string[];
  const raceDate = parseISO(goal.race_date);
  const today = new Date();
  const totalWeeks = Math.max(1, differenceInWeeks(raceDate, today));

  const raceConfig = RACE_CONFIGS[goal.race_distance as keyof typeof RACE_CONFIGS] || RACE_CONFIGS['5k'];
  const experienceMultiplier = EXPERIENCE_MULTIPLIERS[goal.experience_level as keyof typeof EXPERIENCE_MULTIPLIERS] || 1.0;

  // Create the training plan
  const planResult = db.prepare(`
    INSERT INTO training_plans (goal_id, user_id, start_date, end_date)
    VALUES (?, ?, ?, ?)
  `).run(goal.id, goal.user_id, format(today, 'yyyy-MM-dd'), goal.race_date);

  const planId = planResult.lastInsertRowid as number;

  // Generate workouts for each week
  for (let week = 1; week <= totalWeeks; week++) {
    const weekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), week - 1);
    const weeklyVolume = calculateWeeklyVolume(
      week, totalWeeks, raceConfig, experienceMultiplier,
      goal.current_frequency, goal.longest_recent_run
    );

    generateWeekWorkouts(
      planId,
      goal.user_id,
      week,
      weekStart,
      availableDays,
      weeklyVolume,
      goal.experience_level,
      goal.max_weekday_time,
      goal.max_weekend_time,
      week <= totalWeeks * 0.6 ? 'build' : (week <= totalWeeks * 0.85 ? 'peak' : 'taper')
    );
  }

  return planId;
}

function generateWeekWorkouts(
  planId: number,
  userId: number,
  weekNumber: number,
  weekStart: Date,
  availableDays: string[],
  weeklyVolume: number,
  experienceLevel: string,
  maxWeekdayTime: number,
  maxWeekendTime: number,
  phase: 'build' | 'peak' | 'taper'
): void {
  const templates = getWorkoutTemplates(experienceLevel, phase);
  const dayNumbers = availableDays.map(d => DAY_MAP[d.toLowerCase()]).filter(d => d !== undefined);

  if (dayNumbers.length === 0) return;

  // Sort days to find weekends
  const weekendDays = dayNumbers.filter(d => d === 0 || d === 6);
  const weekdayDays = dayNumbers.filter(d => d !== 0 && d !== 6);

  // Assign long run to a weekend day if available, otherwise last available day
  const longRunDay = weekendDays.length > 0
    ? Math.max(...weekendDays)
    : Math.max(...dayNumbers);

  // Find a day for tempo/interval (not adjacent to long run if possible)
  const keyWorkoutCandidates = dayNumbers.filter(d =>
    d !== longRunDay &&
    Math.abs(d - longRunDay) > 1 &&
    Math.abs(d - longRunDay) !== 6 // Handle week wrap
  );
  const keyWorkoutDay = keyWorkoutCandidates.length > 0
    ? keyWorkoutCandidates[Math.floor(keyWorkoutCandidates.length / 2)]
    : dayNumbers.find(d => d !== longRunDay);

  // Calculate workout durations
  const longRunTemplate = templates.find(t => t.type === 'long')!;
  const longRunDuration = Math.min(
    Math.round(weeklyVolume * 0.35),
    longRunDay === 0 || longRunDay === 6 ? maxWeekendTime : maxWeekdayTime
  );

  let remainingVolume = weeklyVolume - longRunDuration;
  const easyDays = dayNumbers.filter(d => d !== longRunDay && d !== keyWorkoutDay);

  // Prepare workout insertions
  const insertWorkout = db.prepare(`
    INSERT INTO workouts (
      plan_id, user_id, date, week_number, workout_type, title,
      description, duration_minutes, intensity, tired_alternative,
      is_key_workout, is_long_run
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert long run
  const longRunDate = addDays(weekStart, longRunDay === 0 ? 6 : longRunDay - 1);
  insertWorkout.run(
    planId, userId, format(longRunDate, 'yyyy-MM-dd'), weekNumber,
    'long', longRunTemplate.title, longRunTemplate.description,
    longRunDuration, longRunTemplate.intensity, longRunTemplate.tiredAlternative,
    1, 1
  );

  // Insert key workout if applicable and we have a day for it
  if (keyWorkoutDay !== undefined && experienceLevel !== 'beginner') {
    const keyTemplate = templates.find(t => t.type === 'tempo' || t.type === 'interval') || templates[0];
    const keyWorkoutDuration = Math.min(
      Math.round(remainingVolume * 0.3),
      keyWorkoutDay === 0 || keyWorkoutDay === 6 ? maxWeekendTime : maxWeekdayTime
    );

    const keyWorkoutDate = addDays(weekStart, keyWorkoutDay === 0 ? 6 : keyWorkoutDay - 1);
    insertWorkout.run(
      planId, userId, format(keyWorkoutDate, 'yyyy-MM-dd'), weekNumber,
      keyTemplate.type, keyTemplate.title, keyTemplate.description,
      keyWorkoutDuration, keyTemplate.intensity, keyTemplate.tiredAlternative,
      1, 0
    );
    remainingVolume -= keyWorkoutDuration;
  }

  // Distribute remaining volume to easy days
  const easyTemplate = templates.find(t => t.type === 'easy')!;
  const easyRunCount = easyDays.length;

  if (easyRunCount > 0) {
    const easyRunDuration = Math.round(remainingVolume / easyRunCount);

    easyDays.forEach(day => {
      const maxTime = day === 0 || day === 6 ? maxWeekendTime : maxWeekdayTime;
      const duration = Math.min(easyRunDuration, maxTime);
      const workoutDate = addDays(weekStart, day === 0 ? 6 : day - 1);

      insertWorkout.run(
        planId, userId, format(workoutDate, 'yyyy-MM-dd'), weekNumber,
        'easy', easyTemplate.title, easyTemplate.description,
        duration, easyTemplate.intensity, easyTemplate.tiredAlternative,
        0, 0
      );
    });
  }
}

export function rescheduleWeek(planId: number, userId: number, weekNumber: number, newAvailableDays: string[]): void {
  // Get the current week's workouts
  const workouts = db.prepare(`
    SELECT * FROM workouts WHERE plan_id = ? AND user_id = ? AND week_number = ?
  `).all(planId, userId, weekNumber) as any[];

  if (workouts.length === 0) return;

  // Find the long run and key workout
  const longRun = workouts.find(w => w.is_long_run === 1);
  const keyWorkout = workouts.find(w => w.is_key_workout === 1 && w.is_long_run === 0);
  const easyRuns = workouts.filter(w => w.is_key_workout === 0 && w.is_long_run === 0);

  // Get week start date from existing workouts
  const firstWorkoutDate = parseISO(workouts[0].date);
  const weekStart = startOfWeek(firstWorkoutDate, { weekStartsOn: 1 });

  // Delete existing workouts for this week
  db.prepare(`
    DELETE FROM workouts WHERE plan_id = ? AND user_id = ? AND week_number = ?
  `).run(planId, userId, weekNumber);

  // Map new available days
  const dayNumbers = newAvailableDays.map(d => DAY_MAP[d.toLowerCase()]).filter(d => d !== undefined);
  if (dayNumbers.length === 0) return;

  const weekendDays = dayNumbers.filter(d => d === 0 || d === 6);
  const weekdayDays = dayNumbers.filter(d => d !== 0 && d !== 6);

  // Prioritize keeping long run and key workout
  const insertWorkout = db.prepare(`
    INSERT INTO workouts (
      plan_id, user_id, date, week_number, workout_type, title,
      description, duration_minutes, intensity, tired_alternative,
      is_key_workout, is_long_run
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let usedDays: number[] = [];

  // Place long run (prefer weekend)
  if (longRun) {
    const longRunDay = weekendDays.length > 0
      ? Math.max(...weekendDays)
      : Math.max(...dayNumbers);

    const longRunDate = addDays(weekStart, longRunDay === 0 ? 6 : longRunDay - 1);
    insertWorkout.run(
      planId, userId, format(longRunDate, 'yyyy-MM-dd'), weekNumber,
      longRun.workout_type, longRun.title, longRun.description,
      longRun.duration_minutes, longRun.intensity, longRun.tired_alternative,
      1, 1
    );
    usedDays.push(longRunDay);
  }

  // Place key workout (avoid adjacent to long run)
  if (keyWorkout && dayNumbers.length > 1) {
    const availableForKey = dayNumbers.filter(d => !usedDays.includes(d));
    const nonAdjacentDays = availableForKey.filter(d => {
      const longDay = usedDays[0];
      return Math.abs(d - longDay) > 1 && Math.abs(d - longDay) !== 6;
    });

    const keyDay = nonAdjacentDays.length > 0
      ? nonAdjacentDays[Math.floor(nonAdjacentDays.length / 2)]
      : availableForKey[0];

    if (keyDay !== undefined) {
      const keyDate = addDays(weekStart, keyDay === 0 ? 6 : keyDay - 1);
      insertWorkout.run(
        planId, userId, format(keyDate, 'yyyy-MM-dd'), weekNumber,
        keyWorkout.workout_type, keyWorkout.title, keyWorkout.description,
        keyWorkout.duration_minutes, keyWorkout.intensity, keyWorkout.tired_alternative,
        1, 0
      );
      usedDays.push(keyDay);
    }
  }

  // Fill remaining days with easy runs
  const remainingDays = dayNumbers.filter(d => !usedDays.includes(d));
  const easyToPlace = Math.min(easyRuns.length, remainingDays.length);

  for (let i = 0; i < easyToPlace; i++) {
    const day = remainingDays[i];
    const easyRun = easyRuns[i];
    const easyDate = addDays(weekStart, day === 0 ? 6 : day - 1);

    insertWorkout.run(
      planId, userId, format(easyDate, 'yyyy-MM-dd'), weekNumber,
      easyRun.workout_type, easyRun.title, easyRun.description,
      easyRun.duration_minutes, easyRun.intensity, easyRun.tired_alternative,
      0, 0
    );
  }
}

export function regeneratePlan(goalId: number, userId: number): number {
  // Delete existing plan and workouts
  const existingPlan = db.prepare('SELECT id FROM training_plans WHERE goal_id = ?').get(goalId) as { id: number } | undefined;

  if (existingPlan) {
    db.prepare('DELETE FROM workouts WHERE plan_id = ?').run(existingPlan.id);
    db.prepare('DELETE FROM training_plans WHERE id = ?').run(existingPlan.id);
  }

  // Get goal and regenerate
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as Goal;
  return generateTrainingPlan(goal);
}
