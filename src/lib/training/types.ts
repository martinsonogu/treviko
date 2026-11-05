export const muscleGroups = ['Traps', 'Lats', 'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Upper back'] as const;
export type Muscle = typeof muscleGroups[number];
export const experienceLevels = ['beginner', 'intermediate', 'advanced'] as const;
export type Experience = typeof experienceLevels[number];
export const equipmentOptions = ['dumbbells', 'bench', 'resistance-band', 'pull-up-bar', 'cable-machine', 'lat-pulldown-machine', 'chest-press-machine', 'leg-extension-machine', 'leg-curl-machine'] as const;
export type Equipment = typeof equipmentOptions[number];
export type ExerciseImage = { position: 'start' | 'finish'; src: string; alt: string; source: string; license: string };
export type Exercise = {
  id: string; slug: string; name: string;
  primaryMuscles: Muscle[]; secondaryMuscles: Muscle[];
  requiredEquipment: Equipment[]; difficulty: Experience; targetRegion: string | null;
  instructions: string[]; commonMistakes: string[]; safetyTips: string[]; setup: string[];
  prescription: { sets: number; reps: string; unit: 'reps' | 'seconds' };
  alternatives: string[];
  media: { status: 'placeholder' | 'verified'; images: ExerciseImage[]; video: { src: string; title: string; source: string; license: string } | null };
};
export type RecommendationInput = { muscle: Muscle; experience: Experience; equipment: Equipment[] };
