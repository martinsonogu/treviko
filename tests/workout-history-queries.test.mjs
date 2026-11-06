import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { loadSource as load } from "./load-source.mjs";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  plan = "77777777-7777-4777-8777-777777777777";
const { workoutRegion, completedWorkoutSummary } = load("src/lib/workouts/history-summary.ts");
const history = load("src/lib/coach/workout-history.ts"),
  intent = load("src/lib/coach/workout-history-intent.ts").workoutHistoryRequest;
const service = load("src/lib/workouts/service.ts");
const { proposal } = await import("./conversation-fixture.mjs");
const snapshot = service.snapshotDay({ payload: proposal.payload }, 1),
  performance = load("src/lib/workouts/schema.ts").emptyPerformance(snapshot);
performance.exercises[0].sets[0] = { load: 25, amount: 10, done: true };
const row = (name, id) => ({
  id,
  plan_id: plan,
  plan_version: 1,
  weekday: 1,
  status: "completed",
  snapshot: { ...snapshot, title: name },
  performance,
  load_unit: "kg",
  version: 2,
  started_at: "2026-11-05T10:00:00Z",
  updated_at: "2026-11-05T10:02:00Z",
  finished_at: "2026-11-05T10:02:00Z",
});
const upperA = row("Upper A", "88888888-8888-4888-8888-888888888888"),
  upperB = row("Upper B", "99999999-9999-4999-8999-999999999999");
