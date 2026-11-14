import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadSource as load } from "./load-source.mjs";
const { exercises } = load("src/lib/exercises.ts");
const { approvedIllustrations, getApprovedIllustration } = load(
  "src/lib/training/illustrations/approved.ts",
);
const { default: ExerciseIllustration } = load("src/components/training/ExerciseIllustration.tsx");
const { default: ExerciseMedia } = load("src/components/training/ExerciseMedia.tsx");
test("48 released assets match the catalogue and pass validation", () => {
  assert.equal(exercises.length, 48);
  assert.deepEqual(
    Object.keys(approvedIllustrations).sort(),
    exercises.map((row) => row.id).sort(),
  );
  assert.match(
    execFileSync(process.execPath, ["scripts/audit-exercise-illustrations.mjs"], {
      encoding: "utf8",
    }),
    /Validated 48/,
  );
});
test("every exercise renders its approved public image and accessible alt text", () => {
  for (const exercise of exercises) {
    const asset = getApprovedIllustration(exercise.id);
    const html = renderToStaticMarkup(React.createElement(ExerciseMedia, { exercise }));
    assert.ok(asset.alt.trim());
    assert.match(html, /<img/);
    const src = html.match(/<img[^>]*src="([^"]+)"/)?.[1];
    assert.ok(src);
    assert.ok(decodeURIComponent(src).includes(asset.src));
    assert.doesNotMatch(html, /api\/dev|assets\/exercise-illustrations/);
    assert.equal(asset.review.license, "CC-BY-4.0");
    assert.ok(existsSync(asset.review.provenance));
  }
});
test("missing and incomplete approvals fail closed", () => {
  for (const id of ["unknown", "__proto__", "../../press"])
    assert.equal(getApprovedIllustration(id), null);
  const original = approvedIllustrations.press;
  for (const asset of [
    { ...original, review: { ...original.review, anatomy: "pending" } },
    { ...original, review: { ...original.review, rights: "pending" } },
    { ...original, review: { ...original.review, reviewer: "" } },
    { ...original, sha256: "" },
    { ...original, width: 0 },
    { ...original, src: "/private/press.webp" },
  ])
    assert.equal(getApprovedIllustration("press", { press: asset }), null);
});
test("unknown exercises retain truthful fallbacks", () => {
  assert.equal(
    renderToStaticMarkup(React.createElement(ExerciseIllustration, { exerciseId: "unknown" })),
    "",
  );
  const html = renderToStaticMarkup(
    React.createElement(ExerciseMedia, { exercise: { ...exercises[0], id: "unknown" } }),
  );
  assert.match(html, /Media placeholder/);
  assert.doesNotMatch(html, /<img/);
});
test("approved workout images remain responsive and lazy with attribution", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExerciseIllustration, { exerciseId: "row" }),
  );
  assert.match(html, /width:100%/);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /CC BY 4.0/);
  assert.match(
    readFileSync("public/exercises/LICENSE.md", "utf8"),
    /Creative Commons Attribution 4.0/,
  );
});
