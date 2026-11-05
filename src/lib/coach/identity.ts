import 'server-only';
import type {CoachProfile} from './schemas';
import {requireUser,type AuthContext} from '../auth/session';
import {getProfile} from '../profile/service';
import {profileForCoach} from '../profile/personalisation';
export type CoachPrincipal={kind:'anonymous'}|{kind:'authenticated';subject:string;context?:AuthContext};
export type IdentityResolver=(request:Request)=>Promise<CoachPrincipal|null>;
export const resolveCoachIdentity:IdentityResolver=async(request)=>{const context=await requireUser(request);return {kind:'authenticated',subject:context.userId,context};};
export async function loadStoredCoachProfile(principal:CoachPrincipal):Promise<CoachProfile>{return principal.kind==='authenticated'&&principal.context?profileForCoach(await getProfile(principal.context)):{};}
