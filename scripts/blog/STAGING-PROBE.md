This owner-operated check only targets `https://staging.fabelpad.nl` and Supabase
project `tlwfpivafcokcjyjwgmq`. It exercises the receiving website with an explicitly
synthetic credential; it does not prove the external SocialHero claim/verify peer.
The optional reconnect fixture likewise isolates local destination policy.

Deploy the tested migration, Edge runtime and staging web first, then run the
separate phases in `bootstrap-staging.sql`. Do not seed if a real connection is
present. The fixture refuses any selected connection or active provisioning.

1. Save only the staging **publishable** key to a local mode-600 file. No
   service-role/secret key is accepted. Initialize once:

   ```sh
   node scripts/blog/staging-probe.mjs init --state .next/blog-staging-acceptance/state.json --publishable-key-file /absolute/path/to/staging-publishable-key.txt > .next/blog-staging-fixture-setup.sql
   ```

   Tokens stay in `state.json` with mode 600. Standard output is only owner SQL
   containing SHA256 hashes. Four mode-600 SQL artifacts are written beside the
   state: `fixture-setup.sql`, `policy-off.sql`, `fixture-reconnect.sql` and
   `fixture-cleanup.sql`. None contains the opaque tokens or publishable key.

2. Review and execute `fixture-setup.sql` through the connected staging owner SQL
   tool. It creates a labelled synthetic `example.invalid` Auth identity, session,
   admin, destination and active credential. It sends no email and creates no
   real guardian acceptance. Existing account/family/content rows remain intact.

3. Run the first probe:

   ```sh
   node scripts/blog/staging-probe.mjs run --state .next/blog-staging-acceptance/state.json
   ```

   It checks capabilities, decoded private PNG upload, Markdown draft PUT/GET,
   replay/conflict, publication, exact HTML proof, H1, SEO, structured data,
   production canonical, staging noindex, public media checksum, unchanged live
   bytes/dates after a later draft, and a direct historical URL 308. A publish
   request may return 202/publishing or immediate 200/published; both require the
   exact public version/proof and verified status before passing. Recovery polls
   for up to 45 attempts with 3-second pauses.

4. At `await-policy-withdrawal`, review and execute `policy-off.sql` as staging
   owner. Optionally execute `fixture-reconnect.sql` afterwards to test preserved
   opt-out and rejection of the superseded credential. **Only then** repeat the
   same `run` command. The probe requires publish=403 while draft PUT succeeds,
   and revokes both synthetic credentials before requiring subsequent 401.

5. `safe-results.json` contains only aggregate check results and synthetic run ID.
   The synthetic article/media can remain on staging under noindex for evidence.
   Review and run `fixture-cleanup.sql` to remove the synthetic Auth identity and
   clear only this fixture's selected pointers. It preserves unrelated connections
   and the synthetic article's immutable bytes, redacting its actor link.

Every failure attempts immediate HTTP revocation. To stop between phases:

```sh
node scripts/blog/staging-probe.mjs revoke --state .next/blog-staging-acceptance/state.json
```

If the web route is unavailable, use the reviewed owner `fixture-cleanup.sql`
fallback. Do not print or attach `state.json`, request headers or raw tokens.
Delete the local state/key file after revocation and after retaining the safe
results and token-free SQL evidence.
