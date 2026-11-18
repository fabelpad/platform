import { privacy } from './privacyContent';

export default function PrivacyPage() {
  return <div className="simple-page privacy-page">
    <header><a href="/" aria-label="Fabelpad startpagina"><img src="/brand/logo.webp" alt="Fabelpad" width="175" height="70" /></a><nav aria-label="Informatie"><a href="/privacy">Privacy</a><a href="/account-verwijderen">Gegevens verwijderen</a><a href="mailto:support@fabelpad.nl">Contact</a></nav></header>
    <main><h1>{privacy.title}</h1><p><strong>Fabelpad · DG Webservices</strong><br />Bijgewerkt op {privacy.updated}</p><p>{privacy.introduction}</p>
      <p><a href="#verwijderen">Lokale appgegevens wissen</a> · <a href="#mail-verwijderen">Een verwijderverzoek indienen</a> · <a href="mailto:support@fabelpad.nl">support@fabelpad.nl</a></p>
      <nav aria-label="Inhoud"><ol>{privacy.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav>
      {privacy.sections.map(section => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map(text => <p key={text}>{text}</p>)}</section>)}
    </main>
  </div>;
}
