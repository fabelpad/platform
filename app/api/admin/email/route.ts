import { emailAdminRequest } from '../../../../lib/server/email';
export const runtime = 'nodejs';
export async function GET(request: Request) { return emailAdminRequest(request, 'get'); }
export async function PUT(request: Request) { return emailAdminRequest(request, 'save'); }
