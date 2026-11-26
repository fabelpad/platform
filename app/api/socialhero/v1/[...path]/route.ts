import { blogApi } from '../../../../../lib/server/blog';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
async function handler(request: Request, context: Context) { return blogApi(request, 'socialhero', (await context.params).path); }
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
