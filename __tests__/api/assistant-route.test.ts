import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/withOrgAuth', () => ({
  withOrgAuth: (handler: (ctx: unknown, req: Request) => unknown) => (req: Request) => handler({ orgId: 'demo-org', userId: 'demo-user' }, req),
}));

import { POST } from '@/app/api/assistant/route';

describe('POST /api/assistant contract', () => {
  it('returns the exact response fields for deterministic and model paths', async () => {
    const deterministic = await POST(new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'help' }) }) as never);
    expect(deterministic.status).toBe(200);
    const deterministicBody = await deterministic.json();
    expect(Object.keys(deterministicBody)).toEqual(['answer','source','provider','model','contextRefs','validation','latencyMs','limitations']);
    expect(deterministicBody).toMatchObject({ source: 'verified-data', provider: 'deterministic', model: null });

    const generated = await POST(new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'How should I interpret these records?', provider: 'mock', locale: 'en' }) }) as never);
    expect(generated.status).toBe(200);
    expect(await generated.json()).toMatchObject({ source: 'open-weight-model', provider: 'mock', validation: { passed: true } });
  });

  it('validates request body types and length', async () => {
    for (const message of ['', 'x'.repeat(1001), 4]) {
      const response = await POST(new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) }) as never);
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty('error');
    }
  });
});
