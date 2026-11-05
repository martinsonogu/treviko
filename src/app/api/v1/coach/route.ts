// Legacy deterministic demonstration endpoint. Live coaching uses /api/v1/coach/messages.
import { NextRequest, NextResponse } from 'next/server';
import { classifyScope } from '@/lib/scope';
import { identifyMuscles, filterExercises } from '@/lib/training/service';
export async function POST(request: NextRequest) {
    let body: unknown;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || !('message' in body) || typeof body.message !== 'string' || body.message.length > 2000) {
        return NextResponse.json({ error: 'message must be a string of at most 2000 characters' }, { status: 400 });
    }
    const message = body.message.trim();
    if (!message)
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    const scope = classifyScope(message);
    if (!scope.allowed)
        return NextResponse.json({ mode: 'demo', allowed: false, reply: 'I focus on fitness, training and nutrition. Ask me about workouts, muscle groups, meals or recovery.' });
    const match = identifyMuscles(message)[0];
    const recommended = match ? filterExercises(match) : /\blegs\b/i.test(message) ? filterExercises().filter(e => e.primaryMuscles.includes('Quads')) : [];
    return NextResponse.json({ mode: 'demo', allowed: true, reply: match ? `Here are example ${match.toLowerCase()} exercises. Open Training to see movement instructions.` : 'That is a fitness-related question. Live AI coaching is available on the Coach page when the server is configured.', exerciseIds: recommended.map(e => e.id) });
}
