export type ValidationResult = { passed: boolean; issues: string[] };

const FIGURE_RE = /(?:-?\s*[₹$€£]\s*-?\d[\d,]*(?:\.\d+)?|\b(?:INR|USD|EUR|GBP|Rs\.?|rupees?)\s*-?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent\b))/gi;
const ACTION_RE = /\b(?:i|we)\s+(?:have\s+)?(?:paid|created|updated|deleted|sent|approved|transferred|changed|cancelled|canceled|submitted|posted|booked|reconciled|issued|made the payment|will pay|will send|will update)\b|\b(?:payment|invoice|transfer)\s+(?:has been|was)\s+(?:made|sent|completed|approved)\b/i;

export function normalizeFigure(value: string): string {
  const number = value.replace(/[^\d.-]/g, '');
  const parsed = Number(number);
  return Number.isFinite(parsed) ? String(parsed) : value.toLowerCase().replace(/\s+/g, '');
}
export function extractFigures(text: string): Set<string> {
  return new Set([...text.matchAll(FIGURE_RE)].map((match) => normalizeFigure(match[0] ?? '')));
}
export function validateAnswer(text: unknown, allowedFigures: ReadonlySet<string>, maxLength = 1600): ValidationResult {
  const issues: string[] = [];
  if (typeof text !== 'string' || !text.trim()) return { passed: false, issues: ['empty_response'] };
  if (text.length > maxLength) issues.push('response_too_long');
  for (const match of text.matchAll(FIGURE_RE)) if (!allowedFigures.has(normalizeFigure(match[0] ?? ''))) issues.push('unsupported_figure');
  if (ACTION_RE.test(text)) issues.push('action_claim');
  return { passed: issues.length === 0, issues: [...new Set(issues)] };
}
