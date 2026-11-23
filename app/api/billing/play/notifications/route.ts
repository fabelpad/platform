import { billingProviderSignal } from '../../../../../lib/server/billing';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function POST(request:Request) { return billingProviderSignal(request,'play'); }
