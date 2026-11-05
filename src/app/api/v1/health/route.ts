import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ app: 'Treviko', status: 'ok', version: 'v1', mode: 'demo' }); }
