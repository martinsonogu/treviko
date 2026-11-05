import { NextResponse } from 'next/server';
import { getExercise } from '@/lib/training/service';
import { apiError } from '@/lib/training/http';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exercise = getExercise(slug);
  return exercise ? NextResponse.json({ data: exercise, error: null }) : apiError('NOT_FOUND', 'Exercise not found.', 404);
}
