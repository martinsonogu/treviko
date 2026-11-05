import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import nextServer from 'next/server.js';
const { NextRequest } = nextServer;
import { loadSource as load } from './load-source.mjs';
const service = load('src/lib/training/service.ts');
const { exercises } = load('src/lib/exercises.ts');
const { muscleGroups, equipmentOptions, experienceLevels } = load('src/lib/training/types.ts');
const { validateRecommendation } = load('src/lib/training/validation.ts');
const listRoute = load('src/app/api/v1/exercises/route.ts');
const detailRoute = load('src/app/api/v1/exercises/[slug]/route.ts');
const recommendationRoute = load('src/app/api/v1/training/recommendations/route.ts');
const request = body => new Request('http://localhost/api/v1/training/recommendations', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const valid = { muscle: 'Traps', experience: 'beginner', equipment: ['dumbbells', 'bench'] };

test('library has 40+ unique records and complete muscle coverage', () => {
  assert.ok(exercises.length >= 40);
  assert.equal(new Set(exercises.map(e => e.id)).size, exercises.length);
  assert.equal(new Set(exercises.map(e => e.slug)).size, exercises.length);
  for (const muscle of muscleGroups) assert.ok(exercises.some(e => e.primaryMuscles.includes(muscle)));
  for (const e of exercises) {
    assert.match(e.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const field of ['instructions', 'commonMistakes', 'safetyTips', 'alternatives']) assert.ok(e[field].length, `${e.slug}: ${field}`);
    for (const muscle of [...e.primaryMuscles, ...e.secondaryMuscles]) assert.ok(muscleGroups.includes(muscle));
    assert.ok(e.requiredEquipment.every(item => equipmentOptions.includes(item)));
    assert.ok(experienceLevels.includes(e.difficulty));
    for (const slug of e.alternatives) { assert.notEqual(slug, e.slug); assert.ok(service.getExercise(slug)); }
  }
});
for (const [phrase, expected] of [
  ['I want to train my traps.', ['Traps']], ['How can I grow my lats?', ['Lats']],
  ['Give me a chest workout.', ['Chest']], ['I want bigger shoulders.', ['Shoulders']],
  ['What exercises work my glutes?', ['Glutes']], ['BICEPS and upper back', ['Biceps', 'Upper back']],
  ['Work my core and calves', ['Calves', 'Abs']], ['a laptop and a trapdoor', []], ['   ', []],
]) test(`muscle identification: ${phrase}`, () => assert.deepEqual(service.identifyMuscles(phrase), expected));

test('filtering includes primary and secondary muscles', () => {
  assert.equal(service.filterExercises().length, exercises.length);
  for (const muscle of muscleGroups) assert.ok(service.filterExercises(muscle).every(e => [...e.primaryMuscles, ...e.secondaryMuscles].includes(muscle)));
  assert.ok(service.filterExercises('Lats').some(e => e.slug === 'chest-supported-row'));
});
test('equipment checks every requirement; bodyweight is always compatible', () => {
  assert.equal(service.isEquipmentCompatible(['dumbbells', 'bench'], ['dumbbells']), false);
  assert.equal(service.isEquipmentCompatible(['dumbbells'], []), false);
  assert.equal(service.isEquipmentCompatible([], []), true);
});
test('recommendations respect experience, equipment, target and set counts across all inputs', () => {
  for (const muscle of muscleGroups) for (const experience of experienceLevels) for (const equipment of [[], ['resistance-band'], ['dumbbells'], [...equipmentOptions]]) {
    const result = service.recommend({ muscle, experience, equipment });
    assert.ok(result.length <= 4);
    for (const e of result) {
      assert.ok([...e.primaryMuscles, ...e.secondaryMuscles].includes(muscle));
      assert.ok(e.requiredEquipment.every(item => equipment.includes(item)));
      assert.ok(experienceLevels.indexOf(e.difficulty) <= experienceLevels.indexOf(experience));
      assert.equal(e.prescription.sets, experience === 'beginner' ? 2 : experience === 'intermediate' ? 3 : 4);
    }
  }
});
test('recommendations prioritise primary targets and preserve duration units', () => {
  const data = service.recommend({ muscle: 'Abs', experience: 'beginner', equipment: [] });
  assert.ok(data[0].primaryMuscles.includes('Abs'));
  const firstSecondary = data.findIndex(e => !e.primaryMuscles.includes('Abs'));
  if (firstSecondary >= 0) assert.ok(data.slice(firstSecondary).every(e => !e.primaryMuscles.includes('Abs')));
  assert.equal(data.find(e => e.slug === 'forearm-plank').prescription.unit, 'seconds');
});
test('no compatible exercises returns an empty result, never invented equipment', () => assert.deepEqual(service.recommend({ muscle: 'Biceps', experience: 'beginner', equipment: [] }), []));
test('unknown slug is absent', () => assert.equal(service.getExercise('not-an-exercise'), undefined));
test('runtime validation rejects malformed and missing inputs', () => {
  for (const value of [null, [], {}, { ...valid, muscle: 'neck' }, { ...valid, experience: 'expert' }, { ...valid, equipment: 'gym' }, { ...valid, equipment: ['barbell'] }, { ...valid, equipment: ['bench', 'bench'] }, { ...valid, extra: true }, { ...valid, muscle: 3 }]) assert.equal(validateRecommendation(value).success, false);
  assert.equal(validateRecommendation(valid).success, true);
  assert.equal(validateRecommendation({ ...valid, equipment: [] }).success, true);
});
test('list API returns consistent envelopes and legacy Legs filter', async () => {
  for (const muscle of [null, ...muscleGroups, 'Legs']) {
    const response = await listRoute.GET(new NextRequest('http://localhost/api/v1/exercises' + (muscle ? '?muscle=' + encodeURIComponent(muscle) : '')));
    const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.error, null); assert.equal(body.count, body.data.length); assert.ok(body.count > 0);
  }
  for (const muscle of ['', 'unknown']) { const response = await listRoute.GET(new NextRequest('http://localhost/api/v1/exercises?muscle=' + muscle)); assert.equal(response.status, 400); assert.equal((await response.json()).data, null); }
});
test('detail API resolves exact slug and returns 404 for missing exercises', async () => {
  for (const slug of ['dumbbell-shrug', 'missing']) {
    const response = await detailRoute.GET(new Request('http://localhost'), { params: Promise.resolve({ slug }) });
    assert.equal(response.status, slug === 'missing' ? 404 : 200);
    const body = await response.json();
    if (slug === 'missing') assert.equal(body.error.code, 'NOT_FOUND'); else assert.equal(body.data.slug, slug);
  }
});
test('recommendation API validates JSON and returns deterministic metadata', async () => {
  for (const value of ['{', null, {}, { ...valid, equipment: [null] }]) { const response = await recommendationRoute.POST(request(value)); assert.equal(response.status, 400); const body = await response.json(); assert.equal(body.data, null); assert.ok(body.error.message); }
  const response = await recommendationRoute.POST(request(valid)); assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.meta.mode, 'deterministic'); assert.equal(body.error, null); assert.ok(body.data.length);
  const empty = await (await recommendationRoute.POST(request({ ...valid, muscle: 'Biceps', equipment: [] }))).json(); assert.deepEqual(empty.data, []);
});
test('every exercise maps to its own truthful media placeholder or attributed visual', () => {
  const Media = load('src/components/training/ExerciseMedia.tsx').default;
  for (const exercise of exercises) {
    const html = renderToStaticMarkup(React.createElement(Media, { exercise }));
    assert.ok(html.includes(exercise.name));
    if (exercise.media.status === 'placeholder') { assert.equal(exercise.media.images.length, 0); assert.match(html, /not a movement demonstration/); assert.match(html, /role="img"/); }
    else for (const image of exercise.media.images) { assert.ok(image.src && image.source && image.license && image.alt.includes(exercise.name)); }
  }
});
test('instruction tabs default to movement with optional equipment hidden', () => {
  const Tabs = load('src/components/training/ExerciseInstructions.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Tabs, { exercise: exercises[0] }));
  assert.match(html, /aria-selected="true"[^>]*>How to Perform/);
  assert.match(html, /id="instruction-panel-1"[^>]*hidden/);
});
test('all existing pages still render and coach retains its contract', async () => {
  for (const name of ['', 'training/', 'coach/', 'nutrition/', 'progress/']) {
    const Page = load(`src/app/${name}page.tsx`).default;
    assert.ok(renderToStaticMarkup(React.createElement(Page)).length > 20);
  }
  const health = await (await load('src/app/api/v1/health/route.ts').GET()).json(); assert.equal(health.status, 'ok');
  const coach = load('src/app/api/v1/coach/route.ts');
  for (const [message, allowed] of [['Train my traps', true], ['Biceps', true], ['Write Python code', false]]) {
    const response = await coach.POST(new NextRequest('http://localhost/api/v1/coach', { method: 'POST', body: JSON.stringify({ message }) }));
    const data = await response.json(); assert.equal(data.allowed, allowed); assert.equal(data.mode, 'demo');
    if (message === 'Train my traps') assert.ok(data.exerciseIds.includes('shrug'));
  }
});
