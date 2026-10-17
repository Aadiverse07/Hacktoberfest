import { describe, expect, it } from 'vitest';
import { extractFigures, validateAnswer } from '@/lib/assistant/validator';

describe('assistant output validator', () => {
  const allowed = extractFigures('Expenses ₹1,000 and margin 12.5%.');
  it('accepts figures copied from context, including formatting variants', () => {
    expect(validateAnswer('Expenses were ₹1000 with a 12.5 percent margin.', allowed).passed).toBe(true);
  });
  it('rejects empty output and overlong output', () => {
    expect(validateAnswer(' ', allowed).issues).toContain('empty_response');
    expect(validateAnswer('x'.repeat(10), allowed, 5).issues).toContain('response_too_long');
  });
  it('rejects invented currency values and percentages', () => {
    expect(validateAnswer('Balance is ₹250.', allowed).issues).toContain('unsupported_figure');
    expect(validateAnswer('It increased 99%.', allowed).issues).toContain('unsupported_figure');
  });
  it('rejects claims that an action was completed', () => {
    expect(validateAnswer('I have paid the invoice.', allowed).issues).toContain('action_claim');
  });
});
