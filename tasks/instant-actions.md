# Immediate workspace actions

Clicking Send must show the message in its conversation and clear the composer before the server responds. Users can write and send the next message while earlier saves finish. Thread replies, reactions, message edits/deletion, channel creation/editing/deletion, direct-message opening, member changes, and status updates follow the same immediate-feedback contract. Cached conversations stay visible during refresh. Authentication and first-time message loading still wait for verified server data.

## Behavior and recovery

`OptimisticWorkspace` keeps confirmed data and ordered local operations separately. It reuses the existing portable Sheets action engine with stable local IDs, then reapplies pending operations after every server response. A failed operation rolls back independently of later operations. Creating a channel or DM gives it a stable UI ID; background requests translate that ID to the confirmed server ID. Drafts and navigation retain the UI ID, including after reload.

`useWorkspace.act` now resolves after local validation and acceptance. An accepted result means the UI can proceed; it does not mean the server has confirmed the write. Background requests still run in submission order through `MutationQueue`. Submission and completion invalidate stale read responses. Messages display Sending until confirmed; actions on an unconfirmed message wait for its server ID.

Submitted text is backed up under a user-scoped local-storage key before the composer clears. After failure or reload, unconfirmed sends remain visible and can be restored to the correct main/thread draft. Restoration appends to a newer draft rather than replacing it. Reload never automatically repeats an uncertain write. Offline drafting still requires an explicit Send after reconnecting. Sign-out aborts queued requests and clears that user's action backup and drafts. Backup failure retains in-memory state and shows a warning to keep the app open.

Only permitted mutation fields enter backups. Passwords are excluded; restored records are validated and must belong to the signed-in user. Server authorization remains authoritative. Failed non-message actions revert and show a dismissible recovery notice with the submitted name/text when available.

## Verification and release

Unit checks cover rebasing, independent rollback, channel ID resolution, member/status operations, reload recovery, malformed storage, and credential exclusion. Browser checks hold backend responses while asserting the visible result, composer availability, follow-up sends, channel/member changes, failure recovery, sign-out cancellation, and WCAG accessibility across responsive sizes. They use isolated API fixtures, never production accounts.

This change is frontend-only and requires publishing the updated frontend to affect the live app. It does not change the Apps Script protocol. The previous Apps Script locking correction still needs its own deployment if it has not already been published. No live deployment was performed during this change.

Reference: React's [optimistic update guidance](https://react.dev/reference/react/useOptimistic) explains rebasing pending changes when confirmed state changes. The app uses a subscribed operation store because its queue and recovery records must survive composer/modal unmounts.

Validation completed: 33 unit tests passed; all 34 browser cases were verified across the full Chromium/WebKit run and focused reruns after corrections. The final send/recovery rerun passed all eight affected browser cases. Type checking, production build, and diff whitespace checks passed. A deliberate rollback-condition inversion failed the regression test as expected. A regression also reproduced and fixed queued messages briefly reversing order when the first server timestamp arrived later than the next local submission.

The initial browser run detected WebKit's existing warning about the `interactive-widget` viewport argument in the new action-console assertion. That assertion now starts after initial navigation and verifies the action period without filtering errors. Existing Vite `__dirname` configuration warnings remain outside this change. The pending-send phone layout was captured and visually inspected.
