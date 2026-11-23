import { discountedPrice } from './pricing.ts';
import type { BillingCouponInput,BillingPeriod } from './types.ts';
export type BillingPriceQuote={period:BillingPeriod;baseAmountCents:number;amountCents:number;gift:boolean;couponSnapshot?:{kind:'percentage'|'amount';value:number;amountBasis:'period'|'month';durationMonths:number|null}|null};
/** Price disclosure only. The server freezes and enforces the actual agreement. */
export function renewalPriceSchedule(quote:BillingPriceQuote):Array<{amountCents:number;payments:number|null}>{
 if(quote.gift)return [];
 const coupon=quote.couponSnapshot;if(!coupon)return [{amountCents:quote.baseAmountCents,payments:null}];
 if(coupon.durationMonths===null)return [{amountCents:quote.amountCents,payments:null}];
 const monthsPerPeriod=quote.period==='year'?12:1,rows:Array<{amountCents:number;payments:number|null}>=[];
 for(let index=1;index<Math.ceil(coupon.durationMonths/monthsPerPeriod);index++){
  const remaining=coupon.durationMonths-index*monthsPerPeriod;
  const data:BillingCouponInput={name:'Getoonde kortingsafspraak',codes:['DISPLAY-ONLY'],...coupon,durationMonths:remaining,validFrom:null,validUntil:null,maximumRedemptions:null,perFamilyLimit:1,periods:[quote.period],enabled:true};
  const amount=discountedPrice(quote.baseAmountCents,quote.period,data).amountCents,last=rows.at(-1);
  if(last&&last.amountCents===amount)last.payments=Number(last.payments)+1;else rows.push({amountCents:amount,payments:1});
 }
 rows.push({amountCents:quote.baseAmountCents,payments:null});return rows;
}
