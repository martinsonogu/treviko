import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSource as load } from "./load-source.mjs";
import { proposal } from "./conversation-fixture.mjs";
const { compareExercise, analyseProgression, orderCompleted } = load(
  "src/lib/workouts/progression.ts",
);
const { progressionPeriod, frequencyEvidence, loadProgressionEvidence } = load(
  "src/lib/coach/progression-evidence.ts",
);
const intent = load("src/lib/coach/workout-history-intent.ts").workoutHistoryRequest;
const service = load("src/lib/workouts/service.ts"),
  store = load("src/lib/workouts/progression-history.ts");
const snapshot = service.snapshotDay({ payload: proposal.payload }, 1);
const row = (id, load = 25, amount = 10) => {
  const shot = structuredClone(snapshot);
  shot.title = "Upper B";
  shot.exercises = [
    { ...shot.exercises[0], bodyweight: false, loadApplicable: true, sets: 2, reps: "8–12" },
  ];
  return {
    id,
    plan_id: "77777777-7777-4777-8777-777777777777",
    plan_version: 1,
    weekday: 1,
    status: "completed",
    snapshot: shot,
    performance: {
      exercises: [
        {
          sets: [
            { load, amount, done: true },
            { load, amount, done: true },
          ],
          notes: "",
        },
      ],
      notes: "PRIVATE",
    },
    load_unit: "kg",
    version: 2,
    started_at: "2026-11-05T09:00:00Z",
    updated_at: "2026-11-05T10:00:00Z",
    finished_at: "2026-11-05T10:00:00Z",
  };
};
const A = "88888888-8888-4888-8888-888888888888",
  B = "99999999-9999-4999-8999-999999999999",
  owner = "11111111-1111-4111-8111-111111111111";
