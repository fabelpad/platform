import { contentDraft } from '../../../../../lib/server/content';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function handle(request: Request, context: { params: Promise<{ storyId: string }> }) { return contentDraft(request, (await context.params).storyId); }
export const GET = handle;
export const PUT = handle;
