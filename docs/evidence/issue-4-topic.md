# Meeting topic: implementation evidence

Specification: [#4](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/issues/4).
Guest implementation: [#5](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/issues/5).
[Human approval](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/issues/3#issuecomment-6897584732)
authorizes the specification, both tickets and the existing HTTP/H2 and browser seams.

## Ticket #5

Executed locally on Windows on 2026-11-15, in `.cache/worktrees/ticket-5`,
branch `implement/5-topic`, initially at `0901ca8`. Ancestry was confirmed with
`git merge-base --is-ancestor 0901ca8 HEAD` (exit 0). Implementation commit:
`828b5b2` (`feat: сохранять тему разговора и показывать гостю (#5)`).

The contract, generated OpenAPI/SDK, additive V4 H2 migration, HTTP create/list,
guest form, browser draft and persisted confirmation carry the topic. Validation
counts Unicode code points after trim. Blank topics become absent. Text stays
plain text. Owner rendering belongs to #6.

### Red → green

Commands below run from the worktree root unless a directory is specified.
Raw local logs are ignored `.cache-topic-*.log` files in that worktree.

1. Added `bookingReturnsTrimmedTopicAsPlainTextInUpcomingList`, using real HTTP
   and H2. From `backend`:
   `mise exec -- .\mvnw.cmd --batch-mode --no-transfer-progress '-Dtest=BookingTests#bookingReturnsTrimmedTopicAsPlainTextInUpcomingList' test`.
   RED: `Tests run: 1, Failures: 0, Errors: 1`; missing response `topic` caused
   `NullPointerException` at the assertion. After TypeSpec changes,
   `mise run generate`, V4 migration and create/list implementation, the same
   command produced `Tests run: 1, Failures: 0, Errors: 0` and `BUILD SUCCESS`.
2. Extended the guest confirmation/reload test with input and plain text topic:
   `mise exec -- npm run test --workspace frontend -- --run src/MeetingCalendar.test.tsx -t 'booking uses selected slot'`.
   RED: missing label `Тема разговора (необязательно)`. Added form, submission,
   session compatibility and confirmation rendering. The full calendar test file
   then passed all 12 tests. An initial autosizing textarea exposed an unsupported
   browser API in jsdom; using a normal resizable three-row textarea removed that
   unnecessary dependency.

### Final validation

- `mise exec -- npm ci`: 495 packages installed, zero vulnerabilities.
- `mise run generate`: `BUILD SUCCESS`; generated TypeScript SDK and OpenAPI
  committed. Java output remains under ignored `backend/target`.
- From `backend`, `mise exec -- .\mvnw.cmd --batch-mode --no-transfer-progress '-Dtest=BookingTests,CalendarTests,MeetingTypePersistenceTests' test`:
  `Tests run: 47, Failures: 0, Errors: 0`, `BUILD SUCCESS`.
  Covers 500/501 BMP and supplementary characters, trim, blank/absent, wrong JSON
  types, plain text response, conflict without a second booking, old rows migrated
  from V2 and a topic surviving another file-database restart. Legacy schema SQL
  is test setup only; assertions use HTTP responses.
- `mise exec -- npm run test --workspace frontend`: 3 files, 23 tests passed.
  Latest calendar-only rerun after the final draft assertion: 12 tests passed.
  Includes server field errors preserving topic and draft reload, old sessions,
  confirmation reload and existing uncertain-result behavior.
- `mise run test:e2e`: `12 passed (8.5s)` across desktop and mobile; isolated H2
  server stopped and temporary database removed. Topic confirmation survives
  reload, HTML-like text is visible literally, no horizontal overflow, invalid
  topic preserves input, conflicting guests retain their own topics, and an older
  draft with no topic books successfully and reloads its confirmation.
- `mise run lint:commit`: formatting, ESLint, actionlint and Maven checkstyle
  passed; `You have 0 Checkstyle violations`, `BUILD SUCCESS`.
- `git diff --check`: passed. Full `mise run check` is deferred to the combined
  #5/#6 integration, as coordinated by the implementation orchestrator.

### Deployment and rollback

V4 adds a nullable column without changing existing rows. No demonstration data
or new authentication is introduced. Existing clients may omit topic.

A code-only revert with the migrated database is insufficient: the old controller
uses a positional six-value INSERT, while V4 adds a seventh column. A rollback
must retain V4 and adapt the reverted controller to explicitly list the original
six columns, then verify no-topic booking and old rows through HTTP. This retains
stored topics. Dropping the column loses topics; restoring a backup can also lose
newer meetings. Neither is automatically a safe rollback. No rollback was run
against user data.
