import { getContent } from '../../../lib/server/content';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) { return getContent(request); }
