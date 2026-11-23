import { billingRequest } from '../../../../../lib/server/billing';
export const runtime='nodejs';
export function POST(request:Request){return billingRequest(request,'playTrial');}
