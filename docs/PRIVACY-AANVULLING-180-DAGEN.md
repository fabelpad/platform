# Fabelpad — bevestigde privacygegevens en tekstaanvulling

Datum: 22 november 2026. Bron: de eigenaar bevestigt in deze projectchat de onderstaande feiten. Dit is het wijzigings- en bronoverzicht voor de nieuwe privacyversie `2026-11-22.1`. De versie is in de applicatiebron en als download voorbereid; dit document bewijst geen uitrol of publieke publicatie. De bestaande download en databaseversie `2026-11-22` worden niet overschreven.

## Bevestigde gegevens

| Onderdeel | Bevestiging van de eigenaar | Grens van dit bewijs |
| --- | --- | --- |
| Maximale bewaartermijn van back-ups | **180 dagen** | Geldt voor herstelkopieën; geen algemene bewaartermijn voor actieve accounts, supportmail of providerlogboeken. Dit is een eigenaarbevestiging, geen uitgevoerde provider-/hersteltest. |
| Leverancier supportmail | **Stackmail** | Mailboxprovider bevestigd; de termijn voor gewone correspondentie en de feitelijke opschoning zijn afzonderlijke onderdelen. |
| Verwerkers- en doorgifteafspraken | **Bevestigd** | Vastleggen als verklaring van de eigenaar. Er zijn geen contractkopieën in de repository opgeslagen en deze bevestiging bewijst geen technische uitvoering of uitsluitend Europese verwerking. |
| Gewone supportcorrespondentie | **Maximaal 12 maanden na afsluiting** | Bevestigd beleid voor berichten; feitelijke mailbox-/archiefopschoning blijft te controleren. Back-ups houden hun eigen grens van 180 dagen. |
| Supabase Auth-templates | **Overgenomen** | Door de eigenaar uitgevoerd; volledige OTP-/Google-aanmelding en inboxbezorging zijn daarmee nog niet getest. De Custom SMTP-route blijft behouden. |

## Verwerkt in de nieuwe privacyversie

Toevoeging bij ontvangers en ondersteuning:

> Supportmail aan support@fabelpad.nl wordt verwerkt via Stackmail. DG Webservices gebruikt deze mailbox voor ondersteuning en privacyverzoeken. Met de voor de verwerking ingeschakelde verwerkers zijn verwerkersafspraken gemaakt en voor toepasselijke internationale doorgiften zijn passende waarborgen vastgelegd. Bevoegde medewerkers krijgen uitsluitend toegang voor de behandeling van de vraag of het verzoek.

Vervanging van de algemene back-upparagraaf:

> Een verwijdering geldt voor de actieve dienst. Persoonsgegevens kunnen daarna nog voorkomen in afgeschermde back-ups, die maximaal 180 dagen worden bewaard. Deze kopieën worden uitsluitend gebruikt voor herstel en zijn niet beschikbaar voor normaal gebruik. Bij herstel moeten eerder vastgelegde verwijderingen en ingetrokken toestemmingen opnieuw worden toegepast voordat de herstelde omgeving gebruikersverkeer ontvangt. Een back-up wordt niet gebruikt om een verwijderd account of profiel opnieuw beschikbaar te maken.

Dit laatste beschrijft het vereiste herstelcontract. Publiceer het niet als bewijs dat een onafhankelijke wisjournal, herstelquarantaine of herstelproef al is ingericht en getest. Verwijderingen na de datum van een back-up ontbreken in die oude kopie; een langere bewaartermijn van bewijzen binnen dezelfde database lost dat niet zelfstandig op.

## Nog vast te leggen of uit te voeren

1. De eigenaar heeft ook **maximaal twaalf maanden na afsluiting** voor gewone supportmail bevestigd. Richt de feitelijke mailbox-/archiefopschoning daarop in en controleer die. AVG-/geschildossiers blijven beperkt tot de afzonderlijke, noodzakelijke bewijsdoelen en einddatum.
2. Leg voor operationele provider-/bezorglogboeken de werkelijk toegepaste termijnen of concrete verwijdercriteria vast. Gebruik de back-uptermijn niet als verzonnen logtermijn. De hosting-/supportverwerking blijft onderdeel van het interne register en de bevestigde doorgifteafspraken.
3. Stem minimale wisbewijzen af op de 180-dagenherstelhorizon. Houd een actuele, afgeschermde hersteljournal buiten het teruggezette database-/back-updomein, herstel eerst geïsoleerd, verwerk alle latere account-/profielverwijderingen en consentintrekkingen, en controleer Auth, RLS, caches, cron en outbox voordat verkeer wordt toegestaan. Een retentiefix in broncode bewijst deze operationele route niet.
4. Privacyversie `2026-11-22.1` is voorbereid in de applicatiebron en download, met een additieve catalogusmigratie. Nieuwe onboarding/toestemming moet deze versie vastleggen; bestaande aanvaardingen en oude downloads blijven intact. Broncode, migratie en beide doelkandidaten volgen het bestaande releasecontract. De concrete uitvoeringsstatus staat in het statusdocument.
5. Rond echte aanmeld- en mailacceptatie af via de gecontroleerde staging-HTTPS-route en vervolgens productie. De afzonderlijke Resend API-koppeling voor servicemails en de proef voor automatische inactiviteitswissing zijn nog open; een door de eigenaar overgenomen Auth-template vervangt die proeven niet.

De AVG verlangt een bewaartermijn of bruikbare criteria per verwerking; er geldt geen algemene AVG-termijn van 180 dagen voor alle persoonsgegevens. Zie [Autoriteit Persoonsgegevens — bewaren van persoonsgegevens](https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens) en [AVG artikel 13](https://eur-lex.europa.eu/legal-content/nl/ALL/?uri=celex%3A32016R0679), gecontroleerd op 22 november 2026.

## Exacte nieuwe versie

- Download: [`2026-11-22.1/privacyverklaring.md`](../public/legal/2026-11-22.1/privacyverklaring.md).
- SHA-256: `c3f6186be703dda5320b70227070fea79e395eac225dbbbde0420913c57727e4`.
- Eerdere privacyversie `2026-11-22` en voorwaardenversie `2026-11-22` blijven intact.
- Live uitrol is afzonderlijk van deze bronwijziging; raadpleeg [de uitvoeringsstatus](STAGING-PRODUCTION-STATUS.md).
