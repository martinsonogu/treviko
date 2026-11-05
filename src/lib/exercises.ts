import library from './training/library';
export { muscleGroups } from './training/types';
export type { Exercise } from './training/types';
// Typed records retain stable IDs and explicit relationships for a future database migration.
export const exercises = library;
