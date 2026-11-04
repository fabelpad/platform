export type StoryChoice = { label: string; hint: string; icon: 'heart' | 'sparkles' | 'music' | 'moon' | 'leaf' | 'compass' };
export type StoryScene = { title: string; text: string; choices: StoryChoice[] };
export type StoryEnding = { title: string; text: string; keepsake: string };
export type FictionalEncounter = { id: string; name: string; fact: string };
export type WrittenStory = {
  scenes: (picks: number[], hero: string) => StoryScene[];
  ending: (picks: number[], hero: string) => StoryEnding;
  encounters: (picks: number[]) => FictionalEncounter[];
  threadLabel: string;
};
