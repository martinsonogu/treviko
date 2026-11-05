import { NextResponse } from 'next/server';
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}
