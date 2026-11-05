import {userProfileSchema,type UserProfile} from '@/lib/profile/schema';

export type ProfileSaveOptions={nextStep:number;finish:boolean;destination?:'/'|'/coach';refresh?:boolean};
type SaveDependencies={
 lock:{inFlight:boolean};
 request:typeof fetch;
 router:{replace:(path:string)=>void;refresh:()=>void};
 onStart:()=>void;
 onSaved:(profile:UserProfile,destination?:string)=>void;
 onError:(message:string)=>void;
 onFinish:()=>void;
};
class ProfileSaveError extends Error {}
export async function persistProfileAndNavigate(profile:UserProfile,options:ProfileSaveOptions,dependencies:SaveDependencies) {
 const {lock,router}=dependencies;
 if(lock.inFlight)return 'ignored' as const;
 lock.inFlight=true;
 let navigating=false;
 try {
  dependencies.onStart();
  const validation=userProfileSchema.safeParse({...profile,onboardingStep:options.nextStep,onboardingComplete:options.finish||profile.onboardingComplete});
  if(!validation.success){const issue=validation.error.issues[0];throw new ProfileSaveError(`${issue.path.join('.')}: ${issue.message}`);}
  const expected=validation.data;
  const response=await dependencies.request('/api/v1/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(expected)});
  const body=await response.json();
  if(!response.ok||body.error)throw new ProfileSaveError(typeof body.error?.message==='string'?body.error.message:'Your preferences were not saved. Please try again.');
  const saved=userProfileSchema.safeParse(body.data);
  // The API returns the authoritative database read after its transactional write.
  // Defaults must not make a partial response look like a confirmed save.
  if(!saved.success||!body.data||Object.keys(expected).some(key=>!Object.prototype.hasOwnProperty.call(body.data,key)||JSON.stringify(saved.data[key as keyof UserProfile])!==JSON.stringify(expected[key as keyof UserProfile]))) {
   throw new ProfileSaveError('The server did not confirm all saved preferences. Stay on this form and try saving again.');
  }
  const destination=options.finish?options.destination:undefined;
  dependencies.onSaved(saved.data,destination);
  if(destination){router.replace(destination);router.refresh();navigating=true;}
  else if(options.refresh)router.refresh();
  return 'saved' as const;
 }catch(error){
  dependencies.onError(error instanceof ProfileSaveError?error.message:'Could not confirm your save. Check your connection and try again.');
  return 'error' as const;
 }finally{
  // Keep the final action locked until navigation unmounts the form.
  if(!navigating){lock.inFlight=false;dependencies.onFinish();}
 }
}
export function profileSaveDestination(onboarding:boolean):'/'|'/coach'{return onboarding?'/coach':'/';}
