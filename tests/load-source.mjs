// Compile source in memory so tests exercise the real services and route handlers.
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import fs from 'node:fs';
import path from 'node:path';
const cache = new Map();
function loadSource(relative) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, resolveJsonModule: true },
    fileName: file,
  }).outputText;
  const localRequire = name => {
    // Next.js enforces server-only boundaries during its build. Tests run on Node.
    if (name === 'server-only') return {};
    if (!name.startsWith('@/') && !name.startsWith('.')) return require(name);
    const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
    if (base.endsWith('.json')) return JSON.parse(fs.readFileSync(base, 'utf8'));
    const target = ['.ts', '.tsx', '/index.ts'].map(ext => base + ext).find(fs.existsSync);
    if (!target) throw new Error(`Unresolved source import: ${name}`);
    return loadSource(target);
  };
  new Function('require', 'module', 'exports', source)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
export { loadSource };
