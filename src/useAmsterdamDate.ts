'use client';
import { useEffect, useState } from 'react';
import { amsterdamDate } from './profileReading';

/** The profile's category follows the Dutch calendar, including a resumed tab. */
export function useAmsterdamDate(): string {
  const [today, setToday] = useState(() => amsterdamDate());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setToday(amsterdamDate());
    const tick = () => { refresh(); timer = setTimeout(tick, 60_000 - Date.now() % 60_000 + 10); };
    tick();
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return today;
}
