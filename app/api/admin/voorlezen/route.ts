import { narrationRequest } from '../../../../lib/server/narration';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return narrationRequest(request, 'get'); }
export function PUT(request: Request) { return narrationRequest(request, 'save'); }
