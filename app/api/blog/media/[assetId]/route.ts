import { blogApi } from '../../../../../lib/server/blog';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) { return blogApi(request, 'media', [(await params).assetId]); }
