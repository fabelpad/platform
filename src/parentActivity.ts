export const READING_EVENT = 'fabelpad-conscious-reading';
export function reportConsciousReading(profileId: string) {
  window.dispatchEvent(new CustomEvent(READING_EVENT, { detail: { profileId } }));
}
export function reportConsciousParentAction(parentId: string) {
  void fetch('/api/parent/activity', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': parentId }, body: JSON.stringify({ eventId: crypto.randomUUID(), kind: 'parent_action' }) }).catch(() => { /* A failed request never invents or re-dates activity. */ });
}
type Activity = { eventId: string; kind: 'reading'; profileId: string; occurredAt: string };
type ActivityStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
function validEvent(value: unknown): value is Activity {
  if (!value || typeof value !== 'object') return false;
  const event = value as Activity;
  return event.kind === 'reading' && typeof event.eventId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(event.eventId) && typeof event.profileId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/u.test(event.profileId) && typeof event.occurredAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(event.occurredAt) && Number.isFinite(Date.parse(event.occurredAt));
}
/** Queues real reading actions; a retry keeps the exact original ID and time. */
export class ParentActivityQueue {
  private events: Activity[] = [];
  private writing: Promise<void> | null = null;
  private stopped = false;
  readonly key: string;
  constructor(private owner: string, private options: { store?: ActivityStore; fetcher?: Fetcher; now?: () => Date; id?: () => string; onBlocked?: () => void } = {}) {
    this.key = `fabelpad-parent-activity-${encodeURIComponent(owner)}`;
    try { const raw = this.store.getItem(this.key); const value = raw && raw.length <= 20_000 ? JSON.parse(raw) : []; if (Array.isArray(value)) this.events = value.filter(validEvent).slice(-50).map(({ eventId, kind, profileId, occurredAt }) => ({ eventId, kind, profileId, occurredAt })); } catch { /* Invalid or inaccessible queue starts empty. */ }
  }
  private get store(): ActivityStore { return this.options.store || window.localStorage; }
  private persist() { try { this.store.setItem(this.key, JSON.stringify(this.events)); } catch { /* A blocked device retains the current bounded in-memory queue. */ } }
  record(profileId: string) {
    if (this.stopped) return;
    const event: Activity = { eventId: this.options.id?.() || crypto.randomUUID(), kind: 'reading', profileId, occurredAt: (this.options.now?.() || new Date()).toISOString() };
    if (!validEvent(event) || this.events.some(item => item.eventId === event.eventId)) return;
    this.events = [...this.events, event].slice(-50); this.persist(); void this.flush();
  }
  async flush(): Promise<void> {
    if (this.stopped) return;
    if (this.writing) return this.writing;
    this.writing = this.run();
    try { await this.writing; } finally { this.writing = null; }
  }
  private async run() {
    const fetcher = this.options.fetcher || fetch;
    while (!this.stopped && this.events.length > 0) {
      const event = this.events[0];
      let response: Response;
      try { response = await fetcher('/api/parent/activity', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': this.owner }, body: JSON.stringify(event) }); } catch { return; }
      if (this.stopped) return;
      if (response.status === 403 || response.status === 410 || response.status === 423) { this.events = []; this.persist(); this.stopped = true; this.options.onBlocked?.(); return; }
      if (response.status === 401 || response.status === 429 || response.status >= 500) return;
      // Invalid/too-old events cannot extend a deadline; do not retry them with a newer time.
      this.events = this.events.filter(item => item.eventId !== event.eventId); this.persist();
    }
  }
  stop() { this.stopped = true; }
  discard() { this.events = []; this.persist(); }
}
