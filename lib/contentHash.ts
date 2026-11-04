/** Stable release bytes shared by browser, Node and PostgreSQL. */
export function canonicalContentJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalContentJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalContentJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError('Content releases contain only JSON values.');
  return encoded;
}
