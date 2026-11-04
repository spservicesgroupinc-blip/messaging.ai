# Smartphone layout and PWA sizing

The chat shell, navigation, threads, members panel, and channel dialogs now use
the visible viewport height and offset. This keeps controls above an on-screen
keyboard, including browsers that resize only the visual viewport. Pinch zoom
keeps the existing layout. Safe-area spacing protects controls around notches
and home indicators; the manifest allows landscape orientation.

Phone inputs use 16px text. The phone composer puts formatting behind its
formatting button and removes desktop keyboard hints to leave more room for
messages. Navigation, search, refresh, and members controls remain available.

The viewport implementation follows the
[VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
and the viewport's
[interactive-widget setting](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport).

## Verification

- `npm test`: viewport resize, panning, pinch zoom, fallback, cleanup, and existing protocol tests.
- `npm run lint`: TypeScript validation.
- `npm run build`: production build.
- Isolated Chromium checks at 320×568, 360×740, 375×667, 390×844, 430×932,
  768×1024, 844×390, 1024×768, and 1440×900: no page overflow; send button visible.
- WebKit checks at 320×568, 390×844, and 844×390: no page overflow; 16px input text;
  send button visible; members panel opens and closes.
- Simulated 390×420 visual viewport: composer, sidebar, thread reply, members,
  and channel dialog fit above the keyboard; formatting and search work.
- Production preview: service worker activates with `relay-v3`; offline reload
  renders the cached sign-in screen.

Browser checks use mocked workspace data. Physical iPhone/Android keyboard,
safe-area, and home-screen installation checks remain manual device validation.
These source changes have not been deployed.
