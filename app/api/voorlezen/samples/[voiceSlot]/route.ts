import { narrationRequest } from '../../../../../lib/server/narration';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ voiceSlot: string }> }) { return narrationRequest(request, 'sample', (await context.params).voiceSlot); }
