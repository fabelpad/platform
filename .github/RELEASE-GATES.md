# Releasepad nog te configureren

De huidige opdracht autoriseert een lokale build. `workflows/verify.yml` bewijst alleen installatie, controles en bundels op de uitgecheckte commit. Er is bewust nog geen muterende staging-/productieworkflow.

Voeg het echte releasepad pas toe als de onderstaande gegevens en contracten beschikbaar en gecontroleerd zijn:

- GitHub-repository en environments `staging` en `production`, runnernaam, exacte labels, Linux-gebruiker, workspace en hostbeleid voor lock/retentie.
- Site-ID, HTTPS-origin, deployhost, projectpaden, loopbackpoort en Caddy-configuratie per omgeving.
- Geïnstalleerde `dg-site-deploy`-versie, ondersteunde configuratieallowlists, native Next.js-startcontract, activatie-, health- en rollbackinterface. Het wrappervoorbeeld uit een ander project is geen Fabelpad-contract.
- Geslaagde vereiste CI op de volledige release-SHA; checkout-SHA, workflow-SHA en runtime-SHA afzonderlijk bewijzen.
- `node scripts/config-check.mjs --target=staging` respectievelijk `--target=production` met de omgevingsconfiguratie; log uitsluitend namen/aanwezigheid. De configuratiecheck voert geen deployment uit.
- Versleutelde databasebackup plus herstelbewijs, migratiehistorie en achterwaartse compatibiliteit vóór schema-/Edge-wijzigingen.
- Gecontroleerde Supabase Auth/Google/mailgateway/outbox-inrichting en werkelijke flowacceptatie, inclusief twee verschillende ouderaccounts en beheerdersrechten.
- Stagingacceptatie van dezelfde bron-SHA vóór een later geautoriseerde productiestap. Beide omgevingen bouwen afzonderlijk met hun eigen `NEXT_PUBLIC_`-waarden.

De workflow mag de wrapper pas met diens geverifieerde interface aanroepen. Geen hosts, labels, argumenten, backupscripts of rollbackcommando's raden. Zie `docs/RUNBOOK.md` en `docs/INRICHTING.md`.
