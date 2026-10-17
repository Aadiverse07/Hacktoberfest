import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { repositoryFactory } = vi.hoisted(() => ({ repositoryFactory: vi.fn() }));
vi.mock('@/lib/api/withOrgAuth', () => ({
  withOrgAuth: (handler: (ctx: unknown, req: Request) => unknown) => (req: Request) => handler({ orgId: 'org-test', userId: 'user-test' }, req),
}));
vi.mock('@/lib/data/assistant-repository', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/data/assistant-repository')>(),
  getAssistantRepository: repositoryFactory,
}));

import { POST } from '@/app/api/assistant/route';
import { MockRepository } from '@/lib/data/assistant-repository';
import { __resetRateLimits } from '@/lib/api/rateLimit';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';

const workspace = { accounts: seedAccounts, entries: seedEntries, invoices: seedInvoices, expenses: seedExpenses };
const request = (body: unknown) => new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('assistant request hardening', () => {
  beforeEach(() => {
    __resetRateLimits();
    vi.stubEnv('DATA_SOURCE', 'mock');
    vi.stubEnv('DATA_BACKEND', 'mock');
    vi.stubEnv('QUIKIT_AUTH_ENABLED', 'false');
    vi.stubEnv('MODEL_PROVIDER', 'mock');
    repositoryFactory.mockResolvedValue(new MockRepository(workspace));
    repositoryFactory.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('accepts a validated client workspace in mock/demo mode', async () => {
    const response = await POST(request({ message: 'help', workspace }) as never);
    expect(response.status).toBe(200);
    expect(repositoryFactory).toHaveBeenCalledWith({ orgId: 'org-test', workspace });
  });

  it('ignores client workspaces for authenticated requests', async () => {
    vi.stubEnv('QUIKIT_AUTH_ENABLED', 'true');
    const response = await POST(request({ message: 'help', workspace: { accounts: [{ id: 'spoofed' }] } }) as never);
    expect(response.status).toBe(200);
    expect(repositoryFactory).toHaveBeenCalledWith({ orgId: 'org-test', workspace: undefined });
  });

  it('ignores client workspaces for Prisma data source', async () => {
    vi.stubEnv('QUIKIT_AUTH_ENABLED', 'false');
    vi.stubEnv('DATA_SOURCE', 'prisma');
    vi.stubEnv('DATA_BACKEND', '');
    const response = await POST(request({ message: 'help', workspace }) as never);
    expect(response.status).toBe(200);
    expect(repositoryFactory).toHaveBeenCalledWith({ orgId: 'org-test', workspace: undefined });
  });

  it('retains the existing per-user/device assistant limit', async () => {
    __resetRateLimits();
    vi.stubEnv('REDIS_URL', '');
    let last: Response | undefined;
    for (let i = 0; i < 9; i += 1) last = await POST(request({ message: 'help' }) as never);
    expect(last?.status).toBe(429);
  });

  it('rejects malformed demo workspaces and oversized request bodies', async () => {
    const invalidWorkspace = { accounts: [], entries: [], invoices: [], expenses: [{ id: 'missing-fields' }] };
    const badWorkspace = await POST(request({ message: 'help', workspace: invalidWorkspace }) as never);
    expect(badWorkspace.status).toBe(400);
    const large = await POST(request({ message: 'help', extra: 'x'.repeat(270 * 1024) }) as never);
    expect(large.status).toBe(413);
    expect(repositoryFactory).not.toHaveBeenCalled();
  });
});
