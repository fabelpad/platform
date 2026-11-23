import StudioPageAccess from '../../../src/StudioPageAccess';
import AdminDashboard from '../../../src/AdminDashboard';
export const metadata = { title: 'Cockpit · Fabelpad Studio', robots: { index: false, follow: false } };
export default function Page() { return <StudioPageAccess returnTo="/studio/overzicht"><AdminDashboard /></StudioPageAccess>; }
