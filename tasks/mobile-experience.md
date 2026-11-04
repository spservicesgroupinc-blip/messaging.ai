# Mobile experience implementation

- Replaced phone navigation with Channels / DMs / People screens and bottom tabs.
- Added scoped request handling, draft recovery, explicit mutation results, and offline drafting.
- Shared modal behavior now handles inertness, focus, dismissal, and action sheets.
- Added unit regressions plus Chromium/WebKit interaction and accessibility coverage.
- Added Playwright and axe development dependencies; aligned esbuild with Vite's peer requirement and regenerated bun.lock.

Validation commands and the mobile design contract are in DESIGN.md. Browser checks use mocked API responses. No database or backend endpoint changes are required. Physical-device keyboard/safe-area validation and live backend testing remain user acceptance checks.