const previous = () => ({ ...row(A), finished_at: "2026-11-03T10:00:00Z" });
async function stub(entries, fn) {
  const old = entries.map(([o, k, v]) => {
    const original = o[k];
    o[k] = v;
    return [o, k, original];
  });
  try {
    return await fn();
  } finally {
    for (const [o, k, v] of old) o[k] = v;
  }
}
test("deterministic classifications separate reps, load, trade-offs and stable actuals", () => {
  for (const [load, amount, expected] of [
    [25, 12, "recorded_improvement"],
    [27.5, 10, "recorded_improvement"],
    [27.5, 8, "mixed"],
    [25, 10, "recorded_consistency"],
  ]) {
    const result = compareExercise(row(B, load, amount), 0, previous());
    assert.equal(result.outcome, expected);
    assert.equal(result.setChanges[0].amountDelta, amount - 10);
    assert.equal(result.setChanges[0].loadDelta, load - 25);
    assert.equal(result.loadVolume, null);
    assert.match(result.loadConvention, /Unverified/);
  }
  const moreSets = row(B);
  moreSets.performance.exercises[0].sets.push({ load: 25, amount: 10, done: true });
  assert.equal(compareExercise(moreSets, 0, previous()).outcome, "mixed");
});
test("different IDs, similar names, incompatible units and missing measured values never imply progress", () => {
  const old = previous();
  old.snapshot.exercises[0].exerciseId = "different-id";
  assert.equal(compareExercise(row(B), 0, old).outcome, "insufficient");
  for (const alter of [
    (r) => (r.load_unit = "lb"),
    (r) => (r.snapshot.exercises[0].unit = "seconds"),
    (r) => (r.performance.exercises[0].sets[0].load = null),
    (r) => (r.performance.exercises[0].sets[0].amount = null),
  ]) {
    const current = row(B);
    alter(current);
    assert.equal(compareExercise(current, 0, previous()).outcome, "insufficient");
  }
  assert.equal(compareExercise(row(B), 0, undefined).outcome, "insufficient");
});
test("partial sets, timed performance and conservative missing-ID fallback retain recorded semantics", () => {
  const partial = row(B);
  partial.performance.exercises[0].sets[1].done = false;
  assert.equal(compareExercise(partial, 0, previous()).current.partial, true);
  assert.equal(compareExercise(partial, 0, previous()).outcome, "mixed");
  const now = row(B, null, 35),
    old = previous();
  old.performance.exercises[0].sets = old.performance.exercises[0].sets.map((set) => ({
    ...set,
    load: null,
    amount: 30,
  }));
  for (const session of [now, old])
    Object.assign(session.snapshot.exercises[0], {
      bodyweight: true,
      loadApplicable: false,
      unit: "seconds",
    });
  assert.equal(compareExercise(now, 0, old).outcome, "recorded_improvement");
  for (const session of [now, old]) session.snapshot.exercises[0].exerciseId = "";
  assert.equal(compareExercise(now, 0, old).matchBasis, "verified_slug");
  old.snapshot.exercises[0].name = "Similar invented name";
  assert.equal(compareExercise(now, 0, old).outcome, "insufficient");
});
test("effort is optional session feedback; conditional increases need repeated target completion and manageable effort", () => {
  const now = row(B, 25, 12),
    old = previous();
  old.performance.exercises[0].sets = old.performance.exercises[0].sets.map((set) => ({
    ...set,
    amount: 12,
  }));
  const missing = compareExercise(now, 0, old);
  assert.equal(missing.effort.latest.status, "not_recorded");
  assert.equal(missing.recommendation.action, "maintain_or_review");
  const effort = new Map([
    [A, { status: "recorded", value: "about_right" }],
    [B, { status: "recorded", value: "about_right" }],
  ]);
  const result = compareExercise(now, 0, old, effort);
  assert.equal(result.recommendation.action, "consider_small_increase_conditionally");
  assert.ok(result.recommendation.conditions.some((value) => value.includes("conventions")));
  effort.set(B, { status: "recorded", value: "very_hard" });
  assert.equal(compareExercise(now, 0, old, effort).outcome, "mixed");
  assert.notEqual(
    compareExercise(now, 0, old, effort).recommendation.action,
    "consider_small_increase_conditionally",
  );
});
test("repeated sessions remain distinct, deterministic ties use IDs, and absent overlapping exercises are not equated", () => {
  const first = row(A),
    second = row(B);
  assert.deepEqual(
    orderCompleted([first, second]).map((r) => r.id),
    [B, A],
  );
  const result = analyseProgression([first, second]);
  assert.deepEqual(result.selectedSessionIds, [B, A]);
  assert.equal(result.comparisons.length, 1);
  first.snapshot.title = "Upper A";
  first.snapshot.exercises[0].exerciseId = "unrelated";
  assert.ok(
    analyseProgression([first, second]).comparisons.every(
      (item) => item.outcome === "insufficient",
    ),
  );
  assert.equal(analyseProgression([{ ...second, status: "in_progress" }]).outcome, "insufficient");
});
test("defined local periods handle month boundaries/DST; frequency includes zero weeks and distinct training dates", () => {
  const period = progressionPeriod("Europe/London", "last_month", new Date("2026-11-06T12:00:00Z"));
  assert.equal(period.from, "2026-09-30T23:00:00.000Z");
  assert.equal(period.split, "2026-11-01T00:00:00.000Z");
  assert.match(period.label, /unequal/);
  const frequency = frequencyEvidence(
    {
      from: "2026-10-12T00:00:00Z",
      until: "2026-11-09T00:00:00Z",
      timeZone: "UTC",
      completedWorkouts: 3,
      trainingDays: 2,
      days: [
        { day: "2026-10-13", workouts: 2 },
        { day: "2026-11-05", workouts: 1 },
      ],
    },
    3,
  );
  assert.equal(frequency.completedWorkouts, 3);
  assert.equal(frequency.trainingDays, 2);
  assert.equal(frequency.weeks.length, 4);
  assert.equal(frequency.weeks[1].workouts, 0);
  assert.equal(frequency.savedTrainingDaysTarget, 3);
});
test("progression intent recognizes targeted questions, retains exercise follow-ups and refreshes changed scope", () => {
  for (const message of [
    "Am I getting stronger?",
    "Should I increase my chest press weight?",
    "How did my last two Upper B workouts compare?",
    "Which exercises am I improving on?",
    "What should I change in my next workout?",
    "Have I been consistent with my training?",
    "Am I lifting more than last month?",
    "Can you adjust my plan based on my progress?",
  ])
    assert.equal(intent(message, []).progression, true, message);
  const first = "Should I increase my chest press weight?";
  const next = intent("Should I increase the weight?", [{ role: "user", content: first }]);
  assert.equal(next.progression, true);
  assert.ok(next.exerciseIds.length > 0);
  const specific = intent("How did my last two Upper B workouts compare?", []);
  assert.equal(specific.sessionLabel, "Upper B");
  assert.equal(specific.useReference, false);
  for (const message of ["Hello Kivo", "Write Python code", "What should I eat?"])
    assert.equal(intent(message, []), null);
  assert.equal(intent("How many completed workouts do I have?", []).progression, false);
});
test("owner-scoped progression evidence is derived before provider use, omits notes and distinguishes errors", async () => {
  const current = row(B, 25, 12),
    old = previous();
  const period = progressionPeriod("UTC");
  const history = {
    sessions: [current, old],
    matchingCount: 2,
    sampleLimit: 30,
    frequency: {
      ...period,
      timeZone: "UTC",
      completedWorkouts: 2,
      trainingDays: 2,
      days: [
        { day: "2026-11-03", workouts: 1 },
        { day: "2026-11-05", workouts: 1 },
      ],
    },
  };
  const db = {
    from(table) {
      assert.equal(table, "workout_feedback");
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          assert.equal(key, "user_id");
          assert.equal(value, owner);
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
        store,
        "progressionHistory",
        async (context, options) => {
          assert.equal(context.userId, owner);
          assert.equal(options.exerciseIds.length, 0);
          return history;
        },
      ],
    ],
    async () => {
      const result = await loadProgressionEvidence(
        { db, userId: owner },
        "conversation",
        [],
        intent("Am I getting stronger?", []),
        "UTC",
      );
      assert.equal(result.progression.outcome, "recorded_improvement");
      assert.equal(result.sessions.length, 2);
      assert.equal(result.progression.comparisons[0].recordedAmountDelta, 4);
      assert.ok(!JSON.stringify(result).includes("PRIVATE"));
    },
  );
  await stub(
    [
      [
        store,
        "progressionHistory",
        async () => {
          throw new Error("private failure");
        },
      ],
    ],
    async () =>
      await assert.rejects(
        loadProgressionEvidence(
          { db, userId: owner },
          "conversation",
          [],
          intent("Am I getting stronger?", []),
          "UTC",
        ),
        (error) =>
          error.code === "WORKOUT_HISTORY_UNAVAILABLE" && !error.message.includes("private"),
      ),
  );
});

