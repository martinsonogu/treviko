import {connection,NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth/session';
import {getCoachConfig,configurationMessage} from '@/lib/coach/config';
import {apiFailure} from '@/lib/api/http';
export async function GET(request:Request){await connection();try{await requireUser(request);const missing=configurationMessage(getCoachConfig());const admin=Boolean(process.env.SUPABASE_SECRET_KEY);return NextResponse.json({mode:missing||!admin?'unavailable':'live',available:!missing&&admin,message:missing||(!admin?'Configure SUPABASE_SECRET_KEY for shared AI controls and persistence.':'Live AI is configured with authenticated, saved conversations.'),anonymous:false},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiFailure(error);}}
