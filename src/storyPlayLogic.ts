export type PlayChoice = 0 | 1;
export type StationPlayState = {
  step: 0 | 1;
  phase: 'choosing' | 'ticket' | 'repaired' | 'cabinet' | 'map' | 'leaving';
  choice: PlayChoice | null;
};
export type StationPlayAction =
  | { type: 'choose'; choice: PlayChoice }
  | { type: 'repair' }
  | { type: 'unlock' }
  | { type: 'depart' };

export function initialStationPlayState(step: 0 | 1): StationPlayState {
  return { step, phase: 'choosing', choice: null };
}

/** The visual task finishes before the existing story choice may be committed. */
export function reduceStationPlay(state: StationPlayState, action: StationPlayAction): StationPlayState {
  if (state.phase === 'leaving') return state;
  if (action.type === 'choose' && state.phase === 'choosing') {
    return { ...state, choice: action.choice, phase: state.step === 1 ? 'leaving' : action.choice === 0 ? 'ticket' : 'cabinet' };
  }
  if (action.type === 'repair' && state.phase === 'ticket') return { ...state, phase: 'repaired' };
  if (action.type === 'unlock' && state.phase === 'cabinet') return { ...state, phase: 'map' };
  if (action.type === 'depart' && (state.phase === 'repaired' || state.phase === 'map')) return { ...state, phase: 'leaving' };
  return state;
}

export function stationInstruction(state: StationPlayState): string {
  if (state.phase === 'ticket') return 'Plak de gouden sterrensticker op Dibbels gescheurde kaartje.';
  if (state.phase === 'repaired') return 'Hoera! Dibbels kaartje is heel. Jullie kunnen samen instappen.';
  if (state.phase === 'cabinet') return 'Draai de gouden sleutel en ontdek wat er in het kastje zit.';
  if (state.phase === 'map') return 'Een kaart met bewegende sporen! Neem hem mee aan boord.';
  if (state.phase === 'leaving') return state.step === 0 ? 'Instappen maar! De trein vertrekt.' : state.choice === 0 ? 'De wissel staat goed. Op naar het muziekbos!' : 'De wissel staat goed. Volg de lichtjes!';
  return state.step === 0 ? 'Tik op Dibbel of ontdek de gouden sleutel. Wat kies jij?' : 'Bedien de wissel. Rijd je naar de muziek of naar de lantaarns?';
}
