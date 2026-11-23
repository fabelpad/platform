import type { NextRequest } from 'next/server';
import { refreshStudioSession } from './lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return refreshStudioSession(request);
}

// Only pages with a read-only Server Component auth client need this bridge.
// API handlers already persist their own cookie refreshes.
export const config = { matcher: ['/studio/:path*'] };
