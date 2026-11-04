import { getContent } from '../../../../lib/server/content';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ storyId: string }> }) { return getContent(request, (await context.params).storyId); }
