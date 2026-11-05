import { NextResponse } from 'next/server';
import { recommend } from '@/lib/training/service';
import { validateRecommendation } from '@/lib/training/validation';
import { apiError } from '@/lib/training/http';
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const result = validateRecommendation(body);
  if (!result.success) return apiError('INVALID_INPUT', result.error, 400);
  const data = recommend(result.data);
  return NextResponse.json({ data, count: data.length, error: null, meta: { mode: 'deterministic', ...result.data } });
}
