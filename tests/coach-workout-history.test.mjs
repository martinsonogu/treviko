import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSource as load } from "./load-source.mjs";
import { proposal, userId } from "./conversation-fixture.mjs";
const intent = load("src/lib/coach/workout-history-intent.ts").workoutHistoryRequest;
const service = load("src/lib/workouts/service.ts"),
  schema = load("src/lib/workouts/schema.ts");
const { loadWorkoutEvidence, workoutDateWindow } = load("src/lib/coach/workout-history.ts");
const { projectWorkout, compareWorkouts } = load("src/lib/coach/workout-evidence.ts");
const plan = { id: "77777777-7777-4777-8777-777777777777", version: 1, payload: proposal.payload };
const snapshot = service.snapshotDay(plan, 1),
  performance = schema.emptyPerformance(snapshot);
performance.exercises[0].sets[0] = { load: 25, amount: 10, done: true };
const session = {
  id: "88888888-8888-4888-8888-888888888888",
  plan_id: plan.id,
  plan_version: 1,
  weekday: 1,
  status: "completed",
  snapshot,
  performance,
  load_unit: "kg",
  version: 2,
  started_at: "2026-11-05T10:00:00Z",
  updated_at: "2026-11-05T10:02:00Z",
  finished_at: "2026-11-05T10:02:00Z",
};
const earlier = {
  ...structuredClone(session),
  id: "99999999-9999-4999-8999-999999999999",
  started_at: "2026-11-03T10:00:00Z",
  finished_at: "2026-11-03T10:02:00Z",
};
function database(results) {
  const calls = [];
  return {
    calls,
    from(table) {
      const result = results[table] ?? { data: [], error: null };
      const q = {
        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      for (const method of ["select", "eq", "in", "order", "limit", "lt", "gte", "maybeSingle"])
        q[method] = (...args) => {
          calls.push([table, method, ...args]);
          return q;
        };
      return q;
    },
  };
}
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
test("natural history questions are deterministic; greetings and unrelated prompts do not retrieve history", () => {
  for (const message of [
    "How did I do in my last workout?",
    "What did I train yesterday?",
    "How many sets did I complete?",
    "What weight did I use for chest press?",
    "Was my last workout too hard?",
    "Am I getting stronger?",
    "How did my last two upper-body sessions compare?",
    "What should I improve next time?",
    "Did I finish my workout?",
    "How has my training been going?",
    "What did I train on 2026-11-04?",
  ])
    assert.ok(intent(message, []), message);
  for (const message of ["Hi Kivo", "Thanks", "Write Python code", "What should I eat?"])
    assert.equal(intent(message, []), null, message);
  const history = [{ role: "user", content: "How did I do in my last workout?" }];
  assert.equal(intent("Should I increase the weight?", history).useReference, true);
  assert.equal(intent("Can you adjust my plan based on that?", history).adjustPlan, true);
  assert.equal(intent("What did I train yesterday?", history).useReference, false);
});
test("local calendar boundaries handle DST, near-midnight dates and invalid dates", () => {
  assert.deepEqual(workoutDateWindow("2026-10-25", "Europe/London"), {
    from: "2026-10-24T23:00:00.000Z",
    until: "2026-10-26T00:00:00.000Z",
  });
  assert.deepEqual(
    workoutDateWindow("yesterday", "America/New_York", new Date("2026-11-05T01:00:00Z")),
    { from: "2026-11-03T05:00:00.000Z", until: "2026-11-04T05:00:00.000Z" },
  );
  assert.throws(() => workoutDateWindow("2026-02-30", "Europe/London"), /valid workout date/);
});
test("projection preserves actuals, partial completion, seconds, effort and elapsed caveat without notes", () => {
  const row = structuredClone(session);
  row.performance.notes = "PRIVATE";
  row.snapshot.exercises[0].unit = "seconds";
  const evidence = projectWorkout(row, { status: "not_recorded", value: null });
  assert.equal(evidence.partial, true);
  assert.equal(evidence.elapsedMinutes, 2);
  assert.match(evidence.elapsedMeaning, /not verified/);
  assert.equal(evidence.exercises[0].unit, "seconds");
  assert.deepEqual(evidence.exercises[0].actual[0], { set: 1, load: 25, amount: 10, done: true });
  assert.equal(evidence.effort.value, null);
  assert.ok(!JSON.stringify(evidence).includes("PRIVATE"));
  assert.deepEqual(compareWorkouts(session, undefined), []);
  assert.equal(
    compareWorkouts(session, { ...earlier, load_unit: "lb" })[0].latestMaxRecordedLoad,
    null,
  );
});
test("completed reads explicitly constrain ownership, terminal status, order and maximum window", async () => {
  const db = database({ workout_sessions: { data: [session], error: null } });
  const rows = await service.queryCompletedWorkouts({ db, userId }, { limit: 1 });
  assert.equal(rows[0].id, session.id);
  for (const call of [
    ["workout_sessions", "eq", "user_id", userId],
    ["workout_sessions", "eq", "status", "completed"],
    ["workout_sessions", "order", "finished_at", { ascending: false }],
    ["workout_sessions", "limit", 1],
  ])
    assert.ok(db.calls.some((value) => JSON.stringify(value) === JSON.stringify(call)));
  await assert.rejects(service.queryCompletedWorkouts({ db, userId }, { limit: 31 }));
});
test("latest evidence includes only recorded feedback and bounded comparable previous sessions", async () => {
  const db = database({
    workout_feedback: {
      data: [{ session_id: session.id, effort: "about_right", created_at: session.finished_at }],
      error: null,
    },
  });
  const reads = [];
  await stub(
    [
      [
        service,
        "queryCompletedWorkouts",
        async (ctx, options) => {
          assert.equal(ctx.userId, userId);
          reads.push(options);
          return [session];
        },
      ],
      [service, "previousWorkouts", async () => [earlier]],
    ],
    async () => {
      const evidence = await loadWorkoutEvidence(
        { db, userId },
        "conv",
        [],
        { ...intent("Am I getting stronger?", []), progression: false },
        "Europe/London",
      );
      assert.equal(evidence.status, "found");
      assert.deepEqual(reads, [{ limit: 1 }]);
      assert.equal(evidence.sessions.length, 2);
      assert.notEqual(evidence.sessions[0].id, evidence.sessions[1].id);
      assert.equal(evidence.sessions[0].effort.value, "about_right");
      assert.equal(evidence.sessions[1].effort.status, "not_recorded");
      assert.equal(evidence.comparisons.length, 1);
      assert.equal(evidence.searchLimit, 30);
      assert.ok(db.calls.some((c) => c[1] === "eq" && c[2] === "user_id" && c[3] === userId));
    },
  );
});
test("missing records and unavailable service/feedback remain distinct", async () => {
  const request = intent("How did I do in my last workout?", []);
  const db = database({ workout_feedback: { data: null, error: { message: "unavailable" } } });
  await stub([[service, "queryCompletedWorkouts", async () => []]], async () =>
    assert.equal(
      (await loadWorkoutEvidence({ db, userId }, "conv", [], request, "UTC")).status,
      "no_completed",
    ),
  );
  await stub(
    [
      [
        service,
        "queryCompletedWorkouts",
        async () => {
          throw new Error("private database detail");
        },
      ],
    ],
    async () =>
      await assert.rejects(
        loadWorkoutEvidence({ db, userId }, "conv", [], request, "UTC"),
        (error) =>
          error.code === "WORKOUT_HISTORY_UNAVAILABLE" && !error.message.includes("private"),
      ),
  );
  await stub([[service, "queryCompletedWorkouts", async () => [session]]], async () =>
    assert.equal(
      (await loadWorkoutEvidence({ db, userId }, "conv", [], request, "UTC")).sessions[0].effort
        .status,
      "unavailable",
    ),
  );
});
test("follow-ups re-read pinned owned records instead of a newly completed workout; missing references never switch", async () => {
  const history = [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "assistant", content: "Review" },
  ];
  const db = database({
    coach_workout_context: { data: { workout_ids: [earlier.id] }, error: null },
  });
  const request = {
    ...{ ...intent("Am I getting stronger?", []), progression: false },
    useReference: true,
    compare: false,
  };
  await stub(
    [
      [
        service,
        "queryCompletedWorkouts",
        async (ctx, options) => {
          assert.deepEqual(options, { ids: [earlier.id], limit: 2 });
          return [earlier];
        },
      ],
    ],
    async () => {
      const result = await loadWorkoutEvidence({ db, userId }, "conv", history, request, "UTC");
      assert.equal(result.sessions[0].id, earlier.id);
      assert.ok(
        db.calls.some((c) => c[1] === "eq" && c[2] === "conversation_id" && c[3] === "conv"),
      );
    },
  );
  await stub([[service, "queryCompletedWorkouts", async () => []]], async () =>
    assert.equal(
      (await loadWorkoutEvidence({ db, userId }, "conv", history, request, "UTC")).status,
      "reference_missing",
    ),
  );
});
const auth = load("src/lib/auth/session.ts"),
  profiles = load("src/lib/profile/service.ts"),
  conversations = load("src/lib/persistence/conversations.ts"),
  shared = load("src/lib/persistence/shared-ai.ts"),
  admin = load("src/lib/supabase/admin.ts"),
  plans = load("src/lib/coaching/service.ts"),
  generation = load("src/lib/coaching/generation.ts"),
  provider = load("src/lib/coach/provider.ts"),
  actions = load("src/lib/coach/action-intent.ts"),
  configuration = load("src/lib/coach/config.ts"),
  workoutHistory = load("src/lib/coach/workout-history.ts");
