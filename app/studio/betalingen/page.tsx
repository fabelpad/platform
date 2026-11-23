import type { Metadata } from 'next';
import BillingAdminPage from '../../../src/BillingAdminPage';
export const metadata:Metadata={title:'Abonnementen & betalingen — Fabelpad',robots:{index:false,follow:false}};
export default function Page(){return <BillingAdminPage/>;}
