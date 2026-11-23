'use client';
import { useEffect, useRef, useState } from 'react';
import { readAccountSession, type AccountSession } from './AccountPage';

export type AdminOperation = { parentId: string; epoch: number };
/** Keep an open administration screen bound to the actor that opened it.
 * Server actions independently compare that actor with the current cookie user.
 */
export function useAdminIdentity(onInvalidated: () => void) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const owner = useRef<string | null>(null);
  const epoch = useRef(0);
  const live = useRef(false);
  const blocked = useRef(false);
  const callback = useRef(onInvalidated); callback.current = onInvalidated;
  function invalidate(message = 'Je beheersessie is gewijzigd of verlopen. Log opnieuw in als beheerder.') {
    epoch.current += 1; blocked.current = true; owner.current = null;
    if (live.current) { setDenied(true); setError(message); callback.current(); }
  }
  function capture(): AdminOperation | null { return live.current && !blocked.current && owner.current ? { parentId: owner.current, epoch: epoch.current } : null; }
  function isCurrent(operation: AdminOperation) { return live.current && !blocked.current && operation.epoch === epoch.current && operation.parentId === owner.current; }
  useEffect(() => {
    live.current = true;
    let controller: AbortController | null = null;
    let generation = 0;
    let initialized = false;
    async function verify() {
      if (document.visibilityState !== 'visible') return;
      controller?.abort(); controller = new AbortController();
      const current = ++generation, signal = controller.signal;
      try {
        const next = await fetch('/api/auth/session', { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) }).then(readAccountSession);
        if (!live.current || signal.aborted || current !== generation) return;
        const eligible = next.configured && next.admin && !!next.parent && (!next.lifecycle || next.lifecycle.state === 'active' && next.lifecycle.acceptedTermsVersion === next.lifecycle.termsVersion);
        if (initialized && (!eligible || next.parent!.id !== owner.current)) { invalidate(); setSession(next); }
        else if (!blocked.current) { owner.current = eligible ? next.parent!.id : null; setSession(next); }
        initialized = true; setChecked(true);
      } catch (problem) {
        if (!live.current || signal.aborted || current !== generation) return;
        const message = problem instanceof Error ? problem.message : 'De beheersessie is nu niet bereikbaar.';
        if (initialized) invalidate(message); else setError(message);
        setChecked(true);
      }
    }
    const foreground = () => { void verify(); };
    window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground); void verify();
    return () => { live.current = false; epoch.current += 1; controller?.abort(); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); };
  }, []);
  return { session, checked, denied, error, capture, isCurrent, invalidate };
}
