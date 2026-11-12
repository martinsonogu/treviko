import { exercises } from "../exercises";
import type { WorkoutSession, WorkoutSnapshot } from "./schema";
type ExerciseSnapshot = WorkoutSnapshot["exercises"][number];
export type Effort = { status: "recorded" | "not_recorded" | "unavailable"; value: string | null };
export type Outcome = "recorded_improvement" | "recorded_consistency" | "mixed" | "insufficient";
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
function identity(exercise: ExerciseSnapshot) {
  if (exercise.exerciseId) return { key: exercise.exerciseId, basis: "stable_id" as const };
  const verified = exercises.find(
    (row) => row.slug === exercise.slug && normalize(row.name) === normalize(exercise.name),
  );
  return verified ? { key: verified.id, basis: "verified_slug" as const } : null;
}
const weighted = (exercise: ExerciseSnapshot) => exercise.loadApplicable ?? !exercise.bodyweight;
function actual(session: WorkoutSession, index: number) {
  const exercise = session.snapshot.exercises[index],
    sets = session.performance.exercises[index]?.sets.filter((set) => set.done) ?? [];
  return {
    sessionId: session.id,
    completedAt: session.finished_at,
    unit: exercise.unit,
    loadUnit: session.load_unit,
    weighted: weighted(exercise),
    completedSets: sets.length,
    prescribedSets: exercise.sets,
    prescribedRange: exercise.reps,
    partial: sets.length < exercise.sets,
    sets: sets.map((set) => ({ amount: set.amount, load: set.load })),
    totalRecordedAmount:
      sets.length && sets.every((set) => set.amount !== null)
        ? sets.reduce((total, set) => total + set.amount!, 0)
        : null,
  };
}
export function compareExercise(
  latest: WorkoutSession,
  index: number,
  previous: WorkoutSession | undefined,
  effort: Map<string, Effort> = new Map(),
) {
  const exercise = latest.snapshot.exercises[index],
    id = identity(exercise);
  const oldIndex =
    previous && id
      ? previous.snapshot.exercises.findIndex((row) => identity(row)?.key === id.key)
      : -1;
  const current = actual(latest, index),
    before = previous && oldIndex >= 0 ? actual(previous, oldIndex) : null;
  const latestEffort = effort.get(latest.id) ?? { status: "not_recorded" as const, value: null },
    previousEffort = previous
      ? (effort.get(previous.id) ?? { status: "not_recorded" as const, value: null })
      : null;
  let outcome: Outcome = "insufficient";
  let reason = "No earlier comparable exercise performance was found.";
  if (before && previous) {
    const old = previous.snapshot.exercises[oldIndex];
    const measurementCompatible =
      current.unit === before.unit &&
      current.weighted === before.weighted &&
      (!current.weighted || current.loadUnit === before.loadUnit) &&
      (!exercise.slug || !old.slug || exercise.slug === old.slug);
    const valuesComplete =
      current.completedSets > 0 &&
      before.completedSets > 0 &&
      current.sets.every(
        (set) => set.amount !== null && (!current.weighted || set.load !== null),
      ) &&
      before.sets.every((set) => set.amount !== null && (!before.weighted || set.load !== null));
    const unexplainedLoad =
      !current.weighted &&
      [...current.sets, ...before.sets].some((set) => set.load !== null && set.load !== 0);
    if (!measurementCompatible || unexplainedLoad)
      reason =
        "Measurements or saved exercise metadata are incompatible; compare the records separately.";
    else if (!valuesComplete)
      reason = "Completed measurements are missing; targets cannot replace actual values.";
    else if (current.completedSets !== before.completedSets) {
      outcome = "mixed";
      reason = "Completed set counts differ, so totals do not establish improved performance.";
    } else {
      const same = current.sets.every(
        (set, i) =>
          set.amount === before.sets[i].amount &&
          (!current.weighted || set.load === before.sets[i].load),
      );
      const nondecreasing = current.sets.every(
        (set, i) =>
          set.amount! >= before.sets[i].amount! &&
          (!current.weighted || set.load! >= before.sets[i].load!),
      );
      outcome = same ? "recorded_consistency" : nondecreasing ? "recorded_improvement" : "mixed";
      reason = same
        ? "The recorded completed-set values are unchanged."
        : nondecreasing
          ? "Completed-set values increased without reducing the other recorded measurement."
          : "Recorded measurements moved in different directions or decreased.";
      if (
        latestEffort.status === "recorded" &&
        previousEffort?.status === "recorded" &&
        latestEffort.value !== previousEffort.value
      ) {
        outcome = "mixed";
        reason += " Self-reported session effort also changed.";
      }
    }
  }
  const range =
    exercise.reps.match(/^\s*(\d+)\s*[–—-]\s*(\d+)\s*$/) ?? exercise.reps.match(/^\s*(\d+)\s*$/);
  const top = range ? Number(range[2] ?? range[1]) : null;
  const topReached =
    top !== null &&
    current.completedSets >= current.prescribedSets &&
    current.sets.every((set) => set.amount !== null && set.amount >= top);
  const oldTopReached = Boolean(
    before &&
    top !== null &&
    before.prescribedRange === current.prescribedRange &&
    before.completedSets >= before.prescribedSets &&
    before.sets.every((set) => set.amount !== null && set.amount >= top),
  );
  const manageable = (value: Effort | null) =>
    value?.status === "recorded" && ["easy", "about_right"].includes(value.value ?? "");
  const considerIncrease =
    current.weighted &&
    current.unit === "reps" &&
    ["recorded_improvement", "recorded_consistency"].includes(outcome) &&
    topReached &&
    oldTopReached &&
    manageable(latestEffort) &&
    manageable(previousEffort);
  return {
    exerciseId: id?.key ?? null,
    name: exercise.name,
    matchBasis: id?.basis ?? "unresolved",
    outcome,
    reason,
    current,
    previous: before,
    effort: { latest: latestEffort, previous: previousEffort },
    setChanges:
      before && outcome !== "insufficient" && current.completedSets === before.completedSets
        ? current.sets.map((set, index) => ({
            set: index + 1,
            amountDelta: set.amount! - before.sets[index].amount!,
            loadDelta: current.weighted ? set.load! - before.sets[index].load! : null,
          }))
        : [],
    recordedAmountDelta:
      before &&
      outcome !== "insufficient" &&
      current.unit === before.unit &&
      current.totalRecordedAmount !== null &&
      before.totalRecordedAmount !== null
        ? current.totalRecordedAmount - before.totalRecordedAmount
        : null,
    loadConvention: current.weighted
      ? "Unverified: per-dumbbell, combined, machine-stack and per-side entry are not stored."
      : "Unweighted; body mass and side conventions are not established.",
    loadVolume: null,
    recommendation: {
      action: considerIncrease
        ? "consider_small_increase_conditionally"
        : outcome === "insufficient"
          ? "maintain_and_clarify"
          : "maintain_or_review",
      reason: considerIncrease
        ? "Both recorded sessions reach the unchanged target range with manageable self-reported effort."
        : "Do not infer readiness from load alone; keep the prescription while reviewing the missing or mixed evidence.",
      conditions: considerIncrease
        ? [
            "Confirm the same load and per-side entry conventions.",
            "Confirm controlled technique and that the target range remains achievable.",
            "This is a suggestion; no load or saved plan has been changed.",
          ]
        : [],
    },
  };
}
export function orderCompleted(rows: WorkoutSession[]) {
  return rows
    .filter((row) => row.status === "completed" && row.finished_at)
    .toSorted(
      (a, b) => Date.parse(b.finished_at!) - Date.parse(a.finished_at!) || b.id.localeCompare(a.id),
    );
}
export type ProgressionAnalysis = {
  outcome: Outcome;
  comparisons: ReturnType<typeof compareExercise>[];
  selectedSessionIds: string[];
  limitations: string[];
  coverage: { comparedExercises: number; uncomparedExercises: number };
};
export function analyseProgression(
  rows: WorkoutSession[],
  effort: Map<string, Effort> = new Map(),
  options: { exerciseIds?: string[]; split?: string } = {},
): ProgressionAnalysis {
  const sorted = orderCompleted(rows),
    anchor = sorted[0];
  if (!anchor)
    return {
      outcome: "insufficient" as Outcome,
      comparisons: [],
      selectedSessionIds: [],
      coverage: { comparedExercises: 0, uncomparedExercises: 0 },
      limitations: ["No completed performances in this period."],
    };
  const selections: { row: WorkoutSession; index: number }[] = [];
  const seen = new Set<string>();
  for (const row of sorted.filter(
    (row) => !options.split || Date.parse(row.finished_at!) >= Date.parse(options.split),
  ))
    for (const [index, exercise] of row.snapshot.exercises.entries()) {
      const id = identity(exercise);
      if (options.exerciseIds?.length && (!id || !options.exerciseIds.includes(id.key))) continue;
      const key = id?.key ?? `${row.id}:${index}`;
      if (seen.has(key) || selections.length >= 6) continue;
      seen.add(key);
      selections.push({ row, index });
    }
  const comparisons = selections.map(({ row, index }) => {
    const key = identity(row.snapshot.exercises[index])?.key;
    const candidates = sorted.filter(
      (old) =>
        old.id !== row.id &&
        (Date.parse(old.finished_at!) < Date.parse(row.finished_at!) ||
          (Date.parse(old.finished_at!) === Date.parse(row.finished_at!) && old.id < row.id)) &&
        (!options.split || Date.parse(old.finished_at!) < Date.parse(options.split)) &&
        old.snapshot.exercises.some((exercise) => key && identity(exercise)?.key === key),
    );
    const current = row.snapshot.exercises[index];
    const before =
      candidates.find((old) =>
        old.snapshot.exercises.some(
          (exercise) =>
            identity(exercise)?.key === key &&
            exercise.unit === current.unit &&
            weighted(exercise) === weighted(current) &&
            (!weighted(current) || old.load_unit === row.load_unit),
        ),
      ) ?? candidates[0];
    return compareExercise(row, index, before, effort);
  });
  const comparable = comparisons.filter((row) => row.outcome !== "insufficient");
  const outcome: Outcome = !comparable.length
    ? "insufficient"
    : comparable.length < comparisons.length
      ? "mixed"
      : comparable.every((row) => row.outcome === "recorded_consistency")
        ? "recorded_consistency"
        : comparable.every((row) => row.outcome === "recorded_improvement")
          ? "recorded_improvement"
          : "mixed";
  const selectedSessionIds = [
    ...new Set(
      comparisons.flatMap((row) => [
        row.current.sessionId,
        ...(row.previous ? [row.previous.sessionId] : []),
      ]),
    ),
  ].slice(0, 2);
  return {
    outcome,
    comparisons,
    selectedSessionIds,
    coverage: {
      comparedExercises: comparable.length,
      uncomparedExercises: comparisons.length - comparable.length,
    },
    limitations: [
      "Recorded changes are not proof of strength, muscle growth, technique, recovery or readiness.",
      "Side and load-entry conventions were not captured; no load-volume or maximum-strength estimate is calculated.",
      "Session effort is self-reported for the whole session, not an exercise-specific RIR score.",
    ],
  };
}
