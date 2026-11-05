import { privateRoute,readJson } from '@/lib/api/http';
import { getProfile,updateProfile } from '@/lib/profile/service';
import { profilePatchSchema } from '@/lib/profile/schema';
export const GET=privateRoute(async(_request,context)=>getProfile(context));
export const PATCH=privateRoute(async(request,context)=>updateProfile(context,await readJson(request,profilePatchSchema)));
