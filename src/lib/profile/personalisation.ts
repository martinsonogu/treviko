import type { UserProfile } from './schema';
import type { CoachProfile } from '../coach/schemas';
export function profileForCoach(profile: UserProfile): CoachProfile {
  return {
    goals: [...profile.goals.map(g => g.replaceAll('_',' ')), ...(profile.age !== null && profile.age<18 ? [`I am ${profile.age} years old`] : [])].join('; ') || undefined,
    experience: profile.experience ?? undefined, equipment: profile.equipment ?? undefined, trainingFrequency: profile.trainingDays ?? undefined,
    dietaryPreferences: [profile.dietaryPattern !== 'unspecified' ? profile.dietaryPattern : '', profile.cuisines.length ? `Requested cuisines: ${profile.cuisines.join(', ')}` : '', profile.dislikes.length ? `Avoid disliked foods: ${profile.dislikes.join(', ')}` : ''].filter(Boolean).join('; ') || undefined,
    allergies: [...profile.allergies,profile.allergyNotes].filter(Boolean).join(', ') || undefined,
    foodBudget: profile.weeklyBudget === null ? undefined : `${profile.weeklyBudget} ${profile.budgetCurrency} per week`,
  };
}
export function projectCoachProfile(profile: CoachProfile, topic: 'fitness'|'nutrition'|'mixed'|'other'): CoachProfile {
  const fitness = topic==='fitness'||topic==='mixed'; const nutrition = topic==='nutrition'||topic==='mixed';
  return { goals: profile.goals, ...(fitness ? { experience:profile.experience,equipment:profile.equipment,trainingFrequency:profile.trainingFrequency,existingWorkoutPlan:profile.existingWorkoutPlan,recentTrainingHistory:profile.recentTrainingHistory } : {}), ...(nutrition ? { dietaryPreferences:profile.dietaryPreferences,allergies:profile.allergies,foodBudget:profile.foodBudget } : {}) };
}
