import { privacyAdminRequest } from '../../../../../lib/server/privacy';
export const runtime = 'nodejs';
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return privacyAdminRequest(request, id);
}