const { conversationId, intent: actionIntent } = await import("./conversation-fixture.mjs");
const { persistentCoachHandler } = load("src/lib/persistence/coach-http.ts");
const config = configuration.getCoachConfig({
  OPENAI_API_KEY: "mock",
  OPENAI_MODEL: "mock",
  NODE_ENV: "test",
});
const evidence = {
  status: "found",
  timeZone: "UTC",
  request: intent("How did I do in my last workout?", []),
  searchLimit: 1,
  contextLimited: false,
  sessions: [projectWorkout(session, { status: "not_recorded", value: null })],
  comparisons: [],
};
async function coachHarness(work) {
  const events = {
    reads: 0,
    generated: [],
    reviewed: [],
    appended: [],
    admitted: 0,
    released: 0,
    proposals: [],
  };
  let classification = actionIntent(),
    records = [];
  const saved = {
    ...load("src/lib/profile/schema.ts").emptyProfile(),
    equipment: ["dumbbells"],
    trainingDays: 2,
  };
  await stub(
    [
      [auth, "requireUser", async () => ({ userId, db: {} })],
      [configuration, "getCoachConfig", () => config],
      [profiles, "getProfile", async () => saved],
      [conversations, "getConversation", async () => ({ id: conversationId, messages: records })],
      [plans, "getActivePlan", async () => plan],
      [plans, "getProfileGuard", async () => ({ saved: true })],
      [
        shared,
        "acquireSharedRequest",
        async () => {
          events.admitted++;
          return async () => {
            events.released++;
          };
        },
      ],
      [shared, "persistentUsageMonitor", () => ({ reserve: async () => async () => {} })],
      [actions, "classifyConversationAction", async () => classification],
      [
        workoutHistory,
        "loadWorkoutEvidence",
        async () => {
          events.reads++;
          return evidence;
        },
      ],
      [
        provider,
        "createOpenAIProvider",
        () => ({
          classify: async () => classification,
          generate: async (input) => {
            events.generated.push(input);
            return {
              message:
                "You recorded 1 completed set at 25 kg for 10 reps. The workout was partial.",
              exerciseIds: [],
            };
          },
          review: async (input) => {
            events.reviewed.push(input);
            return {
              inScope: true,
              safe: true,
              groundedExercises: true,
              honestNutrition: true,
              private: true,
            };
          },
        }),
      ],
      [
        generation,
        "generatePlanProposal",
        async (context) => {
          events.proposals.push(context);
          return { ...proposal.payload, scope: context.scope };
        },
      ],
      [plans, "storeProposal", async () => proposal],
      [plans, "publishProposal", async () => assert.fail("Must require explicit confirmation")],
      [
        admin,
        "createAdminSupabase",
        () => ({
          rpc: async (name, args) => {
            events.appended.push({ name, args });
            return { error: null };
          },
        }),
      ],
    ],
    async () =>
      await work({
        events,
        classification: (value) => (classification = value),
        history: (value) => (records = value),
        send: async (message) => {
          const response = await persistentCoachHandler(
            new Request("http://localhost/api/v1/coach/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message, conversationId, conversationFirst: true }),
            }),
          );
          return { status: response.status, body: await response.json() };
        },
      }),
  );
}
test("authenticated history reaches generator and independent reviewer through existing admitted Coach route; references saved atomically", async () => {
  await coachHarness(async ({ events, send }) => {
    const response = await send("How did I do in my last workout?");
    assert.equal(response.status, 200);
    assert.match(response.body.message, /25 kg/);
    assert.equal(events.reads, 1);
    assert.equal(events.generated[0].workoutEvidence, evidence);
    assert.equal(events.reviewed[0].workoutEvidence, evidence);
    assert.equal(events.appended[0].name, "append_coach_turn_with_workouts");
    assert.deepEqual(events.appended[0].args.p_workouts, [session.id]);
    assert.equal(events.admitted, 1);
    assert.equal(events.released, 1);
    assert.equal(events.proposals.length, 0);
  });
});
test("greetings, unrelated requests and safety requests never load saved workout history", async () => {
  await coachHarness(async ({ events, send, classification }) => {
    await send("Hello Kivo");
    assert.equal(events.reads, 0);
    classification(
      actionIntent("conversation", { category: "unrelated", outcome: "unrelated", topic: "other" }),
    );
    await send("Write code to analyse my last workout");
    assert.equal(events.reads, 0);
    classification(
      actionIntent("conversation", {
        category: "safety_sensitive",
        outcome: "safety_sensitive",
        safety: "medical",
      }),
    );
    await send("Diagnose my pain after my last workout");
    assert.equal(events.reads, 0);
  });
});
test("plan adjustment based on workout evidence uses existing proposal generation and never activates a plan", async () => {
  await coachHarness(async ({ events, send, classification, history }) => {
    history([
      { id: crypto.randomUUID(), role: "user", content: "How did I do in my last workout?" },
      { id: crypto.randomUUID(), role: "assistant", content: "One recorded set, partial session." },
    ]);
    classification(actionIntent("plan_revision"));
    const response = await send("Can you adjust my plan based on that?");
    assert.equal(response.status, 200);
    assert.equal(response.body.kind, "proposal");
    assert.equal(events.proposals.length, 1);
    assert.equal(events.proposals[0].workoutEvidence, evidence);
    assert.equal(response.body.proposal.status, "pending");
    assert.equal(events.released, 1);
  });
});
test("workout evidence is budgeted and reviewed with the same structured provider and actual usage settlement", async () => {
  const calls = [],
    reservations = [],
    settlements = [];
  const transport = {
    responses: {
      parse: async (request) => {
        calls.push(request);
        return {
          status: "completed",
          output_parsed:
            calls.length === 1
              ? { message: "One recorded set.", exerciseIds: [] }
              : {
                  inScope: true,
                  safe: true,
                  groundedExercises: true,
                  honestNutrition: true,
                  private: true,
                },
          usage: { input_tokens: 100, output_tokens: 20 },
        };
      },
    },
  };
  const monitor = {
    reserve: async (...args) => {
      reservations.push(args);
      return async (...args) => settlements.push(args);
    },
  };
  const instance = provider.createOpenAIProvider(config, monitor, transport),
    input = {
      message: "How did I do in my last workout?",
      history: [],
      profile: {},
      workoutEvidence: evidence,
    },
    signal = new AbortController().signal;
  const draft = await instance.generate(input, actionIntent(), [], signal);
  await instance.review(input, draft, [], signal);
  assert.equal(calls.length, 2);
  assert.equal(reservations.length, 2);
  assert.equal(settlements.length, 2);
  for (const call of calls) {
    assert.deepEqual(
      JSON.parse(call.input[0].content).request.workoutEvidence,
      JSON.parse(JSON.stringify(evidence)),
    );
    assert.match(call.instructions, /workoutEvidence/);
    assert.equal(call.store, false);
  }
  assert.ok(reservations[0][0] > JSON.stringify(evidence).length);
  assert.deepEqual(settlements[0][3], { inputTokens: 100, outputTokens: 20 });
});
test("date/exercise misses are bounded and do not invent a historical comparison", async () => {
  const db = database({});
  const request = intent("What weight did I use for chest press?", []);
  assert.equal(request.exerciseText, "chest press");
  await stub(
    [
      [
        service,
        "queryCompletedWorkouts",
        async (_context, options) => {
          assert.equal(options.limit, 30);
          return [session];
        },
      ],
    ],
    async () =>
      assert.equal(
        (await loadWorkoutEvidence({ db, userId }, "conv", [], request, "UTC")).status,
        "no_match",
      ),
  );
  await stub(
    [
      [service, "queryCompletedWorkouts", async () => [session]],
      [service, "previousWorkouts", async () => []],
    ],
    async () => {
      const result = await loadWorkoutEvidence(
        { db, userId },
        "conv",
        [],
        { ...intent("Am I getting stronger?", []), progression: false },
        "UTC",
      );
      assert.equal(result.sessions.length, 1);
      assert.deepEqual(result.comparisons, []);
    },
  );
});
test("history failure produces unavailable response, no saved turn or proposal and releases admission", async () => {
  await coachHarness(
    async ({ events, send }) =>
      await stub(
        [
          [
            workoutHistory,
            "loadWorkoutEvidence",
            async () => {
              throw new (load("src/lib/api/http.ts").ApiError)(
                503,
                "WORKOUT_HISTORY_UNAVAILABLE",
                "Your saved workout history could not be loaded. Please try again.",
              );
            },
          ],
        ],
        async () => {
          const result = await send("How did I do in my last workout?");
          assert.equal(result.status, 503);
          assert.match(JSON.stringify(result.body), /WORKOUT_HISTORY_UNAVAILABLE/);
          assert.equal(events.appended.length, 0);
          assert.equal(events.generated.length, 0);
          assert.equal(events.proposals.length, 0);
          assert.equal(events.released, 1);
        },
      ),
  );
});
test("oversized historical context is bounded before reaching any provider", async () => {
  const oversized = structuredClone(earlier);
  oversized.snapshot.exercises[0].name = "x".repeat(20000);
  const db = database({});
  await stub(
    [
      [service, "queryCompletedWorkouts", async () => [session]],
      [service, "previousWorkouts", async () => [oversized]],
    ],
    async () => {
      const result = await loadWorkoutEvidence(
        { db, userId },
        "conv",
        [],
        { ...intent("Am I getting stronger?", []), progression: false },
        "UTC",
      );
      assert.equal(result.contextLimited, true);
      assert.equal(result.sessions.length, 1);
      assert.deepEqual(result.comparisons, []);
    },
  );
  await stub(
    [[service, "queryCompletedWorkouts", async () => [oversized]]],
    async () =>
      await assert.rejects(
        loadWorkoutEvidence(
          { db, userId },
          "conv",
          [],
          intent("How did I do in my last workout?", []),
          "UTC",
        ),
        (error) => error.code === "WORKOUT_HISTORY_UNAVAILABLE",
      ),
  );
});
test("authenticated count/list requests deliver authoritative totals to the existing Coach and reviewer instead of pinned actuals", async () => {
  const summary = {
    totalCompleted: 4,
    matchedCount: 2,
    countsByRegion: { upper: 2, lower: 2, full: 0, unknown: 0 },
    offset: 0,
    limit: 30,
    hasMore: false,
    rows: [
      {
        id: session.id,
        name: "Upper A",
        completedAt: session.finished_at,
        planId: plan.id,
        weekday: 1,
        region: "upper",
      },
      {
        id: earlier.id,
        name: "Upper B",
        completedAt: earlier.finished_at,
        planId: plan.id,
        weekday: 2,
        region: "upper",
      },
    ],
  };
  await coachHarness(async ({ events, send, history }) => {
    history([
      { id: crypto.randomUUID(), role: "user", content: "How did I do in my last workout?" },
      { id: crypto.randomUUID(), role: "assistant", content: "Upper A: one recorded set." },
    ]);
    let generated, reviewed;
    const db = {
      rpc: async (name, args) => {
        assert.equal(name, "completed_workout_history");
        assert.equal(args.p_region, "upper");
        return { data: summary, error: null };
      },
      from: () => assert.fail("A count must not use pinned detail records"),
    };
    await stub(
      [
        [auth, "requireUser", async () => ({ userId, db })],
        [workoutHistory, "loadWorkoutEvidence", loadWorkoutEvidence],
        [
          provider,
          "createOpenAIProvider",
          () => ({
            classify: async () => actionIntent(),
            generate: async (input) => {
              generated = input.workoutEvidence;
              return {
                message: `You have ${input.workoutEvidence.summary.matchedCount} completed upper-body workouts: Upper A and Upper B. There are ${input.workoutEvidence.summary.totalCompleted} completed workouts in total.`,
                exerciseIds: [],
              };
            },
            review: async (input) => {
              reviewed = input.workoutEvidence;
              return {
                inScope: true,
                safe: true,
                groundedExercises: true,
                honestNutrition: true,
                private: true,
              };
            },
          }),
        ],
      ],
      async () => {
        const result = await send("How many completed upper-body workouts do I have? List them.");
        assert.equal(result.status, 200);
        assert.match(result.body.message, /2 completed upper-body/);
        assert.match(result.body.message, /4 completed workouts in total/);
        assert.deepEqual(generated.summary, summary);
        assert.deepEqual(reviewed.summary, summary);
        assert.equal(events.appended[0].name, "append_coach_turn");
        assert.equal(events.released, 1);
      },
    );
  });
});

