export type Choice = { label: string; hint: string; icon: string };
export type Scene = { title: string; text: string; choices: Choice[] };
export type Ending = { title: string; text: string; keepsake: string };
export type Story = { id: string; title: string; description: string; image: string; imageAlt: string; tag: string; stamp: string; scenes: Record<string, Scene>; endings: Record<string, Ending> };
export type Profile = { id: string; name: string; avatar: number; picks: Record<string, number[]>; favorites: string[]; calm: boolean; largeText: boolean };
export type Store = { schemaVersion: 1; contentVersion: string; activeId: string; profiles: Profile[] };
