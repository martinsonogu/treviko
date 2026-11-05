import { exercises } from '../exercises';
import { experienceLevels, muscleGroups, type Equipment, type Experience, type Muscle, type RecommendationInput } from './types';

const aliases: Record<Muscle, string[]> = {
  Traps: ['traps', 'trap', 'trapezius'], Lats: ['lats', 'lat', 'latissimus'],
  Chest: ['chest', 'pecs', 'pectorals'], Shoulders: ['shoulders', 'shoulder', 'delts', 'deltoids'],
  Biceps: ['biceps', 'bicep'], Triceps: ['triceps', 'tricep'], Quads: ['quads', 'quadriceps', 'quad'],
  Hamstrings: ['hamstrings', 'hamstring'], Glutes: ['glutes', 'glute', 'gluteus'],
  Calves: ['calves', 'calf'], Abs: ['abs', 'abdominals', 'core'], 'Upper back': ['upper back', 'rhomboids'],
};
export function identifyMuscles(message: string): Muscle[] {
  return muscleGroups.filter(m => aliases[m].some(alias => new RegExp(`\\b${alias}\\b`, 'i').test(message)));
}
export function resolveMuscle(value: string): Muscle | undefined {
  const text = value.trim().toLowerCase();
  return muscleGroups.find(m => m.toLowerCase() === text || aliases[m].includes(text));
}
export function getExercise(slug: string) { return exercises.find(e => e.slug === slug); }
export function filterExercises(muscle?: Muscle) {
  // Keep Milestone 1's broad Legs query available through the API adapter.
  return muscle ? exercises.filter(e => [...e.primaryMuscles, ...e.secondaryMuscles].includes(muscle)) : exercises;
}
export function isEquipmentCompatible(required: Equipment[], available: Equipment[]) {
  return required.every(item => available.includes(item));
}
export function prescribe(exercise: typeof exercises[number], experience: Experience) {
  return { ...exercise.prescription, sets: experience === 'beginner' ? 2 : experience === 'intermediate' ? 3 : 4 };
}
export function recommend(input: RecommendationInput) {
  const rank = experienceLevels.indexOf(input.experience);
  return filterExercises(input.muscle)
    .filter(e => experienceLevels.indexOf(e.difficulty) <= rank && isEquipmentCompatible(e.requiredEquipment, input.equipment))
    .sort((a, b) => Number(b.primaryMuscles.includes(input.muscle)) - Number(a.primaryMuscles.includes(input.muscle)) || experienceLevels.indexOf(a.difficulty) - experienceLevels.indexOf(b.difficulty) || a.slug.localeCompare(b.slug))
    .slice(0, 4).map(e => ({ ...e, prescription: prescribe(e, input.experience) }));
}