test("progression flows through authenticated Coach, independent review and review-only plan adjustment", async () => {
  const progressionStore = load("src/lib/workouts/progression-history.ts");
  await coachHarness(async ({ events, send, history, classification }) => {
    const current = structuredClone(session),
      old = structuredClone(earlier);
    for (const row of [current, old]) {
      row.snapshot.title = "Upper B";
      row.snapshot.exercises[0].bodyweight = false;
      row.snapshot.exercises[0].loadApplicable = true;
    }
    current.performance.exercises[0].sets[0] = { load: 25, amount: 12, done: true };
    old.performance.exercises[0].sets[0] = { load: 25, amount: 10, done: true };
    const db = {
      from(table) {
        const q = {
          select() {
            return q;
          },
          eq() {
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
            return Promise.resolve({ data: { workout_ids: [current.id, old.id] }, error: null });
          },
        };
        return q;
      },
    };
    const value = {
      sessions: [current, old],
      matchingCount: 2,
      sampleLimit: 30,
      frequency: {
        from: "2026-10-10T00:00:00Z",
        until: "2026-11-07T00:00:00Z",
        timeZone: "UTC",
        completedWorkouts: 2,
        trainingDays: 2,
        days: [
          { day: "2026-11-03", workouts: 1 },
          { day: "2026-11-05", workouts: 1 },
        ],
      },
    };
    await stub(
      [
        [auth, "requireUser", async () => ({ userId, db })],
        [workoutHistory, "loadWorkoutEvidence", loadWorkoutEvidence],
        [
          progressionStore,
          "progressionHistory",
          async (context) => {
            assert.equal(context.userId, userId);
            return value;
          },
        ],
        [service, "queryCompletedWorkouts", async () => [current, old]],
      ],
      async () => {
        const reply = await send("Am I getting stronger?");
        assert.equal(reply.status, 200);
        assert.ok(
          events.generated[0].workoutEvidence.progression.comparisons.some(
            (row) => row.outcome === "recorded_improvement",
          ),
        );
        assert.equal(
          events.reviewed[0].workoutEvidence.progression,
          events.generated[0].workoutEvidence.progression,
        );
        assert.equal(events.appended[0].name, "append_coach_turn_with_workouts");
        history([
          { id: crypto.randomUUID(), role: "user", content: "Am I getting stronger?" },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Your logged repetitions increased.",
          },
        ]);
        classification(actionIntent("plan_revision"));
        const revised = await send("Can you adjust my plan based on my progress?");
        assert.equal(revised.status, 200);
        assert.equal(revised.body.kind, "proposal");
        assert.equal(revised.body.proposal.status, "pending");
        assert.ok(events.proposals[0].workoutEvidence.progression);
        assert.equal(events.admitted, 2);
        assert.equal(events.released, 2);
      },
    );
  });
});

