import { existsSync } from "node:fs";

// CI, production-only installs and source archives do not need local Git hooks.
if (
  process.env.HUSKY !== "0" &&
  !process.env.CI &&
  process.env.NODE_ENV !== "production" &&
  existsSync(".git")
) {
  const { default: husky } = await import("husky");
  const result = husky();
  if (result) {
    console.error(result);
    process.exitCode = 1;
  }
}