test("pinned progression follow-up anchors the same sessions and missing references never substitute newer records", async () => {
  const current = row(B),
    old = previous();
  const message = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    role: "assistant",
    content: "Earlier review",
  };
  const db = {
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          if (key === "user_id") assert.equal(value, owner);
          return q;
        },
        in() {
          return table === "workout_feedback" ? Promise.resolve({ data: [], error: null }) : q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        maybeSingle() {
          return Promise.resolve({ data: { workout_ids: [B, A] }, error: null });
        },
      };
      return q;
    },
  };
  const request = {
    ...intent("Should I increase the weight?", [
      { role: "user", content: "Am I getting stronger?" },
    ]),
    useReference: true,
  };
  await stub(
    [
      [service, "queryCompletedWorkouts", async () => [current, old]],
      [
        store,
        "progressionHistory",
        async (_context, options) => {
          assert.equal(options.anchor, B);
          return {
            sessions: [current, old],
            matchingCount: 2,
            sampleLimit: 30,
            frequency: {
              from: options.from,
              until: options.until,
              timeZone: "UTC",
              completedWorkouts: 2,
              trainingDays: 1,
              days: [{ day: "2026-11-05", workouts: 2 }],
            },
          };
        },
      ],
    ],
    async () => {
      const result = await loadProgressionEvidence(
        { db, userId: owner },
        "conversation",
        [message],
        request,
        "UTC",
      );
      assert.deepEqual(result.progression.selectedSessionIds, [B, A]);
    },
  );
  await stub(
    [
      [service, "queryCompletedWorkouts", async () => []],
      [store, "progressionHistory", async () => assert.fail("No replacement latest lookup")],
    ],
    async () =>
      assert.equal(
        (
          await loadProgressionEvidence(
            { db, userId: owner },
            "conversation",
            [message],
            request,
            "UTC",
          )
        ).status,
        "reference_missing",
      ),
  );
});
test("calendar-month comparison needs a current-month performance; corrections refresh scope", () => {
  const a = previous(),
    b = row(B);
  const split = "2026-11-01T00:00:00Z";
  a.finished_at = "2026-10-20T10:00:00Z";
  b.finished_at = "2026-10-28T10:00:00Z";
  assert.equal(analyseProgression([a, b], new Map(), { split }).outcome, "insufficient");
  const corrected = intent("But History shows four.", [
    { role: "user", content: "Am I getting stronger?" },
  ]);
  assert.equal(corrected.mode, "overview");
  assert.equal(corrected.useReference, false);
  assert.equal(corrected.progression, false);
});

