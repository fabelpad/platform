/** Authentication may return to an app page, never to an external or API URL. */
export function safeNext(value: unknown, fallback = '/gezin'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/u.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://fabelpad.invalid');
    return url.origin === 'https://fabelpad.invalid' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/auth/') ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch { return fallback; }
}
