export type ScopeResult = 'in_scope' | 'out_of_scope' | 'borderline';
export type ScopeClassification = { result: ScopeResult; reason: 'supported_finova_use' | 'clearly_unrelated' | 'prompt_injection' | 'needs_clarification' };

// Reject only unmistakable instruction attacks; the ordinary finance classifier stays permissive.
const INJECTION_RE = /\b(?:ignore|disregard|override|forget|bypass)\b.{0,80}\b(?:previous|prior|above|system|developer|safety|instructions?|rules?|prompt)\b|\b(?:reveal|print|show|expose|repeat|dump|tell me)\b.{0,80}\b(?:system|developer|hidden|internal).{0,40}\b(?:prompt|instructions?|context|secrets?)\b|\b(?:show|reveal|print|expose|give me)\b.{0,40}\b(?:api key|credentials?|access token|secret key)\b|\bact as (?:an? )?(?:unrestricted|unfiltered|different)\b/i;
const CLEARLY_UNRELATED_RE = /\b(?:weather|temperature forecast|recipe|cook(?:ing)?|football|cricket|basketball|movie review|horoscope|crypto(?:currency)? price|bitcoin price|stock price|share price|capital of|president of|prime minister of|write (?:me )?(?:a |an )?(?:poem|song|story|joke|essay|code|script)|tell me a joke|photosynthesis|biology|chemistry|astronomy|black hole|quantum physics|world war|world cup winner|election results|programming language|recipe for)\b/i;
const FINOVA_CAPABILITY_RE = /\b(?:finova|invoice|receivable|payable|expense|spending|spend|vendor|supplier|customer|account|ledger|journal|transaction|revenue|income|profit|loss|margin|cash|cashflow|cash flow|gst|tax|bank|balance|report|trial balance|balance sheet|receipt|alert|insights?|financial|finance|money|saving|save money|costs?|overhead|spend less|budget|payroll|runway|overdue|unpaid|paid invoice|draft invoice|category|categories|business records|my records|these records|this pattern|business summary|business health|dashboard|module|app|platform|owe|owed|collect|bill|statement|forecast|reconcile|depreciation)\b/i;
const GENERIC_FINOVA_RE = /^(?:help|what can you do|what do you do|how do you work|capabilities|features|who are you|what are you|hi|hello|hey|namaste|thanks|thank you|bye|goodbye)[.!?\s]*$/i;
const APP_HELP_RE = /\b(?:how do i|how can i|where do i|where can i|help me|what can i do|how to)\b.{0,60}\b(?:use|open|find|view|create|record|manage|navigate|finova|app|platform|invoice|expense|account|report|journal|transaction|dashboard)\b/i;
const MODEL_LANGUAGE_RE = /\b(?:explain|summari[sz]e|suggest|recommend|pattern|ways to|where can i save|save money|manage it|help me understand)\b/i;

export function classifyFinovaScope(message: string): ScopeClassification {
  if (INJECTION_RE.test(message)) return { result: 'out_of_scope', reason: 'prompt_injection' };
  if (CLEARLY_UNRELATED_RE.test(message)) return { result: 'out_of_scope', reason: 'clearly_unrelated' };
  if (FINOVA_CAPABILITY_RE.test(message) || APP_HELP_RE.test(message) || GENERIC_FINOVA_RE.test(message.trim())) {
    return { result: 'in_scope', reason: 'supported_finova_use' };
  }
  // Ambiguous phrasing is not refused; give a safe, on-platform clarification without a model call.
  return { result: 'borderline', reason: 'needs_clarification' };
}

/** Requests explicitly framed as explanation/suggestion/summary should reach the model with verified context. */
export function shouldUseModelForQuestion(message: string): boolean {
  return MODEL_LANGUAGE_RE.test(message);
}

export const OUT_OF_SCOPE_ANSWER = "I'm Finova AI, designed to help with the financial tasks and insights supported by this platform. I can't assist with that particular request because it's outside my current capabilities. Please ask me a question related to Finova AI's supported features, and I'll be happy to help.";
export const BORDERLINE_ANSWER = 'I can help with Finova expenses, invoices, accounts, transactions and reports. Please connect your question to a record or task in the platform.';
export const SCOPE_SUGGESTIONS = [
  'How much did I spend this month?',
  'Summarise my unpaid invoices',
  'Which expense category costs the most?',
  'Explain my spending pattern and suggest ways to manage it',
  'Any insights I should act on?',
];
