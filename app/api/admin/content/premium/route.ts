import { publishPremiumContent } from '../../../../../lib/server/premiumContent';
export const runtime='nodejs';
export function POST(request:Request){return publishPremiumContent(request);}
