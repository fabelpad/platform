import { initialStationPlayState, reduceStationPlay, stationInstruction } from '../../src/storyPlayLogic';
import type { StationPlayAction, StationPlayState } from '../../src/storyPlayLogic';
export { stationInstruction };
export type { StationPlayAction, StationPlayState };

type Scheduler = { schedule: (callback: () => void, delay: number) => unknown; cancel: (handle: unknown) => void };
const scheduler: Scheduler = { schedule: (callback, delay) => setTimeout(callback, delay), cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };

/** Owns one mounted scene. Closing/backgrounding invalidates every pending callback. */
export function createStationInteraction(step: 0 | 1, onState: (state: StationPlayState) => void, onChoose: (choice: 0 | 1) => void, delay = 900, clock: Scheduler = scheduler) {
  let state = initialStationPlayState(step), active = true, committed = false, generation = 0;
  let timer: unknown;
  const invalidate = () => { generation += 1; if (timer !== undefined) clock.cancel(timer); timer = undefined; };
  return {
    getState: () => state,
    apply(action: StationPlayAction) {
      if (!active || committed) return;
      const next = reduceStationPlay(state, action);
      if (next === state) return;
      state = next; onState(state);
      if (state.phase === 'leaving' && state.choice !== null) {
        const token = generation, choice = state.choice;
        timer = clock.schedule(() => {
          if (!active || committed || generation !== token) return;
          committed = true; timer = undefined; onChoose(choice);
        }, delay);
      }
    },
    suspend() { active = false; invalidate(); state = initialStationPlayState(step); onState(state); },
    resume() { if (!committed) active = true; },
    dispose() { active = false; invalidate(); },
  };
}
