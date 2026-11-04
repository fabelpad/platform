import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleFamilyRequest } from '../../../lib/familyRepository';

export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<Response> {
  return handleFamilyRequest(request, {
    async getParent() {
      const user = await getChatGPTUser();
      return user ? { id: user.userId, email: user.email, displayName: user.displayName } : null;
    },
    getDatabase() {
      if (!env.DB) throw new Error('D1 is not configured.');
      return env.DB;
    },
  });
}

export const GET = handle;
export const PUT = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
