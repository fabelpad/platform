import { emailAdminRequest } from '../../../../../lib/server/email';
export const runtime = 'nodejs';
export async function POST(request: Request) { return emailAdminRequest(request, 'test'); }
