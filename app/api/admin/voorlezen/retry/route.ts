import { narrationRequest } from '../../../../../lib/server/narration';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) { return narrationRequest(request, 'retry'); }
