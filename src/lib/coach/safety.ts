import type { SafetyKind } from './schemas';
// High-confidence fast paths complement semantic classification; they are not comprehensive.
export function detectSafety(text: string): SafetyKind {
  if (/\b(chest pain|can'?t breathe|cannot breathe|trouble breathing|passed out|fainting|stroke symptoms|overdos(?:e|ed)|coughing blood|severe shortness of breath)\b/i.test(text)) return 'emergency';
  if (/\b(anorexia|bulimia|purging|eating disorder|starve myself|starvation|stop eating|hide (?:my )?(?:eating|weight loss)|(?:under|only|less than)\s*[1-7]\d\d\s*(?:kcal|calories))\b/i.test(text)) return 'eating_disorder';
  if (/\b(?:i(?:['’]m| am)|my age is)\s*(?:[6-9]|1[0-7])\b|\b(?:under[- ]?18|minor|child|teenager)\b/i.test(text)) return 'minor';
  if (/\b(steroid cycle|sarms?|dnp|clenbuterol|insulin (?:dose|for)|inject testosterone|megadose)\b/i.test(text)) return 'supplements';
  if (/\b(train through (?:the )?pain|dehydrat(?:e|ion).*cut|dry fasting|pass out.*lift|one[- ]rep max.*(?:alone|no spotter))\b/i.test(text)) return 'dangerous';
  if (/\b(injur(?:y|ed)|sharp pain|torn|sprain|fracture|my .{0,20}(?:hurts|is painful))\b/i.test(text)) return 'injury';
  if (/\b(diabetes|pregnan(?:t|cy)|heart condition|kidney disease|diagnos(?:e|is)|prescrib(?:e|ing)|medication dose)\b/i.test(text)) return 'medical';
  return 'none';
}
export const safetyMessages: Record<Exclude<SafetyKind, 'none'>, string> = {
  emergency: 'These symptoms could need urgent medical attention. Stop exercising and contact your local emergency services now. If possible, ask someone nearby to stay with you. I cannot assess or treat an emergency here.',
  injury: 'Stop or avoid the movement that causes pain. I can share general fitness information, but I cannot diagnose an injury or prescribe rehabilitation. A qualified clinician or physiotherapist can assess symptoms and help you return safely. Seek urgent care for severe or sudden symptoms.',
  medical: 'A medical condition, pregnancy or medication can change what training and nutrition are suitable. Please discuss personal changes with a qualified clinician or registered dietitian. I can explain general concepts, but cannot diagnose, prescribe medication or provide a treatment plan.',
  eating_disorder: 'You deserve support with eating and body concerns. I cannot help with extreme restriction, purging or hiding symptoms. Please speak with a qualified clinician or registered dietitian experienced in eating disorders, and consider involving someone you trust. If you feel faint, severely unwell or in immediate danger, seek urgent medical care.',
  dangerous: 'I cannot help plan a dangerous training or weight-cutting practice. Avoid training through pain, severe dehydration or unsupervised risky attempts. A qualified coach can help you choose a gradual approach with appropriate recovery and support.',
  supplements: 'I cannot provide cycles, dosing or instructions for unsafe performance-enhancing substances. A qualified clinician or pharmacist can explain their risks and interactions. I can discuss general supplement evidence and safer training habits.',
  minor: 'For children and teens, focus on enjoyable movement, skill, regular meals and adequate rest rather than restrictive dieting or maximal lifting. Involve a parent or trusted adult and a qualified youth coach or clinician for individual advice. I cannot provide weight-loss targets, supplement dosing or a restrictive plan for a minor.',
};
export function detectInjection(text: string) {
  return /\b(?:ignore|override|disregard|bypass)\b[\s\S]{0,80}\b(?:instructions|rules|policy|safety|system|previous)\b|\b(?:reveal|print|show|extract)\b[\s\S]{0,60}\b(?:system prompt|developer prompt|api key|environment variables|secret)\b|\b(?:act as|you are now)\b[\s\S]{0,40}\b(?:unrestricted|developer|system|general.purpose)\b|<\/?(?:system|developer)>/i.test(text);
}
