# Little fm

An Expo / React Native app for seeing friends' recent Last.fm songs, with two Android home screen widgets.

## Run locally

```sh
npm install
npm start
```

The app uses Expo SDK 52 / React Native 0.76. Use a compatible Expo Go version for the app alone, or create a development build for widgets. The web preview works with `npm run web`.

Set `EXPO_PUBLIC_LISTENING_API_URL` in the app's `.env` to your deployed HTTPS backend URL, ending in `/api/lastfm`. Only that public URL is included in Expo config and the APK. Neither the Last.fm API key nor a shared secret belongs in the app environment. Existing friends saved under `@lastfm_usernames` are preserved.

The small Node backend lives in `backend/`. Set `LASTFM_API_KEY` only in the hosting provider's private environment, or `backend/.env` for local development. The shared secret is not used. All `.env` files are ignored by Git. Rotating the server's API key requires a backend redeployment, not a new APK.

For local backend development, run `npm --prefix backend test`, then `cd backend && npm start`. It listens on `127.0.0.1:3001`. Development builds can use `http://127.0.0.1:3001/api/lastfm` on web or `http://10.0.2.2:3001/api/lastfm` on an Android emulator; release builds require HTTPS.

The backend allows only `user.getrecenttracks`, `album.getinfo`, and `track.getinfo`. It rejects extra parameters, credentials, write methods, and arbitrary upstream URLs, and returns a limited response with no upstream error internals. Recent lookups are cached for 15 seconds; artwork metadata for 6 hours. Concurrent identical requests share a fetch. Request and upstream limits are per warm server instance, with CDN caching in front; they are best-effort limits, not a distributed quota or app authentication. If usage grows, add a shared rate limiter or a hosting firewall rule. The endpoint reads public Last.fm activity and does not take passwords or store friend lists.

Deploy `backend/` as a Vercel project with Node 22. Add `LASTFM_API_KEY` as a sensitive production environment variable before deploying, and keep deployment protection off for the production API so installed apps can reach it. Use the resulting `/api/lastfm` URL as the GitHub repository variable `LISTENING_API_URL`. The Android workflow receives only this URL, never the Last.fm credential. Deployments are explicit; Git auto-deploys are disabled.

## Android widgets

- **A little listening**: the selected friend's latest checked song.
- **Listening circle**: a native scrolling list of every saved friend; recent live fetches are sorted first.
- Choose the pattern (Doodles, Alien, Fruits, or Miffy) and color (Petal, Sage, Oat, Moss, Berry, Butter, or Lilac) separately. Any pattern works with any color. Existing theme selections retain their appearance when upgraded.
- Alien places one UFO, one face, and one small star. The circle has drawings at the top right, bottom right, and center; the small widget uses top right, bottom right, and bottom left.
- Fruits shows one each of the supplied strawberry, pineapple, watermelon, and grape drawings, plus a small heart. Drawings avoid the small album cover and the circle's entire scrolling cover column, including rotated corners.
- Miffy uses five spaced drawings in the compact card and all seven in the circle, with the same quiet opacity and cover-safe placement. The main view keeps the original cat. All supplied source PNGs are retained unchanged.
- Patterns keep their smaller scale and existing opacity. Their layout stays still during song refreshes and color changes.
- The Widgets tab saves the featured friend and palette for **all copies**.
- Tap the widget body to open the app. Tap ↻ to fetch songs without opening it.
- No friends, empty listening history, network errors, and saved offline songs are supported.
- Background checks are requested every 30 minutes. Android can defer them. Foreground app checks run every 30 seconds while active.
- Cards show the song, artist and friend without refresh prompts or a persistent live-playback claim.
- Real covers use recent-track images, Last.fm album/track metadata, then Cover Art Archive when a MusicBrainz album ID is available. Missing or broken artwork falls back to a small music note.
- Artwork is cached. Native widgets use verified image bytes, so a failed network image does not prevent the widget from rendering.
- Shared SVGs preserve the supplied pencil cat, alien, strawberry, flowers, and music drawings with subtle paper texture. Original drawings are kept in `assets/doodles/originals`.

Widgets require a rebuilt native app; **Expo Go cannot install home screen widgets**.

```sh
npx expo prebuild --platform android --no-install
npm run android
```

With the app installed, add friends, choose a palette under Widgets, then long-press an empty spot on the Android home screen → Widgets → little fm. Drag a widget onto the screen. Launcher grid sizes vary; widgets are resizable.

The app icon uses the selected close crop of the supplied cat drawing on light pink. App, browser, splash, and Android launcher assets are included; native launcher changes appear after rebuilding and installing the app.

This project contains a tracked Android directory. Generated widget receivers and XML resources are included. Re-run prebuild after editing widget configuration in `app.config.js`. The widget library is pinned to 0.15.1 for RN 0.76, with the existing old architecture retained.

The manually dispatched `Build Android APK` workflow builds an unsigned release APK for ARM64 and ARMv7. Align and sign it with the private release keystore before publishing. Signing keys and passwords stay outside this repository. Keep the same signing key for app updates.

## Validation

```sh
npm run typecheck
npm test
npm --prefix backend test
npx expo export --platform android
npx expo export --platform web
```

Tests also cover backend method/parameter restrictions, response redaction, cache expiry, request coalescing, request limits, credential-free client URLs, and doodle visibility around album covers.
