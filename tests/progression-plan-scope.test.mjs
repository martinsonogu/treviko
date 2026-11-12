import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSource as load } from "./load-source.mjs";
import { proposal, conversationId, userId } from "./conversation-fixture.mjs";
const intents = load("src/lib/coach/workout-history-intent.ts"),
  workflow = load("src/lib/coaching/workflow.ts");
const profiles = load("src/lib/profile/service.ts"),
  plans = load("src/lib/coaching/service.ts"),
  conversations = load("src/lib/persistence/conversations.ts"),
  shared = load("src/lib/persistence/shared-ai.ts"),
  generation = load("src/lib/coaching/generation.ts"),
  historyService = load("src/lib/coach/workout-history.ts"),
  admin = load("src/lib/supabase/admin.ts"),
  configuration = load("src/lib/coach/config.ts");
const config = configuration.getCoachConfig({
  OPENAI_API_KEY: "mock",
  OPENAI_MODEL: "mock",
  NODE_ENV: "test",
});
const history = [
  { role: "user", content: "How did my last two Upper B workouts compare?" },
  { role: "assistant", content: "Two Upper B sessions at 19:17 and 19:32 were compared." },
];
const selection = intents.workoutHistoryRequest(
  "Adjust my training plan based on recent progress.",
  history,
);
const pair = [
  {
    id: "88888888-8888-4888-8888-888888888888",
    name: "Upper B",
    completedAt: "2026-11-05T19:32:00Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    name: "Upper B",
    completedAt: "2026-11-05T19:17:00Z",
  },
];
const evidence = {
  status: "found",
  request: selection,
  timeZone: "Europe/London",
  sessions: pair,
  comparisons: [],
  progression: {
    outcome: "recorded_consistency",
    selectedSessionIds: pair.map((row) => row.id),
    comparisons: [{ current: { sessionId: pair[0].id }, previous: { sessionId: pair[1].id } }],
  },
};
async function stub(entries, fn) {
  const old = entries.map(([o, k, v]) => {
    const before = o[k];
    o[k] = v;
    return [o, k, before];
  });
  try {
    return await fn();
  } finally {
    for (const [o, k, v] of old) o[k] = v;
  }
}
async function harness(fn) {
  const events = { reads: [], generated: [], stored: 0, released: 0, appended: [] };
  let result = evidence,
    records = history;
  const profile = {
    ...load("src/lib/profile/schema.ts").emptyProfile(),
    equipment: ["dumbbells"],
    trainingDays: 2,
  };
  await stub(
    [
      [configuration, "getCoachConfig", () => config],
      [profiles, "getProfile", async () => profile],
      [
        plans,
        "getActivePlan",
        async () => ({ id: proposal.id, version: 1, payload: proposal.payload }),
      ],
      [plans, "getProfileGuard", async () => ({ saved: true })],
      [conversations, "getConversation", async () => ({ id: conversationId, messages: records })],
      [shared, "acquireSharedRequest", async () => async () => events.released++],
      [shared, "persistentUsageMonitor", () => ({ reserve: async () => async () => {} })],
      [
        historyService,
        "loadWorkoutEvidence",
        async (context, id, messages, request) => {
          assert.equal(context.userId, userId);
          assert.equal(id, conversationId);
          events.reads.push(request);
          return result;
        },
      ],
      [
        generation,
        "generatePlanProposal",
        async (context) => {
          events.generated.push(context);
          return proposal.payload;
        },
      ],
      [
        plans,
        "storeProposal",
        async () => {
          events.stored++;
          return proposal;
        },
      ],
      [plans, "publishProposal", async () => assert.fail("Diagnostic fix must not publish")],
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
      fn({
        events,
        result: (value) => (result = value),
        history: (value) => (records = value),
        send: (message, admission) =>
          workflow.proposePlan(
            { userId, db: {} },
            { message, conversationId, scope: "training_only" },
            { signal: new AbortController().signal },
            admission,
          ),
      }),
  );
}
test("reported wording and revision verbs consistently request structured progression without losing Upper B focus", () => {
  for (const message of [
    "Adjust my training plan based on recent progress.",
    "Can you revise my workout plan based on my performance?",
    "Change my training plan based on training history.",
    "Update my plan based on my progress.",
  ]) {
    const actual = intents.workoutHistoryRequest(message, history);
    assert.equal(actual.progression, true, message);
    assert.equal(actual.sessionLabel, "Upper B", message);
  }
  const broader = intents.workoutHistoryRequest(
    "Adjust my entire training plan based on overall recent progress.",
    history,
  );
  assert.equal(broader.sessionLabel, undefined);
  assert.equal(broader.useReference, false);
});
test("direct proposal endpoint obtains the same structured pair and retains ordinary pending-only persistence", async () =>
  harness(async ({ events, send }) => {
    const response = await send("Adjust my training plan based on recent progress.");
    assert.equal(response.proposal.status, "pending");
    assert.equal(events.reads.length, 1);
    assert.equal(events.reads[0].progression, true);
    assert.equal(events.reads[0].sessionLabel, "Upper B");
    assert.equal(events.generated[0].workoutEvidence, evidence);
    assert.equal(events.stored, 1);
    assert.equal(events.released, 1);
    assert.deepEqual(
      events.appended[0].args.p_workouts,
      pair.map((row) => row.id),
    );
  }));
test("legacy single-session admission is replaced; an existing complete progression admission is reused", async () =>
  harness(async ({ events, send }) => {
    const admission = {
      conversationId,
      config,
      workoutEvidence: {
        status: "found",
        sessions: [{ id: "77777777-7777-4777-8777-777777777777", name: "Upper A" }],
      },
    };
    await send("Adjust my training plan based on recent progress.", admission);
    assert.equal(events.reads.length, 1);
    assert.equal(events.generated[0].workoutEvidence, evidence);
    await send("Adjust my training plan based on recent progress.", {
      ...admission,
      workoutEvidence: evidence,
    });
    assert.equal(events.reads.length, 1);
    assert.equal(events.generated[1].workoutEvidence, evidence);
  }));
test("missing progression cannot be represented as a progress-based saved revision", async () =>
  harness(async ({ events, send, result }) => {
    for (const status of ["reference_missing", "no_completed", "no_match"]) {
      result({ status, sessions: [] });
      await assert.rejects(
        send("Adjust my training plan based on recent progress."),
        (error) => error.code === "PROGRESSION_EVIDENCE_REQUIRED",
      );
    }
    assert.equal(events.generated.length, 0);
    assert.equal(events.stored, 0);
    assert.equal(events.appended.length, 0);
    assert.equal(events.released, 3);
  }));
test("contextual acceptance carries pending progress evidence, but completed proposals do not resurrect old requests", async () =>
  harness(async ({ events, send, history: records }) => {
    const original = "Adjust my training plan based on recent progress.";
    records([
      ...history,
      { role: "user", content: original },
      { role: "assistant", content: "I can create a revised workout plan." },
    ]);
    await send("Go on");
    assert.equal(events.reads.length, 1);
    assert.equal(events.generated[0].workoutEvidence, evidence);
    assert.equal(
      intents.progressionPlanRequestMessage("Go on", [
        { role: "user", content: original },
        { role: "assistant", content: "Proposed plan (not active): Already prepared" },
      ]),
      null,
    );
  }));