test("specific exercise phrases do not conflate chest press, bench press or curl variants", () => {
  const library = load("src/lib/exercises.ts").exercises;
  for (const name of ["chest press", "bench press", "dumbbell curl", "cable curl"]) {
    const result = intent(`Should I increase my ${name} weight?`, []);
    assert.ok(result);
    assert.ok(
      result.exerciseIds.every((id) =>
        library
          .find((row) => row.id === id)
          .name.toLowerCase()
          .includes(name),
      ),
    );
  }
  const history = [{ role: "user", content: "Should I increase my chest press weight?" }];
  const follow = intent("Should I increase the weight?", history);
  assert.equal(follow.useReference, true);
  assert.deepEqual(follow.exerciseIds, intent(history[0].content, []).exerciseIds);
});

test("multi-turn progression follow-ups preserve session label and calendar-period selection", () => {
  const upper = [
    { role: "user", content: "How did my last two Upper B workouts compare?" },
    { role: "user", content: "Should I increase the weight?" },
  ];
  const next = intent("What should I change next time?", upper);
  assert.equal(next.useReference, true);
  assert.equal(next.sessionLabel, "Upper B");
  const month = intent("Should I increase the weight?", [
    { role: "user", content: "Am I lifting more than last month?" },
  ]);
  assert.equal(month.period, "last_month");
  assert.equal(month.useReference, true);
});

