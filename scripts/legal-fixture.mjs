/** Read the versions actually installed at this point in a migration fixture.
 * Call as fixture owner; historical upgrade assertions keep their fixed bytes.
 */
export async function currentLegalVersions(db) {
  const row = (await db.query("select max(version) filter(where kind='terms') terms,max(version) filter(where kind='privacy') privacy from private.legal_document_versions")).rows[0];
  if (!row.terms || !row.privacy) throw new Error('Installed legal document versions are missing.');
  return row;
}