test("plan adjustment with a stale progression reference asks for clarification without creating a proposal", async () => {
  await coachHarness(async ({ events, send, history, classification }) => {
    history([
      { role: "user", content: "Am I getting stronger?" },
      { role: "assistant", content: "Earlier comparison" },
    ]);
    classification(actionIntent("plan_revision"));
    await stub(
      [
        [
          workoutHistory,
          "loadWorkoutEvidence",
          async () => ({ ...evidence, status: "reference_missing", sessions: [] }),
        ],
      ],
      async () => {
        const result = await send("Can you adjust my plan based on my progress?");
        assert.equal(result.status, 200);
        assert.equal(result.body.status, "clarification");
        assert.equal(events.proposals.length, 0);
        assert.match(result.body.message, /Which workout or exercise/);
      },
    );
  });
});

test("reported training-plan wording keeps the compared Upper B pair instead of a newer Upper A", async () => {
  const store = load("src/lib/workouts/progression-history.ts");
  await coachHarness(async ({ events, send, history, classification }) => {
    const newer = structuredClone(session),
      older = structuredClone(earlier);
    newer.snapshot.title = older.snapshot.title = "Upper B";
    newer.finished_at = "2026-11-05T19:32:00Z";
    older.finished_at = "2026-11-05T19:17:00Z";
    history([
      {
        id: crypto.randomUUID(),
        role: "user",
        content: "How did my last two Upper B workouts compare?",
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "The two Upper B sessions were compared.",
      },
    ]);
    classification(actionIntent("plan_revision"));
    const db = {
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
    let queries = 0;
    await stub(
      [
        [auth, "requireUser", async () => ({ userId, db })],
        [workoutHistory, "loadWorkoutEvidence", loadWorkoutEvidence],
        [
          store,
          "progressionHistory",
          async (context, options) => {
            queries++;
            assert.equal(context.userId, userId);
            assert.equal(options.title, "Upper B");
            return {
              sessions: [newer, older],
              matchingCount: 2,
              sampleLimit: 30,
              frequency: {
                from: options.from,
                until: options.until,
                timeZone: "Europe/London",
                completedWorkouts: 3,
                trainingDays: 2,
                days: [
                  { day: "2026-11-05", workouts: 2 },
                  { day: "2026-11-06", workouts: 1 },
                ],
              },
            };
          },
        ],
        [
          service,
          "queryCompletedWorkouts",
          async () => assert.fail("No legacy latest-Upper-A selection"),
        ],
      ],
      async () => {
        const response = await send("Can you adjust my training plan based on recent progress?");
        assert.equal(response.status, 200);
        assert.equal(response.body.proposal.status, "pending");
        assert.equal(queries, 1);
        assert.ok(events.proposals[0].workoutEvidence.progression);
        assert.deepEqual(
          events.proposals[0].workoutEvidence.sessions.map((row) => row.name),
          ["Upper B", "Upper B"],
        );
        assert.equal(
          events.proposals[0].workoutEvidence.sessions[0].completedAt,
          newer.finished_at,
        );
        assert.equal(
          events.proposals[0].workoutEvidence.sessions[1].completedAt,
          older.finished_at,
        );
      },
    );
  });
});
