/** Personalize presentation only; immutable release bytes and route IDs stay intact. */
export function personalizeStoryText(text: string, profileName: string): string {
  const name = profileName.trim() || 'Avonturier';
  // One pass never re-interprets inserted names, including '$&' or 'Avonturier Jr'.
  return text.replace(/__FABELPAD_CHILD__|\{\{naam\}\}|(^|[^\p{L}\p{N}_])Avonturier(?=$|[^\p{L}\p{N}_])/gu,
    (_match, before: string | undefined) => `${before ?? ''}${name}`);
}
