# Native prototype — uitgevoerde controles

4 november 2026.

| Controle | Resultaat |
| --- | --- |
| Contentexport vanuit bestaande TypeScript-verhaallogica | Geslaagd: 13 verhalen, 403 bereikbare scènes, 416 eindroutes, 15 assets |
| Native dependency-installatie | Geslaagd; `package-lock.json` vastgelegd |
| `npx expo install --check` | Geslaagd: dependencies up-to-date voor Expo 58.0.23 |
| `npm run check` | Geslaagd: TypeScript zonder fouten |
| `CI=1 npm run export:android` | Geslaagd: Metro bundelt 650 modules, 15 assets en Android Hermes-bundle |
| Toestel, emulator, APK/AAB, Play review | Niet uitgevoerd |
| Native 60-fps-meting, geheugen, echte offline apparaatstem | Niet uitgevoerd |
| Supabase/Resend, cross-device sync, Play Billing | Niet aangesloten; geen geslaagde integratietest geclaimd |

De Metro-export bewijst dat de native imports en assets bundelbaar zijn. Dit is geen Android SDK-build en geen bewijs dat alle schermen op een toestel correct renderen. De volgende verplichte stap op de development-VPS is een development APK bouwen en de leesroute met een echt Android-toestel doorlopen.

De app gebruikt native `Animated` met native driver voor de basisovergang. De geplande Reanimated-/Gesture Handler-/Skia-interacties en de uitgebreide stationsspeelprent blijven afzonderlijke native implementatiewerkzaamheden.
