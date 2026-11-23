import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { getStudioPageAccess } from '../lib/server/studioAccess';
import ParentShell from './ParentShell';

export default async function StudioPageAccess({ children, returnTo }: { children: ReactNode; returnTo: string }) {
  // Keep the account decision outside prerendering, including local mode.
  // This request boundary must remain outside the policy's error handling.
  await connection();
  const access = await getStudioPageAccess();
  if (access.allowed) return children;
  const message = access.reason === 'login' ? 'Log in met je beheeraccount om deze pagina te openen.'
    : access.reason === 'account' ? 'Rond je ouderaccount af of bekijk je accountstatus voordat je het beheer opent.'
    : access.reason === 'role' ? 'Dit ouderaccount heeft geen toegang tot het platformbeheer.'
    : 'Je beheerrechten konden niet worden gecontroleerd. Probeer de pagina opnieuw te laden.';
  return <ParentShell storiesHref="/lezen"><section className="account-form"><h1>Platformbeheer</h1><p role="status">{message}</p>
    {access.reason === 'login' ? <a className="account-primary" href={`/inloggen?next=${encodeURIComponent(returnTo)}`}>Inloggen voor beheer</a>
      : access.reason === 'unavailable' ? <a className="account-primary" href={returnTo}>Opnieuw proberen</a>
      : <a className="account-primary" href="/profiel/account">Ouderaccount bekijken</a>}
  </section></ParentShell>;
}
