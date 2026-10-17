import { describe, expect, it } from 'vitest';
import { MockRepository } from '@/lib/data/assistant-repository';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import type { Workspace } from '@/lib/assistant/engine';

describe('MockRepository assistant contract', () => {
  const repository = new MockRepository();

  it('returns the existing mock workspace and domain records', async () => {
    const workspace = await repository.getWorkspace();
    expect(await repository.getAccounts()).toEqual(seedAccounts);
    expect(workspace).toEqual({ accounts: seedAccounts, entries: seedEntries, invoices: seedInvoices, expenses: seedExpenses });
  });

  it('filters journal transactions by date, account and status', async () => {
    const rows = await repository.getTransactions({ from: '2026-09-25', to: '2026-09-29', accountId: '5001', status: 'Posted' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.date >= '2026-09-25' && row.date <= '2026-09-29' && row.status === 'Posted' && row.lines.some((line) => line.accountId === '5001'))).toBe(true);
  });

  it('filters invoices and returns deterministic summaries from ledger data', async () => {
    const invoices = await repository.getInvoices({ status: 'Pending' });
    expect(invoices).toEqual(seedInvoices.filter((invoice) => invoice.status === 'Pending'));
    const period = { kind: 'month' as const, from: '2026-09-01', to: '2026-09-30', label: 'September 2026', explicit: true };
    const categories = await repository.getCategorySummary(period);
    const summary = await repository.getPeriodSummary(period);
    expect(categories).toEqual(summary.expenses);
    expect(summary.totalExpenses).toBeGreaterThan(0);
  });

  it('uses a supplied workspace as the mock source for current client data', async () => {
    const workspace: Workspace = { accounts: [], entries: [], invoices: [], expenses: [] };
    const custom = new MockRepository(workspace);
    expect(await custom.getWorkspace()).toBe(workspace);
    expect(await custom.getAccounts()).toEqual([]);
    expect(await custom.getTransactions()).toEqual([]);
    expect(await custom.getInvoices()).toEqual([]);
    expect(await custom.getCategorySummary({ kind: 'all', label: 'all time', explicit: false })).toEqual([]);
  });
});
