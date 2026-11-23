import type { FamilySnapshot } from './profileStorage';
import { clearParentDeviceData, isFamilySnapshot } from './profileStorage';

export type ParentIdentity = { id: string; email: string; displayName: string };
export type CloudEnvelope = { parent: ParentIdentity; revision: number; snapshot: FamilySnapshot | null };
export type SyncPhase = 'loading' | 'empty' | 'saved' | 'pending' | 'saving' | 'offline' | 'conflict' | 'signed-out' | 'error';
export type SyncState = { phase: SyncPhase; revision: number; snapshot: FamilySnapshot | null; dirty: boolean; remote?: { revision: number; snapshot: FamilySnapshot | null }; message?: string; localDurable?: boolean; consentReloadRequired?: string };
type Draft = { owner: string; revision: number; snapshot: FamilySnapshot; dirty: boolean; baseSnapshot?: FamilySnapshot | null };
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
// JSON objects are unordered, including snapshots returned by PostgreSQL JSONB.
// Array order still matters for profiles, story choices and remembered events.
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => equal(item, b[index]));
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}
const sameContent = (a: FamilySnapshot | null, b: FamilySnapshot | null) => a && b ? equal({ ...a, family: { ...a.family, activeId: '' } }, { ...b, family: { ...b.family, activeId: '' } }) : a === b;

