import type { Metadata } from 'next';
import { LegalPageShell } from '../../src/LegalDocumentPage';
export const metadata: Metadata = { title: 'Bedrijfsgegevens — Fabelpad' };
export default function Page() {
  return <LegalPageShell><h1>Gegevens over DG Webservices</h1><p>DG Webservices heeft Fabelpad gemaakt en levert de dienst.</p><dl><dt>Bedrijfsnaam</dt><dd>DG Webservices</dd><dt>Vestigingsplaats</dt><dd>Den Haag (&apos;S-Gravenhage)</dd><dt>KVK-nummer</dt><dd>88135713</dd><dt>E-mail</dt><dd><a href="mailto:info@dgwebservices.nl">info@dgwebservices.nl</a></dd><dt>Website</dt><dd><a href="https://www.dgwebservices.nl">www.dgwebservices.nl</a></dd></dl><h2>Hulp en privacy bij Fabelpad</h2><p>Voor vragen over Fabelpad, een klacht of een privacyverzoek mail je <a href="mailto:support@fabelpad.nl">support@fabelpad.nl</a>.</p><p><a href="/algemene-voorwaarden">Algemene voorwaarden</a> · <a href="/privacyverklaring">Privacyverklaring</a></p></LegalPageShell>;
}
