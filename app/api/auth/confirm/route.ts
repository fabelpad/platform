import { authMutation } from '../../../../lib/server/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request) { return authMutation(request, 'confirm'); }
