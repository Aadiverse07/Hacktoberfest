import { describe, expect, it, vi } from 'vitest';
import { orchestrateAssistant } from '@/lib/assistant/orchestrator';
import { MockRepository } from '@/lib/data/assistant-repository';
import { MockModelProvider } from '@/lib/assistant/providers/mock';
import type { ModelProvider } from '@/lib/assistant/model-provider';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import type { Workspace } from '@/lib/assistant/engine';

const workspace: Workspace = { accounts: seedAccounts, entries: seedEntries, expenses: seedExpenses, invoices: seedInvoices };
const repository = new MockRepository(workspace);
const openQuestion = 'How should I interpret these records?';

describe('assistant orchestrator', () => {
  it('does not call a provider when deterministic engine answers', async () => {
    const generate = vi.fn();
    const provider = { id: 'mock', health: async () => ({ ok: true }), generate } as unknown as ModelProvider;
    const result = await orchestrateAssistant('help', { repository, workspace, provider });
    expect(result.source).toBe('verified-data');
    expect(generate).not.toHaveBeenCalled();
  });
  it('returns a validated answer for an unresolved in-scope question', async () => {
    const result = await orchestrateAssistant(openQuestion, { repository, workspace, provider: new MockModelProvider(), now: '2026-10-02' });
    expect(result).toMatchObject({ source: 'open-weight-model', provider: 'mock', validation: { passed: true } });
    expect(result.contextRefs).toContain('period:2026-10');
  });
  it('retries invalid mock output once and falls back with verified context', async () => {
    const provider = new MockModelProvider('invalid');
    const generate = vi.spyOn(provider, 'generate');
    const result = await orchestrateAssistant(openQuestion, { repository, workspace, provider, now: '2026-10-02' });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.source).toBe('fallback');
    expect(result.validation).toMatchObject({ passed: false, issues: ['unsupported_figure'] });
    expect(result.answer).toContain('verified context');
  });
  it('returns fallback on provider failure', async () => {
    const result = await orchestrateAssistant(openQuestion, { repository, workspace, provider: new MockModelProvider('throw'), now: '2026-10-02' });
    expect(result.source).toBe('fallback');
    expect(result.validation.issues).toContain('provider_unavailable');
  });
});
