export function friendlyWorkoutName(name:string){const match=name.match(/^(upper|lower)\s+(?:body\s+)?([ab])$/i);return match?`${match[1].toLowerCase()==='upper'?'Upper':'Lower'} Body ${match[2].toUpperCase()}`:name;}
export function isSplitWorkoutName(name:string){return /^(upper|lower)\s+(?:body\s+)?[ab]$/i.test(name);}
export function countLabel(count:number,singular:string,plural=singular+'s'){return `${count} ${count===1?singular:plural}`;}
export const splitWorkoutExplanation='A and B distinguish sessions for the same body region. Compare their exercises and instructions to see how they differ.';
