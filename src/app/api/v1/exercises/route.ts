import { NextRequest, NextResponse } from 'next/server';
import { filterExercises, resolveMuscle } from '@/lib/training/service';
import { apiError } from '@/lib/training/http';
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('muscle');
  const muscle = query === null ? undefined : resolveMuscle(query);
  const legs = query?.trim().toLowerCase() === 'legs';
  if (query !== null && !muscle && !legs) return apiError('INVALID_MUSCLE', 'Unsupported muscle group.', 400);
  const data = legs ? filterExercises().filter(e => e.primaryMuscles.some(m => ['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(m))) : filterExercises(muscle);
  return NextResponse.json({ data, count: data.length, error: null });
}
