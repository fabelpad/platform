import type { FamilySnapshot } from './profileStorage';
import { isFamilySnapshot } from './profileStorage';

export type ParentIdentity = { id: string; email: string; displayName: string };
export type CloudEnvelope = { parent: ParentIdentity; revision: number; snapshot: FamilySnapshot | null };
export type SyncPhase = 'loading' | 'empty' | 'saved' | 'pending' | 'saving' | 'offline' | 'conflict' | 'signed-out' | 'error';
export type SyncState = { phase: SyncPhase; revision: number; snapshot: FamilySnapshot | null; dirty: boolean; remote?: { revision: number; snapshot: FamilySnapshot | null }; message?: string; localDurable?: boolean };
type Draft = { owner: string; revision: number; snapshot: FamilySnapshot; dirty: boolean; baseSnapshot?: FamilySnapshot | null };
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameContent = (a: FamilySnapshot | null, b: FamilySnapshot | null) => a && b ? equal({ ...a, family: { ...a.family, activeId: '' } }, { ...b, family: { ...b.family, activeId: '' } }) : a === b;

export class FamilySyncClient {
  private state: SyncState = { phase: 'loading', revision: 0, snapshot: null, dirty: false };
  private listeners = new Set<(state: SyncState) => void>();
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writing: Promise<void> | null = null;
  private refreshing = false;
  private disposed = false;
  private store: Store;
  private fetcher: Fetcher;
  private debounceMs: number;
  private onRemote: (snapshot: FamilySnapshot | null) => void;
  private canApplyRemote: () => boolean;
  private onMerged: (snapshot: FamilySnapshot) => void;
  private baseSnapshot: FamilySnapshot | null | undefined;
  readonly cacheKey: string;

