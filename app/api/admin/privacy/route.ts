import { privacyAdminRequest } from '../../../../lib/server/privacy';
export const runtime = 'nodejs';
export async function GET(request: Request) { return privacyAdminRequest(request); }
export async function POST(request: Request) { return privacyAdminRequest(request); }
