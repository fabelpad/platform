import { TERMS_VERSION, PRIVACY_VERSION, LEGAL_DOCUMENTS } from '../../../../lib/legal/documents';
export const runtime = 'nodejs';
export async function GET() {
  return Response.json({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, documents: LEGAL_DOCUMENTS }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