export class FamilySyncClient {
  private state: SyncState = { phase: 'loading', revision: 0, snapshot: null, dirty: false };
  private listeners = new Set<(state: SyncState) => void>();
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writing: Promise<void> | null = null;
  private refreshing = false;
  private disposed = false;
  private revoked = false;
  private consentReload: string | null = null;
  private consentEpoch = 0;
  private withdrawalReload: Promise<void> | null = null;
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
    if (this.revoked) return;
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
  private adoptRemoteRemoval(remote: { revision: number; snapshot: FamilySnapshot | null }, known: FamilySnapshot | null | undefined = this.baseSnapshot): boolean {
    if (!known || !remote.snapshot) return false;
    const retained = new Set(remote.snapshot.family.children.map(child => child.id));
    if (!known.family.children.some(child => !retained.has(child.id))) return false;
    clearTimeout(this.timer); this.generation += 1;
    clearParentDeviceData(this.owner);
    try { this.store.setItem(this.cacheKey, 'null'); this.store.setItem(`${this.cacheKey}-recovery`, 'null'); } catch { /* Replaced memory does not retain the withdrawn child. */ }
    this.baseSnapshot = remote.snapshot;
    this.emit({ phase: remote.snapshot.family.children.length ? 'saved' : 'empty', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
    this.cache(); this.onRemote(remote.snapshot);
    return true;
  }
  private async checkBlocked(response: Response): Promise<void> {
    if (![403, 410, 423].includes(response.status)) return;
    const result = await response.clone().json().catch(() => null);
    if (!['account_inactive', 'account_blocked', 'profile_consent_required', 'profile_consent_revoked', 'profile_withdrawn', 'account_deleted'].includes(result?.error)) return;
    this.revoked = true; clearTimeout(this.timer); this.generation += 1; this.baseSnapshot = null;
    clearParentDeviceData(this.owner);
    try { this.store.setItem(this.cacheKey, 'null'); this.store.setItem(`${this.cacheKey}-recovery`, 'null'); } catch { /* Keep the revoked data out of memory even when storage is blocked. */ }
    this.emit({ phase: 'signed-out', revision: 0, snapshot: null, dirty: false, message: 'De toegang tot deze gezinsgegevens is ingetrokken. De apparaatkopie is gewist. Bekijk je accountoverzicht.' });
    throw new AccountBlockedError();
  }
  private async getCloud(): Promise<CloudEnvelope> {
    if (this.revoked) throw new AccountBlockedError();
    const response = await this.fetcher('/api/family', { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'X-Fabelpad-Parent': this.owner } });
    await this.checkBlocked(response);
    if (response.status === 401 || response.status === 403 || response.redirected || response.headers.get('Content-Type')?.includes('text/html')) throw new AuthError();
    if (!response.ok) throw new Error('De opgeslagen avonturen zijn nu niet bereikbaar.');
    return this.envelope(await response.json());
  }
  async load(): Promise<void> {
    if (this.consentReload) { await this.reloadAfterConsentWithdrawal(this.consentReload); return; }
    const consentEpoch = this.consentEpoch;
    const cached = this.draft();
    this.emit({ ...this.state, phase: 'loading' });
    try {
      const remote = await this.getCloud();
      if (this.disposed || this.revoked || this.consentReload || consentEpoch !== this.consentEpoch) return;
      if (this.adoptRemoteRemoval(remote, cached?.baseSnapshot ?? (cached?.dirty ? null : cached?.snapshot))) return;
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
      if (this.disposed || this.consentReload || consentEpoch !== this.consentEpoch) return;
      if (error instanceof AccountBlockedError) return;
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
    if (this.disposed || this.revoked || this.consentReload || !isFamilySnapshot(snapshot) || sameContent(snapshot, this.state.snapshot)) return;
    this.generation += 1;
    this.emit({ ...this.state, snapshot: copy(snapshot), dirty: true, phase: this.state.phase === 'conflict' ? 'conflict' : this.state.phase === 'signed-out' ? 'signed-out' : 'pending', message: undefined });
    this.cache();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, this.debounceMs);
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.writing) return this.writing;
    if (this.disposed || this.consentReload || !this.state.dirty || !this.state.snapshot || this.state.phase === 'conflict' || this.state.phase === 'signed-out') return;
    this.writing = this.runWrites();
    try { await this.writing; } finally { this.writing = null; }
  }
  private async runWrites() {
    let mergeRetries = 0;
    while (!this.disposed && !this.consentReload && this.state.dirty && this.state.snapshot && this.state.phase !== 'conflict' && this.state.phase !== 'signed-out') {
      const consentEpoch = this.consentEpoch;
      const submittedGeneration = this.generation;
      const submitted = copy(this.state.snapshot);
      const baseRevision = this.state.revision;
      this.emit({ ...this.state, phase: 'saving', message: undefined });
      try {
        const response = await this.fetcher('/api/family', { method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Fabelpad-Parent': this.owner }, body: JSON.stringify({ baseRevision, snapshot: submitted }) });
        if (this.disposed || this.revoked || this.consentReload || consentEpoch !== this.consentEpoch) return;
        await this.checkBlocked(response);
        if (response.status === 401 || response.status === 403 || response.redirected || response.headers.get('Content-Type')?.includes('text/html')) { this.emit({ ...this.state, phase: 'signed-out', message: 'Log opnieuw in. Je veranderingen blijven op dit apparaat bewaard.' }); this.cache(); return; }
        if (response.status === 409) {
          const value = await response.json() as { revision?: number; snapshot?: unknown };
          if (this.disposed || this.consentReload || consentEpoch !== this.consentEpoch) return;
          if (!Number.isSafeInteger(value.revision) || (value.revision ?? -1) < 0 || (value.snapshot !== null && !isFamilySnapshot(value.snapshot))) throw new Error('Ongeldig versieantwoord.');
          const remote = { revision: value.revision!, snapshot: value.snapshot as FamilySnapshot | null };
          if (this.adoptRemoteRemoval(remote)) return;
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
        if (this.disposed || this.consentReload || consentEpoch !== this.consentEpoch) return;
        this.baseSnapshot = remote.snapshot ?? submitted;
        const changedDuringWrite = this.generation !== submittedGeneration;
        this.emit({ phase: changedDuringWrite ? 'pending' : 'saved', revision: remote.revision, snapshot: changedDuringWrite ? this.state.snapshot : (remote.snapshot ?? submitted), dirty: changedDuringWrite });
        this.cache();
      } catch (error) {
        if (error instanceof AccountBlockedError) return;
        if (!this.disposed && !this.consentReload && consentEpoch === this.consentEpoch) { this.emit({ ...this.state, phase: error instanceof AuthError ? 'signed-out' : 'offline', message: error instanceof AuthError ? 'Het ouderaccount is gewijzigd. Log opnieuw in om verder te gaan.' : 'Geen verbinding. Veranderingen blijven op dit apparaat bewaard.' }); this.cache(); }
        return;
      }
    }
  }
  /** Check a changed session without applying data while an edit or story dialog is open. */
  async verifyIdentity(): Promise<void> {
    if (this.consentReload) { await this.reloadAfterConsentWithdrawal(this.consentReload).catch(() => {}); return; }
    if (this.disposed || this.state.phase === 'signed-out') return;
    const consentEpoch = this.consentEpoch;
    try { const remote = await this.getCloud(); if (!this.disposed && !this.consentReload && consentEpoch === this.consentEpoch) this.adoptRemoteRemoval(remote); }
    catch (error) { if (!this.disposed && !this.consentReload && consentEpoch === this.consentEpoch && error instanceof AuthError) this.emit({ ...this.state, phase: 'signed-out', message: 'Het ouderaccount is gewijzigd. Log opnieuw in om verder te gaan.' }); }
  }
  async refresh(): Promise<void> {
    if (this.consentReload) { await this.reloadAfterConsentWithdrawal(this.consentReload).catch(() => {}); return; }
    if (this.disposed || this.refreshing || this.state.phase === 'conflict' || this.state.phase === 'signed-out') return;
    if (this.state.dirty) { await this.flush(); return; }
    this.refreshing = true;
    const generation = this.generation;
    const consentEpoch = this.consentEpoch;
    try {
      const remote = await this.getCloud();
      if (this.consentReload || consentEpoch !== this.consentEpoch) return;
      if (!this.disposed && this.adoptRemoteRemoval(remote)) return;
      if (this.disposed || this.state.dirty || this.generation !== generation) return;
      const changed = !sameContent(remote.snapshot, this.state.snapshot);
      if (changed && !this.canApplyRemote()) return;
      this.baseSnapshot = remote.snapshot;
      this.emit({ phase: remote.snapshot ? 'saved' : 'empty', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
      this.cache(); if (changed) this.onRemote(remote.snapshot);
    } catch (error) {
      if (error instanceof AccountBlockedError) return;
      if (!this.disposed && !this.consentReload && consentEpoch === this.consentEpoch) this.emit({ ...this.state, phase: error instanceof AuthError ? 'signed-out' : 'offline', message: error instanceof AuthError ? 'Log opnieuw in om te synchroniseren.' : 'Geen verbinding. Jullie verhalen blijven beschikbaar op dit apparaat.' });
    } finally { this.refreshing = false; }
  }
  /** Only after a confirmed server withdrawal: stop writes and discard that
   * profile, then adopt the authenticated server snapshot without a draft flush. */
  async reloadAfterConsentWithdrawal(profileId: string): Promise<void> {
    if (this.withdrawalReload) return this.withdrawalReload;
    if (this.disposed || this.revoked) throw new Error('De gezinsverbinding is gesloten. Open je gezin opnieuw.');
    const run = async () => {
      this.consentReload = profileId; this.consentEpoch += 1; this.generation += 1; clearTimeout(this.timer);
      const remove = (snapshot: FamilySnapshot | null | undefined): FamilySnapshot | null => {
        if (!snapshot) return null;
        const children = snapshot.family.children.filter(child => child.id !== profileId);
        return { ...snapshot, family: { ...snapshot.family, children, activeId: children.some(child => child.id === snapshot.family.activeId) ? snapshot.family.activeId : children[0]?.id ?? '' }, data: Object.fromEntries(Object.entries(snapshot.data).filter(([id]) => id !== profileId)) };
      };
      const retained = remove(this.state.snapshot);
      this.baseSnapshot = remove(this.baseSnapshot);
      const retainedChanges = this.state.dirty && !sameContent(retained, this.baseSnapshot ?? null);
      this.emit({ ...this.state, snapshot: retained, remote: undefined, dirty: retainedChanges, phase: 'loading', consentReloadRequired: profileId, message: 'De toestemming is ingetrokken. De bevestigde gezinsgegevens ophalen…' });
      if (retained?.family.children.length) this.onMerged(retained);
      else if (retained) clearParentDeviceData(this.owner);
      this.cache();
      try { this.store.setItem(`${this.cacheKey}-recovery`, 'null'); } catch { /* The active draft is sanitized as well. */ }
      try {
        const remote = await this.getCloud();
        if (this.disposed || this.revoked) return;
        if (remote.snapshot?.family.children.some(child => child.id === profileId)) throw new Error('Het ingetrokken profiel staat nog in het antwoord.');
        this.consentReload = null;
        if (retainedChanges && retained && !sameContent(retained, remote.snapshot)) {
          const merged = this.baseSnapshot && mergeDisjointChildren(this.baseSnapshot, retained, remote.snapshot);
          if (merged) {
            this.baseSnapshot = remote.snapshot;
            this.emit({ phase: 'pending', revision: remote.revision, snapshot: merged, dirty: true });
            this.cache(); this.onRemote(merged); void (this.writing ?? Promise.resolve()).then(() => this.flush()); return;
          }
          this.emit({ phase: 'conflict', revision: this.state.revision, snapshot: retained, dirty: true, remote });
          this.cache(); this.backup(remote); this.onRemote(retained); return;
        }
        this.baseSnapshot = remote.snapshot;
        this.emit({ phase: remote.snapshot?.family.children.length ? 'saved' : 'empty', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
        this.cache(); this.onRemote(remote.snapshot);
      } catch (error) {
        if (!this.disposed && !this.revoked) { this.emit({ ...this.state, phase: error instanceof AuthError ? 'signed-out' : 'error', consentReloadRequired: profileId, message: 'De toestemming is ingetrokken. Ophalen lukt nu niet; synchronisatie blijft gepauzeerd. Probeer opnieuw.' }); this.cache(); }
        throw error;
      }
    };
    this.withdrawalReload = run();
    try { await this.withdrawalReload; } finally { this.withdrawalReload = null; }
  }
  chooseRemote(): void {
    if (this.consentReload) return;
    if (!this.state.remote) return;
    const remote = this.state.remote;
    this.backup(remote); this.generation += 1; this.baseSnapshot = remote.snapshot;
    this.emit({ phase: remote.snapshot ? 'saved' : 'empty', revision: remote.revision, snapshot: remote.snapshot, dirty: false });
    this.cache(); this.onRemote(remote.snapshot);
  }
  async chooseLocal(): Promise<void> {
    if (this.consentReload) return;
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
class AccountBlockedError extends Error {}
