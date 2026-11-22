import { parentRequest } from '../../../../lib/server/parent';
export const runtime = 'nodejs';
export async function GET(request: Request) { return parentRequest(request, 'status'); }
