import type { CoachInput, CoachProfile } from './schemas';
import { equipmentOptions, type Equipment } from '../training/types';

export type ConversationFacts = Pick<CoachProfile, 'experience'|'goals'|'equipment'|'trainingFrequency'|'dietaryPreferences'|'allergies'> & {
  weightKg?: number;
  heightCm?: number;
  sessionMinutes?:number;
  excludedEquipment?: Equipment[];
};
export type ConversationContext = {
  facts: ConversationFacts;
  provenance: Partial<Record<keyof ConversationFacts, { source: 'conversation'; messageIndex: number }>>;
};
const normalize = (text: string) => text.toLowerCase().replaceAll('’', "'").replace(/\s+/g, ' ').trim();
const days: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7 };
const equipmentNames: Record<Equipment, string> = {
  dumbbells:'dumbbells?', bench:'(?:an? )?(?:incline )?bench', 'resistance-band':'(?:resistance )?bands?',
  'pull-up-bar':'pull[- ]?up bar', 'cable-machine':'cable machine', 'lat-pulldown-machine':'lat pulldown (?:machine|station)', 'chest-press-machine':'chest press machine',
  'leg-extension-machine':'leg extension machine', 'leg-curl-machine':'leg curl machine',
};

// Conservative extraction of explicit USER declarations, not model guesses or assistant text.
export function declaredFacts(text: string, previousAssistant = ''): ConversationFacts {
  const value = normalize(text);
  const facts: ConversationFacts = {};
  if (/\b(?:my friend|my client|someone|hypothetical|suppose|if i)\b/.test(value)) return facts;
  const experience = value.match(/\b(?:i(?:'m| am)|my (?:experience|level)(?: is)?)\s+(?:an?\s+)?(beginner|intermediate|advanced)\b/);
  if (experience) facts.experience = experience[1] as CoachProfile['experience'];
  else if(/^(?:beginner|intermediate|advanced)[.!]?$/.test(value)&&/experience|level|beginner|intermediate|advanced/i.test(previousAssistant))facts.experience=value.replace(/[.!]$/,'') as CoachProfile['experience'];
  if (/\b(?:how can i |i want (?:to )?|my goal is (?:to )?|i(?:'m| am) (?:trying|looking) to )(?:build|gain|grow) (?:some )?muscle\b/.test(value)) facts.goals = 'muscle gain';
  else if (/\b(?:i want to|my goal is to) (?:get stronger|build strength|gain strength)\b/.test(value)) facts.goals = 'strength';
  else if (/\b(?:i want to|my goal is to) (?:lose (?:body )?fat|lose weight)\b/.test(value)) facts.goals = 'fat loss';
  const weight = value.match(/\b(?:i(?:'m| am| weigh)|my weight(?: is)?)\s+(?:currently\s+)?(\d{2,3}(?:\.\d+)?)\s*(?:kg|kilograms?)\b/);
  const height = value.match(/\b(?:i(?:'m| am)|my height(?: is)?)\s+(?:currently\s+)?(\d{2,3}(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)\b/)
    ?? (weight ? value.match(/(?:\band|,)\s*(\d{2,3}(?:\.\d+)?)\s*cm\b/) : null);
  if (weight && Number(weight[1]) >= 20 && Number(weight[1]) <= 500) facts.weightKg = Number(weight[1]);
  if (height && Number(height[1]) >= 80 && Number(height[1]) <= 250) facts.heightCm = Number(height[1]);
  if(/^(?:none|nothing|no)[.!]?$/.test(value)&&/equipment/i.test(previousAssistant))facts.equipment=[];
  const contextualEquipment=/^(?:use |only |just )?(?:dumbbells|bodyweight|resistance bands?|bench)(?: instead| only)?[.!]?$/.test(value)&&/equipment|available|have|use/i.test(previousAssistant)?value.match(/^(.*)$/):null;
  const availability = value.match(/\b(?:i (?:only )?have(?: access to)?|i have only|my equipment is|only|just)\s+([^.!?]+)/);
  if (/\b(?:no equipment|bodyweight only|only bodyweight|without any equipment)\b/.test(value)) facts.equipment = [];
  else if (availability) {
    const positive = availability[1].split(/\b(?:but|without|no)\b/)[0];
    const found = equipmentOptions.filter(item => new RegExp(`\\b${equipmentNames[item]}\\b`).test(positive));
    if (found.length) facts.equipment = found;
  }
  if(!facts.equipment&&contextualEquipment){facts.equipment=equipmentOptions.filter(item=>new RegExp(`\\b${equipmentNames[item]}\\b`).test(contextualEquipment[1]));}
  if(/^use dumbbells instead[.!]?$/.test(value))facts.equipment=['dumbbells'];
  const missing = value.match(/\b(?:i (?:don't|do not) have|without|no)\s+([^.!?]+)/);
  if (missing && !/\bno equipment\b/.test(value)) {
    const excluded = equipmentOptions.filter(item => new RegExp(`\\b${equipmentNames[item]}\\b`).test(missing[1]));
    if (excluded.length) facts.excludedEquipment = excluded;
  }
  const frequency = value.match(/\b(?:i (?:can |will |plan to )?train|my training(?: schedule)? is|i can work out)\s+([1-7]|one|two|three|four|five|six|seven)\s+days?\b/)
    ?? (/^(?:[1-7]|one|two|three|four|five|six|seven) days?(?: (?:a|per) week)?[.!]?$/.test(value)&&/(?:how many|which|training).{0,40}days|days.{0,30}(?:train|available)/i.test(previousAssistant)?value.match(/^([1-7]|one|two|three|four|five|six|seven)/):null);
  if(frequency)facts.trainingFrequency=days[frequency[1]]??Number(frequency[1]);
  if(/\b(?:i can train|i can work out|only) twice(?: a| per)? week\b/.test(value)||/^(?:only )?twice a week[.!]?$/.test(value))facts.trainingFrequency=2;
  const minutes=value.match(/\b(?:i (?:only )?have|only|make it) (\d{2,3}) minutes?\b/);if(minutes&&Number(minutes[1])>=10&&Number(minutes[1])<=240)facts.sessionMinutes=Number(minutes[1]);
  const dayRequest=value.match(/\b([1-7]|one|two|three|four|five|six|seven)[ -]day (?:workout|training|plan|programme|program)\b/);if(dayRequest)facts.trainingFrequency=days[dayRequest[1]]??Number(dayRequest[1]);
  const diet = value.match(/\b(?:i(?:'m| am)|i eat|my diet is)\s+(?:an?\s+)?(vegetarian|vegan|pescatarian|halal|kosher)\b/);
  if (diet) facts.dietaryPreferences = diet[1];
  const allergy = value.match(/\bi(?:'m| am) allergic to\s+([^.!?]+)/);
  if (allergy) facts.allergies = allergy[1].slice(0, 300);
  return facts;
}
export function buildConversationContext(input: CoachInput): ConversationContext {
  const context: ConversationContext = { facts:{}, provenance:{} };
  let previousAssistant = '';
  [...input.history, {role:'user' as const,content:input.message}].forEach((entry, messageIndex) => {
    if (entry.role === 'assistant') { previousAssistant = entry.content; return; }
    const facts = declaredFacts(entry.content, previousAssistant);
    for (const key of Object.keys(facts) as (keyof ConversationFacts)[]) {
      Object.assign(context.facts, { [key]:facts[key] });
      context.provenance[key] = {source:'conversation',messageIndex};
    }
  });
  return context;
}
export function effectivePreferences(profile: CoachProfile, context: ConversationContext): CoachProfile {
  const {weightKg: _weight, heightCm: _height, excludedEquipment, ...facts} = context.facts;
  void _weight; void _height;
  const effective = {...profile,...facts};
  if (effective.equipment && excludedEquipment) effective.equipment = effective.equipment.filter(item => !excludedEquipment.includes(item));
  // Retain declared safety/allergy context even when a later preference differs.
  effective.goals = [...new Set([profile.goals,facts.goals].filter(Boolean))].join('; ').slice(0,500) || undefined;
  effective.allergies = [...new Set([profile.allergies,facts.allergies].filter(Boolean))].join('; ').slice(0,500) || undefined;
  return effective;
}
export function projectConversationContext(context: ConversationContext, topic: 'fitness'|'nutrition'|'mixed'|'other'): ConversationContext {
  const keys: (keyof ConversationFacts)[] = topic === 'nutrition' ? ['goals','dietaryPreferences','allergies'] : topic === 'fitness' ? ['goals','experience','equipment','excludedEquipment','trainingFrequency','sessionMinutes','weightKg','heightCm'] : Object.keys(context.facts) as (keyof ConversationFacts)[];
  return { facts:Object.fromEntries(keys.filter(key=>context.facts[key]!==undefined).map(key=>[key,context.facts[key]])), provenance:Object.fromEntries(keys.filter(key=>context.provenance[key]).map(key=>[key,context.provenance[key]])) };
}
