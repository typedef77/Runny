interface WeeklyStats {
    totalRuns: number;
    completedRuns: number;
    plannedRuns: number;
    averageEffort: number;
    averagePain: number;
    totalMinutes: number;
    missedKeyWorkouts: number;
}
interface AdjustmentRecommendation {
    type: 'reduce' | 'maintain' | 'increase';
    reason: string;
    volumeMultiplier: number;
    intensityAdjustment: number;
}
export declare function analyzeWeeklyPerformance(userId: number, weekOffset?: number): WeeklyStats | null;
export declare function getAdjustmentRecommendation(stats: WeeklyStats): AdjustmentRecommendation;
export declare function applyWeeklyAdjustment(userId: number): {
    applied: boolean;
    adjustment: AdjustmentRecommendation | null;
};
export declare function getRecentAdjustments(userId: number, limit?: number): any[];
export {};
//# sourceMappingURL=autoAdjust.d.ts.map