  constructor(readonly owner: string, options: { fetcher?: Fetcher; store?: Store; debounceMs?: number; onRemote?: (snapshot: FamilySnapshot | null) => void; canApplyRemote?: () => boolean; onMerged?: (snapshot: FamilySnapshot) => void } = {}) {
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    this.store = options.store ?? { getItem: key => { try { return window.localStorage.getItem(key); } catch { return null; } }, setItem: (key, value) => { window.localStorage.setItem(key, value); } };
    this.debounceMs = options.debounceMs ?? 700;
    this.onRemote = options.onRemote ?? (() => {});
    this.canApplyRemote = options.canApplyRemote ?? (() => true);
    this.onMerged = options.onMerged ?? (() => {});
    this.cacheKey = `fabelpad-cloud-draft-${encodeURIComponent(owner)}`;
  }
  getState(): SyncState { return this.state; }
  subscribe(listener: (state: SyncState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private emit(next: SyncState) { this.state = next; if (!this.disposed) for (const listener of this.listeners) listener(next); }
  private cache() {
    try {
      this.store.setItem(this.cacheKey, JSON.stringify({ owner: this.owner, revision: this.state.revision, snapshot: this.state.snapshot, dirty: this.state.dirty, baseSnapshot: this.baseSnapshot }));
      if (this.state.localDurable === false) this.emit({ ...this.state, localDurable: true });
    } catch { if (this.state.localDurable !== false) this.emit({ ...this.state, localDurable: false }); }
  }
  private draft(): Draft | null {
    try {
      const value = JSON.parse(this.store.getItem(this.cacheKey) || 'null') as Draft | null;
      return value && value.owner === this.owner && Number.isSafeInteger(value.revision) && value.revision >= 0 && typeof value.dirty === 'boolean' && isFamilySnapshot(value.snapshot) ? value : null;
    } catch { return null; }
  }
  private backup(remote?: { revision: number; snapshot: FamilySnapshot | null }) {
    try { this.store.setItem(`${this.cacheKey}-recovery`, JSON.stringify({ savedAt: new Date().toISOString(), local: this.state.snapshot, localRevision: this.state.revision, remote: remote ?? null })); } catch { /* Pending state remains in the current session. */ }
  }
  private envelope(value: unknown): CloudEnvelope {
    const v = value as CloudEnvelope | null;
    if (v?.parent?.id !== this.owner) throw new AuthError();
    if (!v || !Number.isSafeInteger(v.revision) || v.revision < 0 || (v.snapshot !== null && !isFamilySnapshot(v.snapshot))) throw new Error('Ongeldig antwoord van de opslag.');
    return v;
  }
  private async getCloud(): Promise<CloudEnvelope> {
    const response = await this.fetcher('/api/family', { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'X-Fabelpad-Parent': this.owner } });
    if (response.status === 401 || response.status === 403 || response.redirected || response.headers.get('Content-Type')?.includes('text/html')) throw new AuthError();
    if (!response.ok) throw new Error('De opgeslagen avonturen zijn nu niet bereikbaar.');
    return this.envelope(await response.json());
  }
  async load(): Promise<void> {
    const cached = this.draft();
    this.emit({ ...this.state, phase: 'loading' });
    try {
      const remote = await this.getCloud();
      if (this.disposed) return;
      this.baseSnapshot = remote.snapshot;
      if (cached?.dirty && cached.revision !== remote.revision && !sameContent(cached.snapshot, remote.snapshot)) {
        const merged = cached.baseSnapshot && mergeDisjointChildren(cached.baseSnapshot, cached.snapshot, remote.snapshot);
        if (merged) {
          this.generation = 1;
          this.emit({ phase: 'pending', revision: remote.revision, snapshot: merged, dirty: true });
          this.cache(); this.onRemote(merged); void this.flush(); return;
        }
        this.baseSnapshot = cached.baseSnapshot;
        this.generation = 1;
        this.emit({ phase: 'conflict', revision: cached.revision, snapshot: copy(cached.snapshot), dirty: true, remote: { revision: remote.revision, snapshot: remote.snapshot } });
        this.backup(this.state.remote); this.onRemote(cached.snapshot); return;
      }
      if (cached?.dirty && cached.revision === remote.revision) {
        this.generation = 1;
        this.emit({ phase: 'pending', revision: cached.revision, snapshot: copy(cached.snapshot), dirty: true });
        this.onRemote(cached.snapshot); void this.flush(); return;
      }
      this.emit({ phase: remote.snapshot ? 'saved' : 'empty', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
      this.cache(); this.onRemote(remote.snapshot);
    } catch (error) {
      if (this.disposed) return;
      if (error instanceof AuthError) { this.emit({ ...this.state, phase: 'signed-out', message: 'Log opnieuw in om jullie verhalen te openen.' }); return; }
      if (cached) {
        this.baseSnapshot = cached.baseSnapshot;
        if (cached.dirty) this.generation = 1;
        this.emit({ phase: 'offline', revision: cached.revision, snapshot: copy(cached.snapshot), dirty: cached.dirty, message: 'Geen verbinding. Je ziet de laatst bewaarde apparaatversie.' });
        this.onRemote(cached.snapshot);
      } else this.emit({ phase: 'error', revision: 0, snapshot: null, dirty: false, message: 'We kunnen jullie verhalen nog niet ophalen. Probeer het opnieuw.' });
    }
  }
  enqueue(snapshot: FamilySnapshot): void {
    if (this.disposed || !isFamilySnapshot(snapshot) || sameContent(snapshot, this.state.snapshot)) return;
    this.generation += 1;
    this.emit({ ...this.state, snapshot: copy(snapshot), dirty: true, phase: this.state.phase === 'conflict' ? 'conflict' : this.state.phase === 'signed-out' ? 'signed-out' : 'pending', message: undefined });
    this.cache();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, this.debounceMs);
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.writing) return this.writing;
    if (this.disposed || !this.state.dirty || !this.state.snapshot || this.state.phase === 'conflict' || this.state.phase === 'signed-out') return;
    this.writing = this.runWrites();
    try { await this.writing; } finally { this.writing = null; }
  }
  private async runWrites() {
    let mergeRetries = 0;
    while (!this.disposed && this.state.dirty && this.state.snapshot && this.state.phase !== 'conflict' && this.state.phase !== 'signed-out') {
      const submittedGeneration = this.generation;
      const submitted = copy(this.state.snapshot);
      const baseRevision = this.state.revision;
      this.emit({ ...this.state, phase: 'saving', message: undefined });
      try {
        const response = await this.fetcher('/api/family', { method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Fabelpad-Parent': this.owner }, body: JSON.stringify({ baseRevision, snapshot: submitted }) });
        if (this.disposed) return;
        if (response.status === 401 || response.status === 403 || response.redirected || response.headers.get('Content-Type')?.includes('text/html')) { this.emit({ ...this.state, phase: 'signed-out', message: 'Log opnieuw in. Je veranderingen blijven op dit apparaat bewaard.' }); this.cache(); return; }
        if (response.status === 409) {
          const value = await response.json() as { revision?: number; snapshot?: unknown };
          if (!Number.isSafeInteger(value.revision) || (value.revision ?? -1) < 0 || (value.snapshot !== null && !isFamilySnapshot(value.snapshot))) throw new Error('Ongeldig versieantwoord.');
          const remote = { revision: value.revision!, snapshot: value.snapshot as FamilySnapshot | null };
          if (sameContent(this.state.snapshot, remote.snapshot)) {
            this.baseSnapshot = remote.snapshot;
            this.emit({ phase: 'saved', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
            this.cache(); if (remote.snapshot) this.onMerged(remote.snapshot); return;
          }
          const merged = this.baseSnapshot && this.state.snapshot && mergeRetries < 3 ? mergeDisjointChildren(this.baseSnapshot, this.state.snapshot, remote.snapshot) : null;
          if (merged) {
            mergeRetries += 1; this.generation += 1; this.baseSnapshot = remote.snapshot;
            this.emit({ phase: 'pending', revision: remote.revision, snapshot: merged, dirty: true });
            this.cache(); this.onMerged(merged); continue;
          }
          this.emit({ ...this.state, phase: 'conflict', remote }); this.cache(); this.backup(remote); return;
        }
        if (!response.ok) { this.emit({ ...this.state, phase: 'error', message: 'Bewaren lukt nu niet. Je veranderingen staan nog op dit apparaat.' }); this.cache(); return; }
        const remote = this.envelope(await response.json());
        this.baseSnapshot = remote.snapshot ?? submitted;
        const changedDuringWrite = this.generation !== submittedGeneration;
        this.emit({ phase: changedDuringWrite ? 'pending' : 'saved', revision: remote.revision, snapshot: changedDuringWrite ? this.state.snapshot : (remote.snapshot ?? submitted), dirty: changedDuringWrite });
        this.cache();
      } catch (error) {
        if (!this.disposed) { this.emit({ ...this.state, phase: error instanceof AuthError ? 'signed-out' : 'offline', message: error instanceof AuthError ? 'Het ouderaccount is gewijzigd. Log opnieuw in om verder te gaan.' : 'Geen verbinding. Veranderingen blijven op dit apparaat bewaard.' }); this.cache(); }
        return;
      }
    }
  }
  /** Check a changed session without applying data while an edit or story dialog is open. */
  async verifyIdentity(): Promise<void> {
    if (this.disposed || this.state.phase === 'signed-out') return;
    try { await this.getCloud(); }
    catch (error) { if (!this.disposed && error instanceof AuthError) this.emit({ ...this.state, phase: 'signed-out', message: 'Het ouderaccount is gewijzigd. Log opnieuw in om verder te gaan.' }); }
  }
  async refresh(): Promise<void> {
    if (this.disposed || this.refreshing || this.state.phase === 'conflict' || this.state.phase === 'signed-out') return;
    if (this.state.dirty) { await this.flush(); return; }
    this.refreshing = true;
    const generation = this.generation;
    try {
      const remote = await this.getCloud();
      if (this.disposed || this.state.dirty || this.generation !== generation) return;
      const changed = !sameContent(remote.snapshot, this.state.snapshot);
      if (changed && !this.canApplyRemote()) return;
      this.baseSnapshot = remote.snapshot;
      this.emit({ phase: remote.snapshot ? 'saved' : 'empty', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
      this.cache(); if (changed) this.onRemote(remote.snapshot);
    } catch (error) {
      if (!this.disposed) this.emit({ ...this.state, phase: error instanceof AuthError ? 'signed-out' : 'offline', message: error instanceof AuthError ? 'Log opnieuw in om te synchroniseren.' : 'Geen verbinding. Jullie verhalen blijven beschikbaar op dit apparaat.' });
    } finally { this.refreshing = false; }
  }
  chooseRemote(): void {
    if (!this.state.remote) return;
    const remote = this.state.remote;
    this.backup(remote); this.generation += 1; this.baseSnapshot = remote.snapshot;
    this.emit({ phase: remote.snapshot ? 'saved' : 'empty', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
    this.cache(); this.onRemote(remote.snapshot);
  }
  async chooseLocal(): Promise<void> {
    if (!this.state.remote || !this.state.snapshot) return;
    const chosen = this.baseSnapshot ? preferLocalChangedChildren(this.baseSnapshot, this.state.snapshot, this.state.remote.snapshot) : this.state.snapshot;
    this.backup(this.state.remote); this.generation += 1; this.baseSnapshot = this.state.remote.snapshot;
    this.emit({ phase: 'pending', revision: this.state.remote.revision, snapshot: chosen, dirty: true });
    this.cache(); this.onMerged(chosen); await this.flush();
  }
  dispose() { this.disposed = true; clearTimeout(this.timer); this.listeners.clear(); }
}
/** Merge separate siblings only; story choices, memory and endings stay one coherent unit. */
export function mergeDisjointChildren(base: FamilySnapshot, local: FamilySnapshot, remote: FamilySnapshot | null): FamilySnapshot | null {
  if (!remote || !isFamilySnapshot(base) || !isFamilySnapshot(local) || !isFamilySnapshot(remote)) return null;
  const metadata = (value: FamilySnapshot) => ({ schemaVersion: value.schemaVersion, family: { ...value.family, activeId: '' } });
  if (!equal(metadata(base), metadata(local)) || !equal(metadata(base), metadata(remote))) return null;
  const ids = base.family.children.map(child => child.id);
  const localChanges = ids.filter(id => !equal(base.data[id] ?? {}, local.data[id] ?? {}));
  const remoteChanges = new Set(ids.filter(id => !equal(base.data[id] ?? {}, remote.data[id] ?? {})));
  if (localChanges.some(id => remoteChanges.has(id))) return null;
  const merged = copy(remote);
  for (const id of localChanges) merged.data[id] = copy(local.data[id] ?? {});
  merged.family.activeId = merged.family.children[0].id;
  return merged;
}
function preferLocalChangedChildren(base: FamilySnapshot, local: FamilySnapshot, remote: FamilySnapshot | null): FamilySnapshot {
  if (!remote) return local;
  const metadata = (value: FamilySnapshot) => ({ schemaVersion: value.schemaVersion, family: { ...value.family, activeId: '' } });
  if (!equal(metadata(base), metadata(local)) || !equal(metadata(base), metadata(remote))) return local;
  const chosen = copy(remote);
  for (const child of base.family.children) if (!equal(base.data[child.id] ?? {}, local.data[child.id] ?? {})) chosen.data[child.id] = copy(local.data[child.id] ?? {});
  chosen.family.activeId = chosen.family.children[0].id;
  return chosen;
}
class AuthError extends Error {}
