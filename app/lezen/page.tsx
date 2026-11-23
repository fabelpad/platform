import LocalExperience from '../../src/LocalExperience';
import {getSupabaseConfig} from '../../lib/supabase/config';
export default function Page(){return <LocalExperience surface="reader" cloudContent={!!getSupabaseConfig()}/>;}
