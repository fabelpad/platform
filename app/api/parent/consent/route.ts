import { parentRequest } from '../../../../lib/server/parent';
export const runtime = 'nodejs';
export async function POST(request: Request) { return parentRequest(request, 'consent'); }
export async function DELETE(request: Request) { return parentRequest(request, 'consent'); }
