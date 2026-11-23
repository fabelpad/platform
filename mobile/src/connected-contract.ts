import type { Store } from './types';
import type { FamilySnapshot } from '../../lib/familyValidation';

export class ConnectedError extends Error { constructor(readonly code: string, message: string, readonly status = 0) { super(message); } }

// Family snapshots contain validated JSON only. This also works on Hermes
// versions that do not expose the browser structuredClone global.
export function cloneConnectedFamily(snapshot: FamilySnapshot): FamilySnapshot { return JSON.parse(JSON.stringify(snapshot)) as FamilySnapshot; }

export function nativeFamilyImport(store: Store, existing: FamilySnapshot | null, selectedIds: string[]): FamilySnapshot {
  const selected = store.profiles.filter(profile => selectedIds.includes(profile.id));
  if (!selected.length || selected.some(profile => !profile.birthDate)) throw new ConnectedError('birth_date_required', 'Voeg voor ieder gekozen kindprofiel eerst de geboortedatum toe.');
  const previous = existing ?? { schemaVersion: 1 as const, family: { version: 1 as const, children: [], activeId: '' }, data: {} };
  if (selected.some(profile => previous.family.children.some(child => child.id === profile.id))) throw new ConnectedError('already_imported', 'Een van deze profielen is al gekoppeld. Bestaande gezinsprofielen worden niet overschreven.');
  if (previous.family.children.length + selected.length > 5) throw new ConnectedError('profile_limit', 'Een gezin kan maximaal vijf kinderprofielen hebben.');
  const next = cloneConnectedFamily(previous);
  for (const profile of selected) {
    next.family.children.push({ id: profile.id, name: profile.name, avatar: profile.avatar, birthDate: profile.birthDate, ...(profile.readingLevelOverride ? { readingLevelOverride: profile.readingLevelOverride } : {}) });
    next.data[profile.id] = { favorites: profile.favorites, started: Object.keys(profile.picks), prefs: { muted: false, calm: profile.calm, textSize: profile.largeText ? 'large' : 'normal', readingLevel: profile.readingLevel ?? '6to8' } };
    for (const [id, picks] of Object.entries(profile.picks)) next.data[profile.id][`story-${id}`] = { picks, updatedAt: Date.now(), storyId: id, contentVersion: profile.storyVersions?.[id] ?? store.contentVersion,
      ...(profile.lastCompletedPicks?.[id] ? { lastCompletedPicks: profile.lastCompletedPicks[id], lastCompletedContentVersion: profile.lastCompletedStoryVersions?.[id] ?? store.contentVersion } : {}) };
  }
  next.family.activeId ||= selected[0].id; return next;
}
