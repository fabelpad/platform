import type { FamilySnapshot } from '../../lib/familyValidation';
import { cloneConnectedFamily } from './connected-contract';

export type ConnectedProgressDraft = { schemaVersion: 1; parentId: string; environment: string; baseRevision: number; baseSnapshot: FamilySnapshot; snapshot: FamilySnapshot; updatedAt: number };
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Three-way merge only the reading routes changed offline. The latest cloud
 * profile settings remain authoritative; removed children are never recreated.
 */
export function mergeConnectedProgress(draft: ConnectedProgressDraft, remote: FamilySnapshot, forceLocal = false): { snapshot: FamilySnapshot; conflicts: string[] } {
  const next = cloneConnectedFamily(remote), conflicts: string[] = [];
  for (const [childId, values] of Object.entries(draft.snapshot.data)) {
    for (const [field, local] of Object.entries(values)) {
      if (!field.startsWith('story-')) continue;
      const base = draft.baseSnapshot.data[childId]?.[field], cloud = remote.data[childId]?.[field];
      if (equal(local, base)) continue;
      if (!remote.family.children.some(child => child.id === childId)) { conflicts.push(`${childId}:${field}:removed`); continue; }
      if (!forceLocal && !equal(cloud, base) && !equal(cloud, local)) { conflicts.push(`${childId}:${field}`); continue; }
      next.data[childId] ||= {}; next.data[childId][field] = JSON.parse(JSON.stringify(local)) as typeof local;
    }
  }
  return { snapshot: next, conflicts };
}
