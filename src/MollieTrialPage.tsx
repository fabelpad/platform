'use client';
import { useEffect,useState } from 'react';
import { PageShell } from './AccountPage';
import { billingFetch } from './billingClient';
import './billing.css';
export default function MollieTrialPage(){
 const [notice,setNotice]=useState('De testbetaling wordt bij Mollie gecontroleerd…'),[done,setDone]=useState(false);
 useEffect(()=>{let active=true;const trialId=new URL(location.href).searchParams.get('trial');if(!trialId){setNotice('Er is geen beheertest meegegeven.');return;}void billingFetch('/api/admin/billing/test-callback',{trialId}).then(result=>{if(active){setDone(result.confirmed===true);setNotice(result.confirmed===true?`Testbetaling bevestigd. Terugkeer: ${result.callbackVerified?'bevestigd':'wacht'}. Webhook: ${result.webhookVerified?'bevestigd':'wacht'}. Er is geen abonnement of gezinsrecht aangemaakt.`:'De testbetaling is nog niet als betaald bevestigd. Bekijk de actuele status in beheer.');}}).catch(e=>{if(active)setNotice(e.message);});return()=>{active=false;};},[]);
 return <PageShell><div className="billing-page"><h1>Mollie beheertest</h1><p role="status" className="billing-notice">{notice}</p><p>{done?'Deze proef blijft gescheiden van echte gezinsaankopen.':'Deze pagina vereist een actuele beheerrol en verse aanmelding.'}</p><a href="/studio/betalingen">Terug naar Abonnementen &amp; betalingen</a></div></PageShell>;
}
