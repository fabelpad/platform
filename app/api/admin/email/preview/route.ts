import { emailAdminRequest } from '../../../../../lib/server/email';
export const runtime = 'nodejs';
export async function GET(request: Request) { return emailAdminRequest(request, 'preview'); }
export async function POST(request: Request) { return emailAdminRequest(request, 'preview'); }
