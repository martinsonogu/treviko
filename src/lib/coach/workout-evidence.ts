import type { ProgressionEvidence } from "./progression-evidence";
import type { WorkoutHistorySummary } from "../workouts/history-summary";
import type { WorkoutHistoryRequest } from "./workout-history-intent";
import type { WorkoutSession } from "../workouts/schema";
import { completionSummary } from "../workouts/completion";
export type WorkoutEvidence = {
  status: "found" | "no_completed" | "no_match" | "reference_missing";
  timeZone: string;
  request: WorkoutHistoryRequest;
  searchLimit: number;
  contextLimited: boolean;
  sessions: ReturnType<typeof projectWorkout>[];
  comparisons: ReturnType<typeof compareWorkouts>;
  summary?: WorkoutHistorySummary;
  progression?: ProgressionEvidence;
  active?: { id: string; name: string; status: "in_progress" } | null;
};
export function projectWorkout(
  session: WorkoutSession,
  effort: { status: "recorded" | "not_recorded" | "unavailable"; value: string | null },
) {
  const summary = completionSummary(session);
  return {
    id: session.id,
    name: session.snapshot.title,
    completedAt: session.finished_at,
    planVersion: session.plan_version,
    loadUnit: session.load_unit,
    completedSets: summary.complete,
    prescribedSets: summary.prescribed,
    partial: summary.partial,
    elapsedMinutes: summary.minutes,
    elapsedMeaning:
      "Recorded start-to-finish time including pauses; not verified physical training time.",
    effort,
    exercises: session.snapshot.exercises.map((exercise, index) => ({
      id: exercise.exerciseId,
      name: exercise.name,
      unit: exercise.unit,
      loadApplicable: exercise.loadApplicable ?? !exercise.bodyweight,
      prescribed: { sets: exercise.sets, reps: exercise.reps },
      actual: session.performance.exercises[index].sets.map((set, setIndex) => ({
        set: setIndex + 1,
        ...set,
      })),
    })),
  };
}
export function compareWorkouts(
  latest: WorkoutSession | undefined,
  previous: WorkoutSession | undefined,
) {
  if (!latest || !previous) return [];
  return latest.snapshot.exercises.flatMap((exercise, index) => {
    const oldIndex = previous.snapshot.exercises.findIndex(
      (old) => old.exerciseId === exercise.exerciseId && old.unit === exercise.unit,
    );
    if (oldIndex < 0) return [];
    const now = latest.performance.exercises[index].sets.filter((set) => set.done),
      before = previous.performance.exercises[oldIndex].sets.filter((set) => set.done);
    if (!now.length || !before.length) return [];
    const comparableLoad =
      latest.load_unit === previous.load_unit && (exercise.loadApplicable ?? !exercise.bodyweight);
    const max = (sets: typeof now) => {
      const loads = sets.flatMap((set) => (set.load === null ? [] : [set.load]));
      return loads.length ? Math.max(...loads) : null;
    };
    return [
      {
        exerciseId: exercise.exerciseId,
        unit: exercise.unit,
        latestSets: now.length,
        previousSets: before.length,
        loadUnitComparable: comparableLoad,
        latestMaxRecordedLoad: comparableLoad ? max(now) : null,
        previousMaxRecordedLoad: comparableLoad ? max(before) : null,
        meaning:
          "Recorded differences only; not proof of strength improvement, technique or readiness to add load.",
      },
    ];
  });
}
