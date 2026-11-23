import type { Metadata } from 'next';
import BillingPage from '../../src/BillingPage';
export const metadata:Metadata={title:'Abonnement — Fabelpad',robots:{index:false,follow:false}};
export default function Page(){return <BillingPage/>;}
