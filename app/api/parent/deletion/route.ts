import { parentRequest } from '../../../../lib/server/parent';
export const runtime = 'nodejs';
export async function GET(request: Request) { return parentRequest(request, 'deletion'); }
export async function POST(request: Request) { return parentRequest(request, 'deletion'); }
