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
export declare function generateTrainingPlan(goal: Goal): number;
export declare function rescheduleWeek(planId: number, userId: number, weekNumber: number, newAvailableDays: string[]): void;
export declare function regeneratePlan(goalId: number, userId: number): number;
export {};
//# sourceMappingURL=trainingPlan.d.ts.map