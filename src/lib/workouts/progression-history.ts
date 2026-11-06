import "server-only";
import { z } from "zod";
import type { AuthContext } from "../auth/session";
import { ApiError } from "../api/http";
import { sessionSchema } from "./schema";
const count = z.number().int().nonnegative();
const resultSchema = z.object({
  sessions: z.array(sessionSchema).max(30),
  matchingCount: count,
  sampleLimit: z.literal(30),
  frequency: z.object({
    from: z.string(),
    until: z.string(),
    timeZone: z.string(),
    completedWorkouts: count,
    trainingDays: count,
    days: z.array(z.object({ day: z.iso.date(), workouts: count })).max(94),
  }),
});
export type ProgressionHistory = z.infer<typeof resultSchema>;
export async function progressionHistory(
  context: AuthContext,
  options: {
    from: string;
    until: string;
    timeZone: string;
    exerciseIds: string[];
    exerciseSlugs: string[];
    title?: string;
    region?: string;
    split?: string;
    anchor?: string;
  },
) {
  const { data, error } = await context.db.rpc("progression_workout_history", {
    p_from: z.iso.datetime().parse(options.from),
    p_until: z.iso.datetime().parse(options.until),
    p_zone: options.timeZone,
    p_exercise_ids: z.array(z.string()).max(8).parse(options.exerciseIds),
    p_exercise_slugs: z.array(z.string()).max(8).parse(options.exerciseSlugs),
    p_title: options.title ?? null,
    p_region: options.region ?? null,
    p_split: options.split ?? null,
    p_anchor: options.anchor ? z.string().uuid().parse(options.anchor) : null,
  });
  if (error)
    throw new ApiError(
      503,
      "WORKOUT_HISTORY_UNAVAILABLE",
      "Your saved training progression could not be checked. Please try again; your workouts have not changed.",
    );
  return resultSchema.parse(data);
}
