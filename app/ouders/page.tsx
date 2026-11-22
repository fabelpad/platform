import { redirect } from 'next/navigation';
import { getSupabaseConfig } from '../../lib/supabase/config';
import LocalExperience from '../../src/LocalExperience';

export const dynamic = 'force-dynamic';

export default function Page() {
  if (getSupabaseConfig()) redirect('/gezin?ouders=1');
  return <LocalExperience surface="parents" />;
}
