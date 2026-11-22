import { redirect } from 'next/navigation';

/** Preserve old bookmarks without exposing simulated app states. */
export default function Page() { redirect('/lezen'); }
