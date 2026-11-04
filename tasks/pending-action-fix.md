# Repeated pending-action error

The exact error came from `useWorkspace.act`: it rejected every second mutation in a conversation, even a different action such as replying while a channel send was pending. Actions now enter a FIFO queue. Each submission keeps its original conversation, failures allow the next submission to proceed, background refresh skips pending writes, and sign-out aborts pending work and replaces the queue.

Apps Script previously acquired its lock outside the error handler and rewrote the entire Messages sheet for each edit or reaction. Lock acquisition now returns a structured `LOCK_BUSY` response when no write has started. The client retries only this response, once, within a shared 30-second deadline. Network failures and uncertain write results are never automatically retried. Reads remain locked so they cannot observe a table halfway through a concurrent write.

Each execution reuses table reads and invalidates snapshots on writes. Message edits, reactions, and login timestamps update a single row. Pending writes flush before lock release, including error paths. The deployable `Code.gs` and `src/data/appsScriptCode.ts` stay identical.

## Deploying the correction

Both the frontend and Apps Script must be updated. In the existing bound Sheet's Apps Script project, replace `Code.gs` with the root `Code.gs` from this checkout. Save, then use **Deploy → Manage deployments → Edit → New version → Deploy** on the existing web app deployment so its endpoint stays the same. Publish the frontend through its existing deployment workflow.

This checkout has no Apps Script project mapping, and the local `gws` CLI is unauthenticated. Remote Apps Script deployment and live Sheet behavior have not been verified. Local backend tests execute the actual Apps Script against an in-memory Spreadsheet service; browser tests use intercepted API responses.

Google references: [Lock release and spreadsheet flush](https://developers.google.com/apps-script/reference/lock/lock#releaseLock()), [minimizing service calls](https://developers.google.com/apps-script/guides/support/best-practices).

## Verification

- `npm test`: 23 passed. Backend regressions reproduced the original lock and whole-table-write failures before the correction; deliberately inverting the lock guard also failed the regression test.
- `npm run test:e2e`: 24 passed across Chromium and WebKit, including overlapping channel/thread sends, recovery after a failed first send, sign-out cancellation, drafts, navigation, and accessibility. The overlapping-send regression failed before the correction.
- `npm run lint`, `npm run build`, and `git diff --check` passed. Vite reports an existing `__dirname` configuration warning about a future config-loader default.
