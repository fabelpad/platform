import type { Metadata } from 'next';
import StudioPageAccess from '../../../../src/StudioPageAccess';
import SocialHeroConnectionPage from '../../../../src/blog/SocialHeroConnectionPage';
export const metadata: Metadata = { title: 'SocialHero-koppeling — Fabelpad beheer', robots: { index: false, follow: false } };
export default function Page() { return <StudioPageAccess returnTo="/studio/integraties/socialhero"><SocialHeroConnectionPage /></StudioPageAccess>; }
