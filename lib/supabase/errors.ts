/** Only a definitive Auth response that the identity no longer exists uses
 * this signal. Network failures and expired sessions never imply deletion. */
export class AccountDeletedError extends Error {
  constructor(readonly cleanupParentId?: string) { super('Het ouderaccount is verwijderd. De gekoppelde gegevens op dit apparaat worden gewist.'); }
}
