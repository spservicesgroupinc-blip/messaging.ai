# Relay interface

The workspace puts conversations first: a compact ink app rail, a quiet light channel sidebar, and a white conversation surface. Forest green identifies selected channels and primary actions. Message authors, timestamps, replies, and reactions have distinct weights without turning messages into cards.

The existing channel, direct message, member, thread, reaction, and authentication contracts remain in place. Navigation controls must act on real workspace data; do not invent unread counts, online indicators, or unsupported actions.

Use the system sans-serif stack, 14px body text, 6–8px control radii, thin neutral borders, and visible keyboard focus. At widths below 1024px, navigation and detail panels become overlays; the app rail disappears. The conversation and composer must fit a 320px viewport. Dialogs support Escape and keyboard focus management. Respect reduced motion and device safe areas.

Validate changes with `npm run lint`, `npm run build`, and `node --import tsx --test src/utils/sheetsProtocol.test.ts`. Check authentication, channel selection, direct messages, sending/editing, reactions, threads, member panels, search, and channel creation in an isolated local workspace at desktop and mobile widths. Test fixtures must never be added to the real conversations or production backend.
