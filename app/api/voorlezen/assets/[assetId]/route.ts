import { narrationRequest } from '../../../../../lib/server/narration';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) { return narrationRequest(request, 'asset', (await context.params).assetId); }
