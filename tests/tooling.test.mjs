import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

test(
  "Husky stages only applicable checks and preserves partial work in a disposable Git repo",
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "treviko-hook-test-"));
    const environment = {
      ...process.env,
      CI: "",
      HUSKY: "",
      NODE_ENV: "test",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(directory, "no-global-config"),
    };
    const run = (command, args, overrides = {}) => {
      const result = spawnSync(command, args, {
        cwd: directory,
        env: { ...environment, ...overrides },
        encoding: "utf8",
        timeout: 25000,
      });
      assert.ifError(result.error);
      return { status: result.status, output: result.stdout + result.stderr };
    };
    const success = (command, args, overrides) => {
      const result = run(command, args, overrides);
      assert.equal(result.status, 0, result.output);
      return result.output;
    };
    try {
      await mkdir(path.join(directory, ".husky"));
      await mkdir(path.join(directory, "src/app"), { recursive: true });
      for (const file of [
        "eslint.config.mjs",
        "lint-staged.config.mjs",
        ".prettierrc.json",
        ".prettierignore",
        ".husky/install.mjs",
        ".husky/pre-commit",
      ])
        await copyFile(path.join(root, file), path.join(directory, file));
      await symlink(
        path.join(root, "node_modules"),
        path.join(directory, "node_modules"),
        "junction",
      );
      await writeFile(path.join(directory, ".gitignore"), "node_modules/\n.husky/_/\n");
      await writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({
          private: true,
          scripts: {
            "lint:staged": "lint-staged",
            test: 'node -e "process.exit(99)"',
            build: 'node -e "process.exit(99)"',
          },
        }),
      );
      await writeFile(path.join(directory, "src/sample.ts"), "export const count = 0;\n");
      success("git", ["init", "--quiet"]);
      success("git", ["add", "."]);
      success(
        "git",
        [
          "-c",
          "user.name=Hook fixture",
          "-c",
          "user.email=fixture@example.test",
          "commit",
          "--quiet",
          "-m",
          "Fixture baseline",
        ],
        { HUSKY: "0" },
      );

      for (const overrides of [{ CI: "true" }, { HUSKY: "0" }, { NODE_ENV: "production" }]) {
        success(process.execPath, [".husky/install.mjs"], overrides);
        assert.equal(run("git", ["config", "--get", "core.hooksPath"]).status, 1);
      }
      success(process.execPath, [".husky/install.mjs"]);
      assert.equal(success("git", ["config", "--get", "core.hooksPath"]).trim(), ".husky/_");

      // Stage valid code, then leave a deliberately invalid unstaged edit.
      const sample = path.join(directory, "src/sample.ts");
      const staged = "export const count = 1;\n";
      const unstaged = staged + "export const = ;\n";
      await writeFile(sample, staged);
      await writeFile(path.join(directory, "src/file with spaces.ts"), "export const value = 2;\n");
      await writeFile(path.join(directory, "notes.md"), "# Hook fixture\n");
      await writeFile(path.join(directory, "unsupported.sql"), "NOT A VALID SQL STATEMENT\n");
      success("git", [
        "add",
        "src/sample.ts",
        "src/file with spaces.ts",
        "notes.md",
        "unsupported.sql",
      ]);
      await writeFile(sample, unstaged);
      const good = success("git", ["hook", "run", "pre-commit"]);
      assert.match(good, /eslint --max-warnings=0/);
      assert.match(good, /prettier --check/);
      assert.equal(await readFile(sample, "utf8"), unstaged);
      assert.equal(success("git", ["show", ":src/sample.ts"]), staged);

      // Unsupported extensions do not reach ESLint or Prettier.
      success("git", ["reset", "--quiet"]);
      success("git", ["add", "unsupported.sql"]);
      const unsupported = success("git", ["hook", "run", "pre-commit"]);
      assert.doesNotMatch(unsupported, /npm (?:test|run build)/);

      const spaced = path.join(directory, "src/file with spaces.ts");
      await writeFile(spaced, "export const value={ok:true};\n");
      success("git", ["add", "src/file with spaces.ts"]);
      const formatting = run("git", ["hook", "run", "pre-commit"]);
      assert.notEqual(formatting.status, 0);
      assert.match(formatting.output, /prettier|formatting/i);

      await writeFile(spaced, "export const = ;\n");
      success("git", ["add", "src/file with spaces.ts"]);
      const lint = run("git", ["hook", "run", "pre-commit"]);
      assert.notEqual(lint.status, 0);
      assert.match(lint.output, /eslint|parsing error/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("source-archive prepare skips hook installation without requiring Husky", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "treviko-hook-archive-"));
  try {
    await copyFile(path.join(root, ".husky/install.mjs"), path.join(directory, "install.mjs"));
    const result = spawnSync(process.execPath, ["install.mjs"], {
      cwd: directory,
      env: { ...process.env, CI: "", HUSKY: "", NODE_ENV: "test" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
