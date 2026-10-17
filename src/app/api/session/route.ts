import { NextResponse } from 'next/server';

/** The standalone app uses local demo sessions; no external session provider is configured. */
export async function GET() {
  return NextResponse.json({ success: true, data: { user: null, provider: 'mock' } });
}
