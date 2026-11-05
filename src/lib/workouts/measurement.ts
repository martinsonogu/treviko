import type {Exercise} from '../training/types';
import type {WorkoutSnapshot,Performance} from './schema';
export function supportsExternalLoad(exercise:Pick<Exercise,'requiredEquipment'>){return exercise.requiredEquipment.some(item=>['dumbbells','cable-machine','lat-pulldown-machine','chest-press-machine','leg-extension-machine','leg-curl-machine'].includes(item));}
// The immutable snapshot records whether external equipment is required and reps vs seconds.
// Retain historical loads, but do not infer support for weighted bodyweight holds.
export function workoutMeasurement(exercise:WorkoutSnapshot['exercises'][number],actual:Performance['exercises'][number]){
 const applicable=exercise.loadApplicable??!exercise.bodyweight;const historicalLoad=actual.sets.some(set=>set.load!==null);
 return {amountLabel:exercise.unit==='seconds'?'Seconds':'Reps',showLoad:applicable||historicalLoad,loadReadOnly:!applicable,kind:exercise.unit==='seconds'?(applicable?'weighted_time':'bodyweight_time'):(applicable?'weight_reps':'bodyweight_reps')};
}
