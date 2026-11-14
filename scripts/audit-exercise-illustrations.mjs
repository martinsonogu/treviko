// Read-only validation of released assets; no internal review files required.
import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { loadSource } from "../tests/load-source.mjs";
const { exercises } = loadSource("src/lib/exercises.ts");
const { approvedIllustrations, getApprovedIllustration } = loadSource(
  "src/lib/training/illustrations/approved.ts",
);
const expected = new Set();
const hashes = new Set();
for (const exercise of exercises) {
  const asset = getApprovedIllustration(exercise.id);
  if (!asset) throw Error(`Missing approved illustration: ${exercise.id}`);
  const file = `public${asset.src}`;
  expected.add(file);
  const bytes = fs.readFileSync(file);
  const metadata = await sharp(bytes).metadata();
  await sharp(bytes).raw().toBuffer();
  if (
    metadata.format !== "webp" ||
    metadata.width !== 1024 ||
    metadata.height !== 1024 ||
    metadata.space !== "srgb" ||
    metadata.hasAlpha ||
    bytes.length > 250 * 1024 ||
    createHash("sha256").update(bytes).digest("hex") !== asset.sha256 ||
    hashes.has(asset.sha256)
  )
    throw Error(`Invalid or duplicate illustration: ${exercise.id}`);
  hashes.add(asset.sha256);
}
const walk = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
    );
const unexpected = walk("public/exercises").filter(
  (file) => file !== "public/exercises/LICENSE.md" && !expected.has(file),
);
if (unexpected.length || Object.keys(approvedIllustrations).length !== exercises.length)
  throw Error(`Unexpected assets or registry entries: ${unexpected.join(", ")}`);
if (!fs.existsSync("public/exercises/LICENSE.md")) throw Error("Illustration licence missing");
console.log(
  `Validated ${exercises.length} public illustrations: dimensions, format, hashes, size and licence.`,
);
