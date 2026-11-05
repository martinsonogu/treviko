import { authHandler } from '@/lib/auth/service';
export const POST=authHandler('signup');
