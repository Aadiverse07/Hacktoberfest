import type { NextRequest, NextResponse } from 'next/server';
import { getExternalIdentity } from '@/lib/external-auth';
import { logger } from '@/lib/logger';
import { fail } from '@/lib/api/response';
import { isAdminTier } from '@/lib/api/roles';
import { repositoryMode } from '@/lib/repo';

/**
 * Per-app route wrapper for session validation, organization scoping and consistent API errors.
 * The standalone adapter validates through `GET /api/verify-token`; module permission gating
 * remains disabled until the app registers its module permissions.
 */
export type OrgAuthContext = {
  userId: string;
  orgId: string;
  orgRole: string | null;
  isSuperAdmin: boolean;
  email: string | null;
  actingAs: 'user';
  actingAgentId: null;
};

export type OrgAuthHandler = (ctx: OrgAuthContext, req: NextRequest) => Promise<NextResponse> | NextResponse;

export function withOrgAuth(handler: OrgAuthHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await getExternalIdentity(req);
    if (!auth.ok && !(auth.code === 'QUIKIT_AUTH_DISABLED' && repositoryMode() === 'mock')) return fail(auth.message, auth.status);

    const identity = auth.ok ? auth.identity : { userId: req.headers.get('x-finova-user-id') || req.headers.get('x-finova-device-id') || 'demo-user', orgId: 'demo-org', orgRole: 'ADMIN', isSuperAdmin: false, email: null };
    const ctx: OrgAuthContext = {
      userId: identity.userId,
      orgId: identity.orgId,
      orgRole: identity.orgRole,
      isSuperAdmin: identity.isSuperAdmin,
      email: identity.email ?? null,
      actingAs: 'user',
      actingAgentId: null,
    };

    try {
      return await handler(ctx, req);
    } catch (error: unknown) {
      // Log detail server-side; never leak stack traces or internals to the client.
      logger.error({ err: error instanceof Error ? error.message : 'unknown', orgId: ctx.orgId }, 'unhandled route error');
      return fail('Operation failed', 500);
    }
  };
}

/** Org-admin-only routes: same org scoping as `withOrgAuth`, plus an admin-tier role check (-> 403). */
export function requireAdmin(handler: OrgAuthHandler) {
  return withOrgAuth((ctx, req) => {
    if (!isAdminTier(ctx.orgRole, ctx.isSuperAdmin)) return fail('Admin access required', 403);
    return handler(ctx, req);
  });
}
