import type { BillingCouponInput, BillingPeriod } from './types.ts';
/** Calendar arithmetic clamps month-end and uses UTC; never a fixed 365-day year. */
export function addCalendarMonths(iso: string, months: number): string {
  if (!Number.isSafeInteger(months) || months < 1 || months > 1200 || !Number.isFinite(Date.parse(iso))) throw new Error('Ongeldige looptijd.');
  const d=new Date(iso), day=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return d.toISOString();
}
export function normalizeCouponCode(value: string): string {
  const code=value.trim().toUpperCase(); if(!/^[A-Z0-9][A-Z0-9-]{3,63}$/.test(code))throw new Error('Ongeldige kortingscode.'); return code;
}
export function discountedPrice(amountCents: number, period: BillingPeriod, coupon: Pick<BillingCouponInput,'kind'|'value'|'amountBasis'|'durationMonths'>): { amountCents:number; discountCents:number; gift:boolean } {
  if(!Number.isSafeInteger(amountCents)||amountCents<1||!Number.isSafeInteger(coupon.value)||coupon.value<1||(coupon.kind==='percentage'&&coupon.value>100)||!['percentage','amount'].includes(coupon.kind)||!['period','month'].includes(coupon.amountBasis)||(coupon.durationMonths!==null&&(!Number.isSafeInteger(coupon.durationMonths)||coupon.durationMonths<1||coupon.durationMonths>120)))throw new Error('Ongeldige korting.');
  const months=period==='year'?Math.min(12,coupon.durationMonths??12):1;
  const raw=coupon.kind==='percentage'&&coupon.value===100?amountCents:coupon.kind==='percentage'?Math.floor((amountCents*coupon.value*months+50*(period==='year'?12:1))/(100*(period==='year'?12:1))):coupon.value*(coupon.amountBasis==='month'?months:1);
  const discountCents=Math.min(amountCents,raw);return {amountCents:amountCents-discountCents,discountCents,gift:discountCents===amountCents};
}
export function parseBillingCoupon(value: unknown): BillingCouponInput {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ongeldige kortingsactie.');
  const x=value as BillingCouponInput;
  const allowed=['name','codes','kind','value','amountBasis','durationMonths','validFrom','validUntil','maximumRedemptions','perFamilyLimit','periods','enabled'];
  if(Object.keys(x).length!==allowed.length||!allowed.every(k=>Object.hasOwn(x,k))||typeof x.name!=='string'||x.name.trim()!==x.name||x.name.length<1||x.name.length>100||/[\u0000-\u001f<>]/.test(x.name)||!Array.isArray(x.codes)||x.codes.length<1||x.codes.length>1000||x.codes.some(c=>typeof c!=='string')||x.perFamilyLimit!==1||typeof x.enabled!=='boolean'||!Array.isArray(x.periods)||x.periods.length<1||x.periods.length>2||x.periods.some(p=>!['month','year'].includes(p))||new Set(x.periods).size!==x.periods.length||(x.maximumRedemptions!==null&&(!Number.isSafeInteger(x.maximumRedemptions)||x.maximumRedemptions<1||x.maximumRedemptions>1000000)))throw new Error('Ongeldige kortingsactie.');
  for(const t of [x.validFrom,x.validUntil])if(t!==null&&(typeof t!=='string'||!Number.isFinite(Date.parse(t))))throw new Error('Ongeldige geldigheid.');
  if(x.validFrom&&x.validUntil&&Date.parse(x.validUntil)<=Date.parse(x.validFrom))throw new Error('Ongeldige geldigheid.');
  discountedPrice(499,'month',x); const codes=x.codes.map(normalizeCouponCode);if(new Set(codes).size!==codes.length)throw new Error('Dubbele kortingscode.');return {...x,codes};
}
