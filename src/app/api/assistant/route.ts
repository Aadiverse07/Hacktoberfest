import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { fail } from '@/lib/api/response';
import { consumeAiRateLimit, rateLimitHeaders } from '@/lib/api/rateLimit';
import { writeAuditLog } from '@/lib/api/auditLog';
import { logger, requestId } from '@/lib/logger';
import { getAssistantRepository } from '@/lib/data/assistant-repository';
import { dataSource } from '@/lib/env';
import { orchestrateAssistant } from '@/lib/assistant/orchestrator';
import type { ModelProviderId } from '@/lib/assistant/model-provider';
import type { Workspace } from '@/lib/assistant/engine';

const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_DEMO_WORKSPACE_BYTES = 192 * 1024;
const PROVIDERS = new Set(['mock', 'gemma-gemini', 'ollama']);
const shortText = z.string().max(500);
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const workspaceSchema = z.object({
  accounts: z.array(z.object({ id: shortText, code: shortText, name: shortText, type: z.enum(['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE']), normalBalance: z.enum(['DEBIT','CREDIT']), isActive: z.boolean(), description: shortText })).max(500),
  entries: z.array(z.object({ id: shortText, date: dateText, reference: shortText, description: shortText, status: z.enum(['Posted','Draft']), source: z.enum(['MANUAL','INVOICE','PAYMENT','EXPENSE','OPENING']), sourceRef: shortText.optional(), lines: z.array(z.object({ id: shortText, accountId: shortText, debit: z.number().finite().min(0), credit: z.number().finite().min(0) })).max(200) })).max(3000),
  invoices: z.array(z.object({ id: shortText, number: shortText, customer: shortText, customerId: shortText.optional(), date: dateText, dueDate: dateText, lines: z.array(z.object({ id: shortText, description: shortText, quantity: z.string().max(40), unitPrice: z.string().max(40) })).max(200), tax: z.number().finite(), discount: z.number().finite(), status: z.enum(['Paid','Pending','Draft']), notes: shortText, paidOn: dateText.optional() })).max(2000),
  expenses: z.array(z.object({ id: shortText, date: dateText, category: shortText, vendor: shortText, description: shortText, amount: z.number().finite(), paymentMethod: shortText, status: z.enum(['Paid','Pending']), notes: shortText })).max(3000),
});

type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };
async function readBoundedJson(request: NextRequest): Promise<BodyResult> {
  const advertisedSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(advertisedSize) && advertisedSize > MAX_REQUEST_BYTES) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); return { ok: false, status: 413 }; }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return { ok: true, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }; }
  catch { return { ok: false, status: 400 }; }
}

function actualDataSource(): 'mock' | 'prisma' {
  return dataSource() === 'prisma' && process.env.DATA_BACKEND === undefined ? 'prisma' : 'mock';
}
function logRequest(fields: Record<string, unknown>) {
  logger.info(fields, 'assistant request');
}

export const POST = withOrgAuth(async ({ orgId, userId }, req) => {
  const id = requestId(req);
  const started = performance.now();
  const parsed = await readBoundedJson(req);
  if (!parsed.ok) {
    logRequest({ requestId: id, provider: 'not_started', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'failed', scopeResult: 'not_evaluated', fallbackUsed: false });
    return fail(parsed.status === 413 ? 'Request body exceeds the 256 KB limit.' : 'Request body must be valid JSON.', parsed.status);
  }
  const b = typeof parsed.value === 'object' && parsed.value !== null ? parsed.value as Record<string, unknown> : {};
  if (typeof b.message !== 'string' || !b.message.trim() || b.message.length > 1000) {
    logRequest({ requestId: id, provider: 'not_started', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'failed', scopeResult: 'not_evaluated', fallbackUsed: false });
    return fail('message must be a non-empty string of up to 1000 characters.', 400);
  }
  if (b.locale !== undefined && (typeof b.locale !== 'string' || b.locale.length > 32)) {
    logRequest({ requestId: id, provider: 'not_started', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'failed', scopeResult: 'not_evaluated', fallbackUsed: false });
    return fail('locale must be a string of up to 32 characters.', 400);
  }
  if (b.provider !== undefined && (typeof b.provider !== 'string' || !PROVIDERS.has(b.provider))) {
    logRequest({ requestId: id, provider: 'not_started', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'failed', scopeResult: 'not_evaluated', fallbackUsed: false });
    return fail('provider must be mock, gemma-gemini, or ollama.', 400);
  }

  const limited = await consumeAiRateLimit(userId || req.headers.get('x-finova-device-id') || 'anonymous');
  if (!limited.allowed) {
    logger.warn({ requestId: id, event: 'ai_rate_limit_hit', orgId }, 'AI rate limit exceeded');
    await writeAuditLog({ orgId, actorId: userId, action: 'SECURITY', entityType: 'AI_RATE_LIMIT', entityId: 'ai', reason: 'AI rate limit exceeded', ipAddress: undefined, userAgent: req.headers.get('user-agent') ?? undefined });
    logRequest({ requestId: id, provider: 'not_started', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'passed', scopeResult: 'not_evaluated', fallbackUsed: false });
    return NextResponse.json({ error: 'Too many AI queries. Please wait before asking again.' }, { status: 429, headers: rateLimitHeaders(limited) });
  }

  const demoMode = process.env.QUIKIT_AUTH_ENABLED !== 'true' && dataSource() === 'mock';
  let demoWorkspace: Workspace | undefined;
  if (demoMode && b.workspace !== undefined) {
    let serialized: string;
    try { serialized = JSON.stringify(b.workspace); } catch { serialized = ''; }
    if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_DEMO_WORKSPACE_BYTES) {
      logRequest({ requestId: id, provider: 'not_started', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'failed', scopeResult: 'not_evaluated', fallbackUsed: false });
      return fail('Demo workspace must be valid and no larger than 192 KB.', 413);
    }
    const workspace = workspaceSchema.safeParse(b.workspace);
    if (!workspace.success) {
      logRequest({ requestId: id, provider: 'not_started', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'failed', scopeResult: 'not_evaluated', fallbackUsed: false });
      return fail('Demo workspace has an invalid shape.', 400);
    }
    demoWorkspace = workspace.data as Workspace;
  }

  try {
    const repository = await getAssistantRepository({ orgId, workspace: demoWorkspace });
    const result = await orchestrateAssistant(b.message.trim(), {
      repository, locale: typeof b.locale === 'string' ? b.locale : 'en',
      providerId: typeof b.provider === 'string' ? b.provider as ModelProviderId : undefined,
      workspace: demoWorkspace,
    });
    logRequest({ requestId: id, provider: result.provider, model: result.model, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'passed', scopeResult: result.scopeResult, validation: result.validation.passed ? 'passed' : 'failed', fallbackUsed: result.source === 'fallback' });
    return NextResponse.json({ answer: result.answer, source: result.source, provider: result.provider, model: result.model, contextRefs: result.contextRefs, validation: result.validation, latencyMs: result.latencyMs, limitations: result.limitations });
  } catch {
    logRequest({ requestId: id, provider: 'unknown', model: null, dataSource: actualDataSource(), latencyMs: Math.round(performance.now() - started), inputValidation: 'passed', scopeResult: 'not_evaluated', validation: 'not_run', fallbackUsed: false });
    return fail('Assistant request could not be completed.', 500);
  }
});
