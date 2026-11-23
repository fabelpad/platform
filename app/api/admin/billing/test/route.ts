import { billingRequest } from '../../../../../lib/server/billing';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request:Request) { return billingRequest(request,'test'); }
