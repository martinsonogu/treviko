import 'server-only';
import {createHash} from 'node:crypto';
import type {UserProfile} from '../profile/schema';
import {profileForCoach} from '../profile/personalisation';
export function preferenceFingerprint(profile:UserProfile){return createHash('sha256').update(JSON.stringify({profile:profileForCoach(profile),sessionMinutes:profile.sessionMinutes,mealsPerDay:profile.mealsPerDay})).digest('hex');}
