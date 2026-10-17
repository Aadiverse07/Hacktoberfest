import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** External page authentication is disabled in the standalone mock-first build. */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
};
