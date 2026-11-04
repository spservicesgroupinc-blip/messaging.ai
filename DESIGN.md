# Relay interface

Relay keeps conversations central: a compact slate desktop rail, a light channel sidebar, and a white message surface. Blue identifies primary actions and selected navigation. Use the system sans-serif stack, 14px desktop body text, 16px mobile inputs, 6–8px control radii, thin neutral borders, and visible blue focus states. Use the semantic tokens in `src/index.css`; do not introduce green primary hover/focus states or fabricated unread/online indicators.

## Mobile navigation and composing

Below 1024px, Channels, DMs, and People use full-width lists with persistent bottom navigation. Selecting a conversation keeps its parent tab selected. The header Back control and browser/device Back return through the navigation history. Full-screen panels and action sheets hide the bar; the keyboard also hides it to preserve space. Account/sign-out remains available in list headers. Desktop retains its rail and sidebar.

The chat shell and overlays use the visible viewport height/offset and device safe areas. Inputs remain at 16px on phones, browser zoom stays enabled, and landscape remains supported. Touch controls have at least 44×44px targets. Test the 320px layout, wide phone landscape, and keyboard resizing.

Phone Return inserts a newline; desktop Enter sends and Shift+Enter inserts a newline. Composition events must never submit prematurely. The composer grows to 160px and then scrolls internally. Formatting and emoji insert at the current selection. Existing-channel and thread drafts save locally under user/channel/thread keys and survive reopening. Send immediately backs up the submitted text, inserts a message marked Sending, and clears the composer for the next message. Unconfirmed text remains recoverable after a failure or reload without automatic resending. Restoring a failed send preserves newer draft text. Sign-out clears that user's drafts and pending-action backup. Storage errors retain in-memory text with a warning. Offline drafting does not enqueue or automatically send messages.

## Reliability and accessibility

Message responses belong to their originating channel and session. Obsolete reads are aborted; older snapshots cannot replace newer ones. All mutations report failures without discarding text. Polling and SSE use a stable user ID, avoid overlapping refreshes, and pause while offline or hidden. The serverless events capability closes its one-shot stream and relies on polling.

Workspace mutations update the view immediately while ordered background saves finish. Rebase outstanding actions over confirmed state so stale reads and earlier save responses cannot erase later changes. Roll back failed changes individually and show a recovery notice. Creating channels/DMs and switching to cached conversations must not wait on the network. Keep delivery status truthful and reserve server verification for authentication and confirmation.

Open conversations at the latest message. Keep the reading position when incoming messages arrive away from the bottom and expose a New messages action. Use one modal at a time with background inertness, trapped focus, Escape dismissal, and focus restoration. Docked desktop panels remain non-modal. Errors and connection state use visible text and appropriate live regions.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Install browser binaries once with `npx playwright install chromium webkit`. Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_WEBKIT_EXECUTABLE` environment variables select existing browser binaries.

Browser tests intercept every backend request and use isolated local data. They must never create test conversations or users in production. Cover navigation, drafts, failed sends, delayed responses, keyboard resizing, focus management, scroll behavior, and WCAG A/AA accessibility scans across mobile and desktop widths. Physical iPhone/Android keyboard, safe-area, and installed home-screen behavior require device verification.