const summary = {
  totalCompleted: 4,
  matchedCount: 2,
  countsByRegion: { upper: 2, lower: 2, full: 0, unknown: 0 },
  offset: 0,
  limit: 30,
  hasMore: false,
  rows: [upperB, upperA].map((r) => ({
    id: r.id,
    name: r.snapshot.title,
    completedAt: r.finished_at,
    planId: r.plan_id,
    weekday: 1,
    region: "upper",
  })),
};
async function stub(entries, fn) {
  const previous = entries.map(([o, k, v]) => {
    const old = o[k];
    o[k] = v;
    return [o, k, old];
  });
  try {
    return await fn();
  } finally {
    for (const [o, k, v] of previous) o[k] = v;
  }
}
test("reproduced count/list and corrective follow-up bypass old pinned single-session references", async () => {
  const previous = [
    { role: "user", content: "How did I do in my last workout?" },
    { role: "assistant", content: "Upper A: one completed set." },
  ];
  const question =
    "How many completed upper-body workouts do I have saved in Treviko? List their names and completion dates.";
  const request = intent(question, previous);
  assert.equal(request.mode, "overview");
  assert.equal(request.useReference, false);
  assert.equal(request.region, "upper");
  const db = {
    rpc: async (name, args) => {
      assert.equal(name, "completed_workout_history");
      assert.equal(args.p_region, "upper");
      return { data: structuredClone(summary), error: null };
    },
    from: () => assert.fail("Count/list must not load pinned references or full performance"),
  };
  const evidence = await history.loadWorkoutEvidence(
    { userId: A, db },
    "conversation",
    previous,
    request,
    "Europe/London",
  );
  assert.equal(evidence.summary.totalCompleted, 4);
  assert.equal(evidence.summary.matchedCount, 2);
  assert.deepEqual(
    evidence.summary.rows.map((r) => r.name),
    ["Upper B", "Upper A"],
  );
  assert.equal(evidence.sessions.length, 0);
  for (const message of ["But History shows four.", "But records shows 4 completed workouts."]) {
    const follow = intent(message, [...previous, { role: "user", content: question }]);
    assert.equal(follow.useReference, false);
    assert.equal(follow.mode, "overview");
    assert.equal(follow.region, "upper");
    assert.equal(
      (await history.loadWorkoutEvidence({ userId: A, db }, "conversation", [], follow, "UTC"))
        .summary.totalCompleted,
      4,
    );
  }
  assert.equal(intent("How many completed workouts do I have?", previous).region, undefined);
  assert.equal(intent("Hello Kivo", previous), null);
  assert.equal(intent("Write an essay", previous), null);
});
test("saved labels classify both A/B variants, full-body and unknown/mixed consistently", () => {
  for (const title of ["Upper A", "Upper B", "Upper Body B", "Upper-body A"])
    assert.equal(workoutRegion(title), "upper");
  for (const title of ["Lower A", "Lower B", "Lower Body B"])
    assert.equal(workoutRegion(title), "lower");
  assert.equal(workoutRegion("Full Body"), "full");
  assert.equal(workoutRegion("Upper / Lower"), "unknown");
  assert.equal(workoutRegion("Custom training"), "unknown");
});
test("pagination preserves authoritative counts and resets after a fresh listing", async () => {
  const first = "List my completed upper-body workouts.";
  const request = intent("Show more", [{ role: "user", content: first }]);
  assert.equal(request.offset, 30);
  assert.equal(request.region, "upper");
  assert.equal(request.useReference, false);
  const again = intent("Show more", [
    { role: "user", content: first },
    { role: "user", content: "Show more" },
    { role: "user", content: first },
  ]);
  assert.equal(again.offset, 30);
  assert.equal(
    intent("Show more", [
      { role: "user", content: first },
      { role: "user", content: "Show more" },
      { role: "user", content: "Show my completed upper-body workouts" },
    ]).offset,
    30,
  );
  const db = {
    rpc: async () => ({
      data: { ...summary, matchedCount: 80, totalCompleted: 120, offset: 30, hasMore: true },
      error: null,
    }),
  };
  const result = await completedWorkoutSummary({ userId: A, db }, { region: "upper", offset: 30 });
  assert.equal(result.matchedCount, 80);
  assert.equal(result.totalCompleted, 120);
  assert.equal(result.rows.length, 2);
  assert.equal(result.hasMore, true);
  await assert.rejects(
    completedWorkoutSummary({
      userId: A,
      db: { rpc: async () => ({ error: { message: "private detail" } }) },
    }),
    (error) => error.code === "WORKOUT_HISTORY_UNAVAILABLE",
  );
});
test("broad comparison selects Upper B and Upper A actuals without reading stale references", async () => {
  const previous = [{ role: "user", content: "How did I do in my last workout?" }],
    request = intent("Compare my upper-body workouts.", previous);
  assert.equal(request.useReference, false);
  const calls = [],
    db = {
      rpc: async () => ({ data: summary, error: null }),
      from(table) {
        assert.equal(table, "workout_feedback");
        const q = {
          select() {
            return q;
          },
          eq() {
            return q;
          },
          in() {
            return Promise.resolve({ data: [], error: null });
          },
        };
        return q;
      },
    };
  await stub(
    [
      [
        service,
        "queryCompletedWorkouts",
        async (_context, options) => {
          calls.push(options);
          return [upperB, upperA];
        },
      ],
    ],
    async () => {
      const result = await history.loadWorkoutEvidence(
        { userId: A, db },
        "conversation",
        previous,
        request,
        "UTC",
      );
      assert.deepEqual(calls, [{ ids: [upperB.id, upperA.id], limit: 2 }]);
      assert.equal(result.sessions.length, 2);
      assert.equal(result.comparisons.length, 1);
      assert.deepEqual(result.sessions[0].exercises[0].actual[0], {
        set: 1,
        load: 25,
        amount: 10,
        done: true,
      });
    },
  );
});
test("database aggregation counts all completed records, excludes drafts/discards, paginates, classifies and enforces ownership", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`,
    );
    for (const name of [
      "202611040001_milestone4.sql",
      "202611040002_shared_ai_controls.sql",
      "202611050001_coaching_plans.sql",
      "202611050002_training_first.sql",
      "202611050003_workout_logging.sql",
      "202611050006_workout_history_queries.sql",
      "202611060001_progression_history.sql",
    ])
      await db.exec(
        await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"),
      );
    await db.exec(`insert into auth.users values('${A}'),('${B}');`);
    const insert = async (name, user = A, status = "completed", date = "2026-11-05T10:02:00Z") =>
      db.query(
        `insert into public.workout_sessions(user_id,plan_id,plan_version,weekday,start_key,status,snapshot,performance,load_unit,finished_at) values($1,$2,1,1,gen_random_uuid(),$3,$4,$5,'kg',$6)`,
        [
          user,
          plan,
          status,
          JSON.stringify({ ...snapshot, title: name }),
          JSON.stringify(performance),
          status === "in_progress" ? null : date,
        ],
      );
    for (const name of ["Upper A", "Upper B", "Lower A", "Lower B"]) await insert(name);
    await insert("Upper A", B);
    await insert("Upper A", A, "in_progress");
    await insert("Upper B", A, "discarded");
    const own = async (user) =>
      db.exec(
        `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`,
      );
    const query = async (region = null, offset = 0) =>
      (
        await db.query("select public.completed_workout_history($1,null,null,$2) as summary", [
          region,
          offset,
        ])
      ).rows[0].summary;
    await own(A);
    let value = await query();
    assert.equal(value.totalCompleted, 4);
    assert.equal(value.matchedCount, 4);
    assert.equal(value.rows.length, 4);
    value = await query("upper");
    assert.equal(value.matchedCount, 2);
    assert.deepEqual(value.rows.map((r) => r.name).sort(), ["Upper A", "Upper B"]);
    assert.deepEqual(value.countsByRegion, { upper: 2, lower: 2, full: 0, unknown: 0 });
    assert.ok(
      value.rows.every((r) => new Date(r.completedAt).toISOString() === "2026-11-05T10:02:00.000Z"),
    );
    const progression = async (title = null, anchor = null) =>
      (
        await db.query(
          `select public.progression_workout_history($1,$2,$3,'{}','{}',$4,null,null,$5) as result`,
          ["2026-10-01T00:00:00Z", "2026-11-07T00:00:00Z", "Europe/London", title, anchor],
        )
      ).rows[0].result;
    const analysed = await progression("Upper B");
    assert.equal(analysed.sessions.length, 1);
    assert.equal(analysed.frequency.completedWorkouts, 4);
    assert.equal(analysed.frequency.trainingDays, 1);
    assert.equal(analysed.frequency.days[0].workouts, 4);
    await own(B);
    assert.equal((await query()).totalCompleted, 1);
    assert.equal((await query("lower")).matchedCount, 0);
    assert.equal((await progression()).frequency.completedWorkouts, 1);
    await assert.rejects(progression(null, analysed.sessions[0].id), /NOT_FOUND/);
    await db.exec("reset role");
    await insert("Custom mixed session");
    await insert("Full Body");
    for (let i = 0; i < 35; i++) await insert("Upper B");
    await own(A);
    value = await query("upper");
    assert.equal(value.matchedCount, 37);
    assert.equal(value.rows.length, 30);
    assert.equal(value.hasMore, true);
    const ids = value.rows.map((r) => r.id);
    const next = await query("upper", 30);
    assert.equal(next.matchedCount, 37);
    assert.equal(next.totalCompleted, 41);
    assert.equal(next.rows.length, 7);
    assert.equal(next.hasMore, false);
    assert.ok(next.rows.every((row) => !ids.includes(row.id)));
    const bounded = await progression("Upper B");
    assert.equal(bounded.matchingCount, 36);
    assert.equal(bounded.sessions.length, 30);
    assert.equal(bounded.frequency.completedWorkouts, 41);
    assert.equal((await query("unknown")).matchedCount, 1);
    assert.equal((await query("full")).matchedCount, 1);
    for (const name of [
      "Upper A",
      "Upper B",
      "Lower A",
      "Lower B",
      "Full Body",
      "Upper / Lower",
      "Custom mixed session",
    ])
      assert.equal(
        (await db.query("select public.workout_history_region($1) as region", [name])).rows[0]
          .region,
        workoutRegion(name),
      );
    await assert.rejects(query("invented"), /INVALID_HISTORY_QUERY/);
    await assert.rejects(query(null, -1), /INVALID_HISTORY_QUERY/);
    await db.exec("reset role;set role anon");
    await assert.rejects(query(), /permission denied/);
    await assert.rejects(progression(), /permission denied/);
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false);set role authenticated",
    );
    await assert.rejects(query(), /AUTH_REQUIRED/);
    await assert.rejects(progression(), /AUTH_REQUIRED/);
  } finally {
    await db.close();
  }
});
test("specific completed session lookup stays owner-scoped and never expands a pinned reference", async () => {
  const request = intent(`Review workout ${upperB.id}`, []);
  assert.equal(request.sessionId, upperB.id);
  const calls = [],
    db = {
      from(table) {
        assert.equal(table, "workout_feedback");
        const q = {
          select() {
            return q;
          },
          eq() {
            return q;
          },
          in() {
            return Promise.resolve({ data: [], error: null });
          },
        };
        return q;
      },
    };
  await stub(
    [
      [
        service,
        "queryCompletedWorkouts",
        async (context, options) => {
          assert.equal(context.userId, A);
          calls.push(options);
          return [upperB];
        },
      ],
    ],
    async () => {
      const result = await history.loadWorkoutEvidence(
        { userId: A, db },
        "conversation",
        [],
        request,
        "UTC",
      );
      assert.equal(result.sessions[0].id, upperB.id);
      assert.deepEqual(calls, [{ ids: [upperB.id], limit: 1 }]);
    },
  );
});
test("listing filters follow the latest query rather than an older region; latest summaries and date pagination remain distinct", () => {
  const upper = { role: "user", content: "List my completed upper-body workouts." },
    total = { role: "user", content: "How many completed workouts do I have?" };
  assert.equal(intent("But History shows four.", [upper, total]).region, undefined);
  assert.equal(intent("How many in total?", [upper]).region, undefined);
  assert.equal(intent("Show my last workout", [upper]).mode, "detail");
  assert.equal(intent("Show my completed workouts", [upper]).mode, "overview");
  const page = intent("Show more", [
    { role: "user", content: "List my completed upper-body workouts on 2026-11-04." },
  ]);
  assert.equal(page.region, "upper");
  assert.equal(page.date, "2026-11-04");
  assert.equal(page.offset, 30);
});
test("new exercise suggestions are not mistaken for a saved-history listing", () => {
  for (const message of [
    "List upper-body workouts for beginners",
    "Show workouts I can do",
    "Suggest workouts for beginners",
  ])
    assert.equal(intent(message, []), null, message);
});
