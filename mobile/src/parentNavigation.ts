import { parentSessionIsActive } from './parentAccess';

export type NativeScreen = 'library' | 'connected-library' | 'reader' | 'profiles' | 'parent' | 'parent-gate' | 'profile-settings' | 'treasures';
export const nativeTabs: Array<{ id: NativeScreen; label: string; symbol: string }> = [
  { id: 'library', label: 'Ontdek', symbol: '⌂' },
  { id: 'treasures', label: 'Schatkist', symbol: '☆' },
  { id: 'profiles', label: 'Wie speelt?', symbol: '☺' },
  { id: 'parent', label: 'Ouders', symbol: '⚙' },
];

export function isParentScreen(screen: NativeScreen): boolean {
  return screen === 'parent' || screen === 'parent-gate' || screen === 'profile-settings';
}

export function needsParentGate(screen: NativeScreen, expiresAt: number, now = Date.now()): boolean {
  return isParentScreen(screen) && (screen === 'parent-gate' || !parentSessionIsActive(expiresAt, now));
}

export function selectedNativeTab(screen: NativeScreen): NativeScreen {
  if (isParentScreen(screen)) return 'parent';
  if (screen === 'reader' || screen === 'connected-library') return 'library';
  return screen;
}

/** Android closes a temporary surface before leaving its underlying destination. */
export function nativeBackAction(screen: NativeScreen, menuOpen: boolean): 'close-menu' | NativeScreen | null {
  if (menuOpen) return 'close-menu';
  if (screen === 'profile-settings') return 'parent';
  return screen === 'library' ? null : 'library';
}
