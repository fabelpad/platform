import { publishContent } from '../../../../../lib/server/content';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ storyId: string }> }) { return publishContent(request, (await context.params).storyId); }
