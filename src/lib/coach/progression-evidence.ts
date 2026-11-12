import { workoutReferenceMessages } from "./workout-history-intent";
import "server-only";
import { z } from "zod";
import type { AuthContext } from "../auth/session";
import type { WorkoutHistoryRequest } from "./workout-history-intent";
import type { WorkoutEvidence } from "./workout-evidence";
import { projectWorkout } from "./workout-evidence";
import { analyseProgression, type Effort } from "../workouts/progression";
import { progressionHistory, type ProgressionHistory } from "../workouts/progression-history";
import { queryCompletedWorkouts } from "../workouts/service";
import { feedbackSchema } from "../workouts/feedback";
import { workoutDateWindow } from "./workout-dates";
import { exercises } from "../exercises";
import { containsSecret } from "../persistence/conversations";
import { ApiError } from "../api/http";
const localDay = (value: Date, zone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export function progressionPeriod(
  zone: string,
  kind: "recent" | "last_month" = "recent",
  now = new Date(),
) {
  const today = localDay(now, zone);
  const end = workoutDateWindow(today, zone).until;
  if (kind === "last_month") {
    const month = today.slice(0, 7) + "-01",
      previous = new Date(month + "T12:00:00Z");
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    return {
      from: workoutDateWindow(previous.toISOString().slice(0, 10), zone).from,
      until: end,
      split: workoutDateWindow(month, zone).from,
      label: "Previous calendar month versus current month to date (unequal observation periods).",
    };
  }
  const start = new Date(today + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - 27);
  return {
    from: workoutDateWindow(start.toISOString().slice(0, 10), zone).from,
    until: end,
    label: "28 local calendar days ending today; today is incomplete.",
  };
}
export function frequencyEvidence(
  history: ProgressionHistory["frequency"],
  trainingDays?: number | null,
) {
  const weeks = new Map<string, { weekStarting: string; workouts: number; trainingDays: number }>();
  for (const row of history.days) {
    const date = new Date(row.day + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key = date.toISOString().slice(0, 10);
    const week = weeks.get(key) ?? { weekStarting: key, workouts: 0, trainingDays: 0 };
    week.workouts += row.workouts;
    week.trainingDays++;
    weeks.set(key, week);
  }
  const from = localDay(new Date(history.from), history.timeZone),
    until = localDay(new Date(Date.parse(history.until) - 1), history.timeZone);
  const first = new Date(from + "T12:00:00Z");
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  for (
    let date = first;
    date.toISOString().slice(0, 10) <= until;
    date = new Date(date.getTime() + 7 * 86400000)
  ) {
    const key = date.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, { weekStarting: key, workouts: 0, trainingDays: 0 });
  }
  return {
    ...history,
    weeks: [...weeks.values()]
      .toSorted((a, b) => a.weekStarting.localeCompare(b.weekStarting))
      .map((week) => ({
        ...week,
        partialWeek:
          week.weekStarting < from ||
          new Date(Date.parse(week.weekStarting + "T12:00:00Z") + 6 * 86400000)
            .toISOString()
            .slice(0, 10) >= until,
      })),
    savedTrainingDaysTarget: trainingDays ?? null,
    meaning:
      "Exact completed-session frequency, including partial finishes; multiple sessions on one date are one training day. Calendar-edge weeks/current day are incomplete. Logging does not prove adherence to a schedule or training outside Treviko.",
  };
}
export async function loadProgressionEvidence(
  context: AuthContext,
  conversationId: string,
  messages: { id?: string; role: string; content: string }[],
  request: WorkoutHistoryRequest,
  timeZone: string,
  trainingDays?: number | null,
): Promise<WorkoutEvidence> {
  const base: WorkoutEvidence = {
    status: "no_completed",
    timeZone,
    request,
    searchLimit: 30,
    contextLimited: false,
    sessions: [],
    comparisons: [],
  };
  try {
    let anchor: string | undefined;
    let now = new Date();
    if (request.useReference) {
      const ids = workoutReferenceMessages(messages);
      if (!ids.length) return { ...base, status: "reference_missing" };
      const reference = await context.db
        .from("coach_workout_context")
        .select("workout_ids")
        .eq("user_id", context.userId)
        .eq("conversation_id", conversationId)
        .in("message_id", ids)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reference.error) throw reference.error;
      if (!reference.data) return { ...base, status: "reference_missing" };
      const selected = z.array(z.string().uuid()).min(1).max(2).parse(reference.data.workout_ids);
      const pinned = await queryCompletedWorkouts(context, { ids: selected, limit: 2 });
      if (pinned.length !== selected.length) return { ...base, status: "reference_missing" };
      anchor = selected[0];
      now = new Date(pinned.find((row) => row.id === anchor)!.finished_at!);
    }
    if (request.exerciseText && !request.exerciseIds.length) return { ...base, status: "no_match" };
    const period = progressionPeriod(timeZone, request.period, now);
    const selectedExercises = exercises.filter((row) => request.exerciseIds.includes(row.id));
    const history = await progressionHistory(context, {
      ...period,
      timeZone,
      exerciseIds: request.exerciseIds,
      exerciseSlugs: selectedExercises.map((row) => row.slug),
      title: request.sessionLabel,
      region: request.region,
      anchor,
    });
    const ids = history.sessions.map((row) => row.id);
    const feedback = ids.length
      ? await context.db
          .from("workout_feedback")
          .select("session_id,effort,created_at")
          .eq("user_id", context.userId)
          .in("session_id", ids)
      : { data: [], error: null };
    const feedbackRows = feedback.error ? null : z.array(feedbackSchema).parse(feedback.data ?? []);
    const effort = new Map<string, Effort>(
      ids.map((id) => {
        const row = feedbackRows?.find((item) => item.session_id === id);
        return [
          id,
          {
            status: feedbackRows === null ? "unavailable" : row ? "recorded" : "not_recorded",
            value: row?.effort ?? null,
          },
        ];
      }),
    );
    const analysis = analyseProgression(history.sessions, effort, {
      exerciseIds: request.exerciseIds,
      split: period.split,
    });
    if (request.exerciseIds.length > 1)
      for (const comparison of analysis.comparisons) {
        comparison.recommendation.action = "maintain_and_clarify";
        comparison.recommendation.reason =
          "More than one library exercise matches the request. Ask which recorded movement the user means before suggesting a load change.";
        comparison.recommendation.conditions = [];
      }
    // Pin the displayed comparison, not every candidate. Full private notes never reach the provider.
    const selected = analysis.selectedSessionIds.map((id) =>
      history.sessions.find((row) => row.id === id)!,
    );
    const clean = (name: string) =>
      containsSecret(name) ? "Recorded workout (name omitted)" : name;
    const progression = {
      ...analysis,
      comparisons: analysis.comparisons.map((row) => ({ ...row, name: clean(row.name) })),
      period: { ...period, timeZone, asOf: now.toISOString() },
      frequency: frequencyEvidence(history.frequency, trainingDays),
      sampleTruncated: history.matchingCount > history.sessions.length,
    };
    let sessions = selected.map((row) => {
      const projected = projectWorkout(row, effort.get(row.id)!);
      projected.name = clean(projected.name);
      return projected;
    });
    let contextLimited = false;
    if (JSON.stringify({ sessions, progression }).length > 28000) {
      sessions = [];
      contextLimited = true;
    }
    if (JSON.stringify(progression).length > 28000)
      throw new Error("PROGRESSION_CONTEXT_TOO_LARGE");
    return {
      ...base,
      status: history.sessions.length
        ? "found"
        : history.matchingCount
          ? "no_match"
          : history.frequency.completedWorkouts
            ? "no_match"
            : "no_completed",
      sessions,
      progression,
      contextLimited,
    };
  } catch {
    throw new ApiError(
      503,
      "WORKOUT_HISTORY_UNAVAILABLE",
      "Your saved training progression could not be checked. Please try again; your workouts have not changed.",
    );
  }
}

export type ProgressionEvidence = ReturnType<typeof analyseProgression> & {
  period: ReturnType<typeof progressionPeriod> & { timeZone: string; asOf?: string };
  frequency: ReturnType<typeof frequencyEvidence>;
  sampleTruncated: boolean;
};
