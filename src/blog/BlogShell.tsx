import type { ReactNode } from 'react';
import LegalFooter from '../LegalFooter';
import './blog.css';

export default function BlogShell({ children }: { children: ReactNode }) {
  return <div className="fp-blog"><a className="fp-blog-skip" href="#blog-main">Naar de inhoud</a><header className="fp-blog-header"><a href="/" aria-label="Fabelpad, naar de website"><img src="/brand/logo.webp" width="180" height="72" alt="Fabelpad" /></a><nav aria-label="Website-navigatie"><a href="/blog" aria-current="page">Blog &amp; artikelen</a><a href="/inloggen">Inloggen</a><a className="fp-blog-button" href="/lezen">Ontdek de verhalen →</a></nav></header>{children}<LegalFooter /></div>;
}
