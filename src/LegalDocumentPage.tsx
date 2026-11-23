import type { ReactNode } from 'react';
import LegalFooter from './LegalFooter';

type Section = { readonly id: string; readonly title: string; readonly paragraphs: readonly string[] };
export type LegalDocument = { readonly title: string; readonly version: string; readonly updated: string; readonly introduction: string; readonly sections: readonly Section[] };

export function LegalPageShell({ children }: { children: ReactNode }) {
  return <div className="simple-page privacy-page legal-page"><a className="skip-link" href="#juridische-inhoud">Naar de inhoud</a><header><a href="/" aria-label="Fabelpad startpagina"><img src="/brand/logo.webp" alt="Fabelpad" width="175" height="70" /></a><nav aria-label="Informatie"><a href="/lezen">Verhalen</a><a href="/privacyverklaring">Privacy</a><a href="/support">Hulp</a></nav></header><main id="juridische-inhoud">{children}</main><LegalFooter /></div>;
}

function Paragraph({ text }: { text: string }) {
  const parts = text.split(/(support@fabelpad\.nl|info@dgwebservices\.nl|www\.dgwebservices\.nl|autoriteitpersoonsgegevens\.nl|\/herroepen)/g);
  return <p>{parts.map((part, index) => {
    if (part === 'support@fabelpad.nl' || part === 'info@dgwebservices.nl') return <a key={index} href={`mailto:${part}`}>{part}</a>;
    if (part === 'www.dgwebservices.nl' || part === 'autoriteitpersoonsgegevens.nl') return <a key={index} href={`https://${part}`}>{part}</a>;
    if (part === '/herroepen') return <a key={index} href={part}>Koop ongedaan maken</a>;
    return part;
  })}</p>;
}

export default function LegalDocumentPage({ document, downloadUrl, privacy = false, notice }: { document: LegalDocument; downloadUrl: string; privacy?: boolean; notice?: ReactNode }) {
  return <LegalPageShell><h1>{document.title}</h1><p className="legal-version"><strong>Versie {document.version}</strong> · Ingangsdatum {document.updated}</p><Paragraph text={document.introduction} />{notice}<div className="legal-document-actions"><a href={downloadUrl} download>Deze versie als tekst bewaren</a><a href="/bedrijfsgegevens">Gegevens over DG Webservices</a>{privacy && <a href="/privacy-voor-kinderen">Uitleg voor kinderen</a>}</div>{privacy && <p id="mail-verwijderen"><a href="/account-verwijderen">Account en gegevens verwijderen</a> · <a href="/privacyverzoek">Een privacyverzoek indienen</a></p>}<nav className="legal-contents" aria-label="Inhoudsopgave"><ol>{document.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav>{document.sections.map(section => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((text, index) => <Paragraph key={index} text={text} />)}</section>)}{privacy && <section aria-labelledby="dienstverleners"><h2 id="dienstverleners">Privacyinformatie van dienstverleners</h2><ul><li><a href="https://supabase.com/legal/customer-resources/data-processing-addendum">Supabase: verwerkersvoorwaarden en internationale doorgifte</a></li><li><a href="https://supabase.com/legal/subprocessors">Supabase: subverwerkers</a></li><li><a href="https://resend.com/legal/dpa">Resend: verwerkersvoorwaarden</a></li><li><a href="https://resend.com/legal/subprocessors">Resend: subverwerkers</a></li><li><a href="https://policies.google.com/privacy?hl=nl">Google: privacybeleid</a></li></ul></section>}</LegalPageShell>;
}
