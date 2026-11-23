import { billingRequest } from '../../../../../lib/server/billing';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request:Request) { return billingRequest(request,'coupons'); }
export function POST(request:Request) { return billingRequest(request,'saveCoupons'); }
export function PATCH(request:Request){return billingRequest(request,'couponEnabled');}