test("most recent compatible performance is selected without treating intervening units as equivalent", () => {
  const now = row(B),
    incompatible = row("77777777-7777-4777-8777-777777777777"),
    old = previous();
  incompatible.finished_at = "2026-11-04T10:00:00Z";
  incompatible.load_unit = "lb";
  const result = analyseProgression([incompatible, old, now]);
  assert.equal(result.comparisons[0].previous.sessionId, A);
  assert.equal(result.comparisons[0].current.loadUnit, "kg");
});
test("no completed sample stays empty and unavailable effort is not invented", async () => {
  const period = progressionPeriod("UTC"),
    empty = {
      sessions: [],
      matchingCount: 0,
      sampleLimit: 30,
      frequency: { ...period, timeZone: "UTC", completedWorkouts: 0, trainingDays: 0, days: [] },
    };
  await stub([[store, "progressionHistory", async () => empty]], async () => {
    const result = await loadProgressionEvidence(
      { userId: owner, db: {} },
      "conversation",
      [],
      intent("Am I getting stronger?", []),
      "UTC",
    );
    assert.equal(result.status, "no_completed");
    assert.equal(result.progression.outcome, "insufficient");
  });
  const current = row(B),
    old = previous();
  const db = {
    from() {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        in() {
          return Promise.resolve({ error: { message: "unavailable" }, data: null });
        },
      };
      return q;
    },
  };
  await stub(
    [
      [
        store,
        "progressionHistory",
        async () => ({ ...empty, sessions: [current, old], matchingCount: 2 }),
      ],
    ],
    async () => {
      const result = await loadProgressionEvidence(
        { userId: owner, db },
        "conversation",
        [],
        intent("Am I getting stronger?", []),
        "UTC",
      );
      assert.equal(result.progression.comparisons[0].effort.latest.status, "unavailable");
    },
  );
});
test("derived evidence uses the existing structured provider reservation and review, without an extra model call", async () => {
  const provider = load("src/lib/coach/provider.ts"),
    config = load("src/lib/coach/config.ts").getCoachConfig({
      OPENAI_API_KEY: "mock",
      OPENAI_MODEL: "mock",
      NODE_ENV: "test",
    });
  const records = [],
    reservations = [];
  const transport = {
    responses: {
      parse: async (request) => {
        records.push(request);
        return {
          status: "completed",
          usage: { input_tokens: 200, output_tokens: 40 },
          output_parsed:
            records.length === 1
              ? {
                  message:
                    "Your recorded repetitions increased; this is not proof of greater strength.",
                  exerciseIds: [],
                }
              : {
                  inScope: true,
                  safe: true,
                  groundedExercises: true,
                  honestNutrition: true,
                  private: true,
                },
        };
      },
    },
  };
  const monitor = {
    reserve: async (amount) => {
      reservations.push(amount);
      return async () => {};
    },
  };
  const progression = analyseProgression([row(B, 25, 12), previous()]);
  const input = {
    message: "Am I getting stronger?",
    history: [],
    profile: {},
    workoutEvidence: { status: "found", sessions: [], comparisons: [], progression },
  };
  const instance = provider.createOpenAIProvider(config, monitor, transport);
  const signal = new AbortController().signal;
  const draft = await instance.generate(
    input,
    {
      category: "fitness",
      topic: "fitness",
      outcome: "allowed",
      safety: "none",
      injection: false,
      needsExercises: false,
      muscles: [],
    },
    [],
    signal,
  );
  await instance.review(input, draft, [], signal);
  assert.equal(records.length, 2);
  assert.equal(reservations.length, 2);
  assert.ok(reservations.every((amount) => amount > JSON.stringify(progression).length));
  assert.ok(
    records.every(
      (request) =>
        JSON.parse(request.input[0].content).request.workoutEvidence.progression.outcome ===
        "recorded_improvement",
    ),
  );
});

test("empty newer discussions do not reuse older references; social turns keep the substantive selection", () => {
  const helper = load("src/lib/coach/workout-history-intent.ts").workoutReferenceMessages;
  const messages = [
    { role: "user", content: "Am I getting stronger?" },
    { id: A, role: "assistant", content: "Earlier evidence" },
    { role: "user", content: "How did my last two Upper B workouts compare?" },
    { id: B, role: "assistant", content: "No matching workouts" },
  ];
  assert.deepEqual(helper(messages), [B]);
  assert.deepEqual(
    helper([
      ...messages,
      { role: "user", content: "Thanks" },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "assistant", content: "You are welcome" },
    ]),
    [B],
  );
});

test("a broad progression question after counts refreshes history instead of requesting a stale detail reference", () => {
  const result = intent("Am I getting stronger?", [
    { role: "user", content: "How many completed workouts do I have?" },
  ]);
  assert.equal(result.progression, true);
  assert.equal(result.useReference, false);
});
