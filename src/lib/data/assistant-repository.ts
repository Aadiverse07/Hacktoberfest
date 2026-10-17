import type { Account, Invoice, JournalEntry } from '@/lib/data/types';
import type { Workspace, Period } from '@/lib/assistant/engine';
import { accountTotals, profitAndLoss, signed } from '@/lib/data/calc';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import { resolveModelConfig } from '@/lib/assistant/model-config';
import { dataSource } from '@/lib/env';

export type AssistantTransactionFilters = {
  from?: string;
  to?: string;
  accountId?: string;
  status?: JournalEntry['status'];
};

/** Read-only data contract for deterministic assistant answers. All monetary figures stay in domain records. */
export interface AssistantRepository {
  getAccounts(): Promise<Account[]>;
  getTransactions(filters?: AssistantTransactionFilters): Promise<JournalEntry[]>;
  getInvoices(filters?: { from?: string; to?: string; status?: Invoice['status'] }): Promise<Invoice[]>;
  getCategorySummary(period: Period): Promise<Array<{ account: Account; amount: number }>>;
  getPeriodSummary(period: Period): Promise<ReturnType<typeof profitAndLoss>>;
  getWorkspace(): Promise<Workspace>;
}

const seedWorkspace: Workspace = {
  accounts: seedAccounts,
  entries: seedEntries,
  invoices: seedInvoices,
  expenses: seedExpenses,
};

class WorkspaceAssistantRepository implements AssistantRepository {
  constructor(private readonly workspace: Workspace) {}

  async getAccounts() { return this.workspace.accounts; }
  async getTransactions(filters: AssistantTransactionFilters = {}) {
    return this.workspace.entries.filter((entry) =>
      (!filters.from || entry.date >= filters.from) &&
      (!filters.to || entry.date <= filters.to) &&
      (!filters.status || entry.status === filters.status) &&
      (!filters.accountId || entry.lines.some((line) => line.accountId === filters.accountId)),
    );
  }
  async getInvoices(filters: { from?: string; to?: string; status?: Invoice['status'] } = {}) {
    return this.workspace.invoices.filter((invoice) =>
      (!filters.from || invoice.date >= filters.from) &&
      (!filters.to || invoice.date <= filters.to) &&
      (!filters.status || invoice.status === filters.status),
    );
  }
  async getCategorySummary(period: Period) {
    const totals = accountTotals(this.workspace.entries, { from: period.from, to: period.to });
    return this.workspace.accounts
      .filter((account) => account.type === 'EXPENSE')
      .map((account) => ({ account, amount: signed(account, totals.get(account.id) ?? { debit: 0, credit: 0 }) }))
      .filter((row) => row.amount !== 0);
  }
  async getPeriodSummary(period: Period) {
    return profitAndLoss(this.workspace.accounts, this.workspace.entries, period.from, period.to);
  }
  async getWorkspace() { return this.workspace; }
}

export class MockRepository extends WorkspaceAssistantRepository {
  constructor(workspace: Workspace = seedWorkspace) { super(workspace); }
}

/**
 * Selects the assistant data source. Supabase is not added in this mock-first build. Existing
 * DATA_SOURCE=prisma deployments continue through the established org-scoped loader when DATA_BACKEND
 * has not been explicitly selected.
 */
export async function getAssistantRepository(options: { orgId?: string; workspace?: Workspace } = {}): Promise<AssistantRepository> {
  const requestedBackend = process.env.DATA_BACKEND;
  if (requestedBackend === 'supabase' || resolveModelConfig().dataBackend === 'supabase') {
    console.warn('[assistant-repository] Supabase repository is not enabled in the mock-first build; using mock data.');
    return new MockRepository(options.workspace);
  }

  if (requestedBackend === undefined && dataSource() === 'prisma') {
    if (!options.orgId) throw new Error('orgId is required for the Prisma assistant repository.');
    const { loadWorkspace } = await import('@/lib/assistant/prisma-workspace');
    return new WorkspaceAssistantRepository(await loadWorkspace(options.orgId));
  }

  return new MockRepository(options.workspace);
}
