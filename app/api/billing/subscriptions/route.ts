import { billingRequest } from '../../../../lib/server/billing';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request:Request) { return billingRequest(request,'subscriptions'); }
