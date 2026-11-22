// Bundle/deploy this entry point with the canonical lib/email modules. No
// duplicate template source lives in the Edge Function.
import { createAuthEmailHandler } from '../../../lib/email/auth-hook.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const names = ['RESEND_API_KEY', 'SEND_EMAIL_HOOK_SECRET', 'FABELPAD_EMAIL_FROM', 'FABELPAD_EMAIL_REPLY_TO', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT'];
Deno.serve(createAuthEmailHandler(Object.fromEntries(names.map(name => [name, Deno.env.get(name)]))));
