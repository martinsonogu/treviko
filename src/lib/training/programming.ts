import type {Exercise} from './types';
export type MovementPattern='horizontal_push'|'vertical_push'|'horizontal_pull'|'vertical_pull'|'knee'|'hip'|'core'|'accessory'|'knee_flexion'|'hip_abduction';
const groups:Record<MovementPattern,string[]>={
 horizontal_push:['press','push-up','dumbbell-floor-press','incline-dumbbell-press','close-grip-push-up'],
 vertical_push:['dumbbell-shoulder-press','pike-push-up'],
 horizontal_pull:['row','seated-cable-row','band-pull-apart','dumbbell-reverse-fly','prone-w-raise'],
 vertical_pull:['pulldown','pull-up','band-pulldown','dumbbell-pullover','chin-up'],
 knee:['bodyweight-squat','squat','reverse-lunge','leg-extension'],
 hip:['dumbbell-romanian-deadlift','band-good-morning','heel-dig-bridge','glute-bridge','dumbbell-hip-thrust'],knee_flexion:['lying-leg-curl'],hip_abduction:['side-lying-hip-abduction','band-lateral-walk'],
 core:['dead-bug','forearm-plank','side-plank','reverse-crunch'],accessory:['shrug','yraise','band-shrug','dumbbell-lateral-raise','band-lateral-raise','dumbbell-curl','hammer-curl','band-curl','band-triceps-pushdown','cable-triceps-pushdown','dumbbell-triceps-extension','standing-calf-raise','single-leg-calf-raise','seated-dumbbell-calf-raise','bent-knee-calf-raise'],
};
const isolated=new Set(['leg-extension','lying-leg-curl','band-pull-apart','dumbbell-reverse-fly','prone-w-raise','dumbbell-pullover','side-lying-hip-abduction','band-lateral-walk']);
export function programmingMetadata(exercise:Exercise){
 const pattern=Object.entries(groups).find(([,ids])=>ids.includes(exercise.id))?.[0] as MovementPattern|undefined;
 if(!pattern)throw new Error('Exercise programming metadata missing');
 const compound=!isolated.has(exercise.id)&&pattern!=='accessory'&&pattern!=='core';
 const related:Record<string,string>={ 'bodyweight-squat':'squat',squat:'squat','reverse-lunge':'lunge','leg-extension':'knee_extension','dumbbell-romanian-deadlift':'hinge','band-good-morning':'hinge','heel-dig-bridge':'bridge','glute-bridge':'bridge','dumbbell-hip-thrust':'bridge',row:'row','seated-cable-row':'row','dumbbell-reverse-fly':'rear_shoulder','prone-w-raise':'rear_shoulder','band-pull-apart':'rear_shoulder','dumbbell-pullover':'pullover','pull-up':'pullup','chin-up':'pullup',pulldown:'pulldown','band-pulldown':'pulldown',yraise:'scapular_raise'};
 const family=related[exercise.id]??(pattern==='accessory'?exercise.primaryMuscles[0]:pattern);
 return {pattern,family,compound,sides:['reverse-lunge','single-leg-calf-raise','side-plank','side-lying-hip-abduction'].includes(exercise.id)?2:1};
}
export function broadPattern(pattern:MovementPattern){return pattern.endsWith('push')?'push':pattern.endsWith('pull')?'pull':pattern;}
