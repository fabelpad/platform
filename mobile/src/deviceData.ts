import { disconnectFamily } from './connected';
import { removeStore } from './storage';
import { clearAllNarration } from './narrationCleanup';

/** Run the same complete logout cleanup before removing bundled-story data.
 * The local variant never opens an account or a Play connection here.
 */
export async function clearDeviceData(connected: boolean): Promise<void> {
  if (connected) await disconnectFamily();
  await clearAllNarration();
  await removeStore();
}
