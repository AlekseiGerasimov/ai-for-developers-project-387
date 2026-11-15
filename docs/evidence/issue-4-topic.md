# Meeting topic: implementation evidence

## PR #13 correction: machine-readable browser and review evidence (#4)

Executed on Linux on 2026-11-15 in the existing branch
`opencode/issue3-20261115173432`. Before editing, fetched `main` and merged
`7e4fbf1353ee88f0b9e260579597f2fa72bd38dd` with:

```sh
git fetch origin main
git fetch --unshallow origin
git merge origin/main -m "chore: sync agent budget policy (#11)"
```

The first merge attempt was refused because the checkout was shallow; after
fetching history, the ordinary merge succeeded without conflicts. Merge commit:
`2558013d5368cf4717eca8b4b9647701c7561baf`. The runs below exercised that commit
plus the working-tree changes in `fix: preserve browser and review evidence (#4)`.

### Browser result and successful traces

`playwright.config.ts` now enables both list and JSON reporters when `CI` is set.
JSON is written to `test-results/results.json`; successful traces remain enabled
with `trace: 'on'`. The existing `Save browser evidence` step already uploads
`test-results/` and root `tested-sha.txt` together as `browser-<tested SHA>`.

```sh
CI=1 mise run test:e2e
```

Exit 0: frontend build and isolated E2E JAR build succeeded; **14 browser tests
passed**. The isolated server stopped and its temporary database was removed.
JSON `stats.startTime` was `2026-11-15T17:54:16.531Z`, duration `14281.899` ms.

Validated the generated files and every per-test result/trace with this command
(exit 0), rather than relying on the terminal's pass message:

```sh
mise exec -- node --input-type=commonjs -e '
const assert = require("node:assert/strict");
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync("test-results/results.json", "utf8"));
const lastRun = JSON.parse(fs.readFileSync("test-results/.last-run.json", "utf8"));
assert.equal(report.errors.length, 0);
assert.deepEqual([report.stats.expected, report.stats.unexpected, report.stats.flaky, report.stats.skipped], [14, 0, 0, 0]);
assert.deepEqual(lastRun, { status: "passed", failedTests: [] });
const counts = {};
let traces = 0;
function visit(suite) {
  for (const spec of suite.specs ?? []) {
    assert.equal(spec.ok, true);
    for (const test of spec.tests) {
      assert.equal(test.status, "expected");
      assert.equal(test.results.length, 1);
      counts[test.projectName] = (counts[test.projectName] ?? 0) + 1;
      for (const result of test.results) {
        assert.equal(result.status, "passed");
        assert.equal(result.errors.length, 0);
        const trace = result.attachments.find(a => a.name === "trace");
        assert.ok(trace && fs.statSync(trace.path).size > 0);
        traces++;
      }
    }
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites) visit(suite);
assert.deepEqual(counts, { desktop: 7, mobile: 7 });
assert.equal(traces, 14);
console.log(JSON.stringify({ stats: report.stats, result: lastRun, projects: counts, traces }, null, 2));
'
```

Observed: `expected=14`, `unexpected=0`, `flaky=0`, `skipped=0`, no report errors;
`.last-run.json` has `status="passed"`, `failedTests=[]`. Both desktop and mobile
have seven scenarios, all `expected` with a single `passed` result and a nonempty
trace ZIP: **14 successful traces**. Each project includes conflict recovery,
legacy draft/no-topic booking, calendar navigation, two catalog journeys, and
owner journeys both with and without a topic. These are results of this agent
session; publication of the next head's Actions artifact is a subsequent CI run.

### Review context

The existing `pr.json` attachment now includes `reviewComments`, collected with
`gh api --paginate --slurp repos/$REPO/pulls/$PR/comments`, preserving inline
paths, lines, diff hunks, author, permalink and thread identifiers. References
are collected from the PR body, conversation comments, reviews and inline
comments, so the owner's actual `/pull/14` approval link is followed. Linked
items use `gh issue view` with `gh pr view` fallback, retaining the existing
`issues.json` attachment shape. Repository visibility must be `PUBLIC` before
reading current inline comments or any linked issue/PR. Private and unknown
repositories remain unavailable without fetching their contents.

```sh
mise exec -- node --test .github/scripts/*.test.cjs
```

Exit 0: **14 passed, 0 failed, 0 skipped**. Four new context regressions cover
paginated inline comments/replies and issue-to-PR fallback, deduplication and
comment-body links, private/unknown repositories, private current PR rejection,
and explicit unavailable public links. Existing budget and triage tests pass.

Also ran a temporary Node probe using real `gh pr view 13 --repo
AlekseiGerasimov/ai-for-developers-project-387 --json title,body,comments,reviews`
as input to `collectReviewContext`. Assertions passed: **1 real inline comment**
(the Unicode trimming review on `MeetingsController.java`), **6 linked items**,
**0 unavailable**, and the actual owner comment
[`6898641935` approving PR #14](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/pull/14#issuecomment-6898641935)
present in `issues.json`. The temporary probe directory was removed.

### Formatting and final checks

- `mise exec -- npx prettier --check playwright.config.ts .github/scripts/review-context.cjs .github/scripts/review-context.test.cjs docs/evidence/issue-4-topic.md`:
  exit 0, all matched files formatted.
- `mise run lint:commit`: exit 0 at 17:55 UTC; ESLint, repository-wide Prettier,
  actionlint and offline Maven checkstyle passed (0 violations, `BUILD SUCCESS`).
- `git diff --check`: exit 0.
- `git merge-base --is-ancestor 7e4fbf1353ee88f0b9e260579597f2fa72bd38dd HEAD`:
  exit 0, confirming the merged main ancestry in this PR branch.

## PR #13 correction: consistent Unicode edge trimming (#4)

Executed on Linux on 2026-11-15 in the existing branch
`opencode/issue3-20261115173432`, starting at
`ce253eeb023007bec9c8cbd4ba0a3513e50072ec`. The user's explicit PR review
instruction authorized this correction. Tests below exercised that base plus
the working-tree correction recorded here.

Implementation SHA: `9de8432fb76ce51096f8f19ee392fda916144de6`
(`fix: normalize topic whitespace consistently (#4)`). The RED runs used the
base SHA above plus the new tests; the GREEN and complete checks used the
production/test contents committed at this implementation SHA. This follow-up
only records its SHA and the completed lint result.

Topic policy: ECMAScript `String.trim()` on both sides, before counting the
500 Unicode code points and before saving/sending. Its exact edge set is
U+0009–U+000D, U+0020, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029,
U+202F, U+205F, U+3000 and U+FEFF. Empty results mean no topic. Interior
whitespace is preserved; U+001C, U+0085 and U+200B are not trimmed. Java uses
an explicit anchored character set; the client validates and sends the same
trimmed value while retaining the original draft. Guest name/email rules
are unchanged.

### Actual RED → GREEN

First added HTTP/JUnit regressions, before changing production code. The
existing real HTTP/random-port Spring server and H2 seam was used throughout.
From `backend`, ran this exact command before and after the fix:

```sh
mise exec -- sh ./mvnw --batch-mode --no-transfer-progress '-Dtest=BookingTests#unicodeTopicEdgesAreTrimmedBeforeCodePointLimit+unicodeWhitespaceOnlyTopicIsAbsentEvenBeyondRawLimit+topicKeepsInteriorWhitespaceAndNonEcmaScriptEdgeCharacters+bookingReturnsSavedMeetingAndUpcomingList' test
```

- **RED**, 17:43:04 UTC: exit 1, `Tests run: 13, Failures: 12, Errors: 0`,
  `BUILD FAILURE`. Eight 500-code-point edge cases returned 400 instead of
  201; three 501-whitespace-only cases returned 400 instead of 201; Java
  `strip()` also incorrectly removed U+001C under the chosen policy. The
  existing ordinary no-topic booking passed.
- **GREEN**, 17:43:41 UTC: exit 0, `Tests run: 13, Failures: 0, Errors: 0`,
  `BUILD SUCCESS`, using the same command and tests.
- The limit matrix uses both `x` and supplementary `𐐀`, independently wraps
  them in NBSP, U+202F, BOM and the remaining ECMAScript whitespace set,
  rejects 501 with a `topic` field error and an empty GET list, and accepts
  500 with the exact trimmed topic in POST/GET. Each accepted case then books
  another free slot without a topic and checks both records in the HTTP list.
- Separate HTTP cases cover 501 repetitions of each of NBSP/U+202F/BOM as
  absent topics and preservation of interior and non-trimmable characters.
  Existing empty/ASCII-blank/omitted-topic cases remain in the full suite.

Also added client form/submission regressions before changing `useBooking.ts`:

```sh
mise exec -- npm run test --workspace frontend -- --run src/MeetingCalendar.test.tsx -t 'topic trims Unicode|topic containing 501'
```

- **RED**, 17:43:16 UTC: exit 1, 6 failed / 12 skipped: outgoing topics still
  contained edge whitespace, and whitespace-only topics were sent as strings.
- **GREEN**, 17:43:28 UTC: exit 0, 6 passed / 12 skipped. Each edge character
  permits 500 supplementary code points, blocks 501 without POST, and omits
  a 501-whitespace-only topic from the outgoing JSON.

### Full verification

- `mise exec -- npx prettier --write frontend/src/MeetingCalendar.test.tsx frontend/src/useBooking.ts`:
  formatted the two changed TypeScript files.
- First `mise run check` invocation ended with tool error
  `Unknown: ChildProcess.kill`; no overall success is claimed for that attempt.
  No check process remained. Re-ran `mise run check` to get a complete result.
- Completed `mise run check`, 17:48 UTC, exit 0: generated contract/SDK
  freshness, ESLint, Prettier, actionlint, Java checkstyle (0 violations),
  TypeScript/Vite build, **29 frontend tests**, **68 JVM tests** (0 failures or
  errors), and **14 desktop/mobile E2E tests** passed. Browser coverage includes
  ordinary booking without a topic. Isolated E2E server stopped and temporary
  database removed.
- `git diff --check`: exit 0.
- `mise run lint:commit`, 17:48:57 UTC: exit 0; ESLint, Prettier, actionlint
  and offline Maven checkstyle passed (0 violations, `BUILD SUCCESS`).

## Combined integration verification

On `675a9b69a503dba31d23af46b13aac067bb7d9e9`, `mise run check` passed:
56 JVM tests (0 failures/errors), 23 frontend tests, generation/lint/typecheck/build,
and 14 desktop/mobile browser scenarios. The two-axis independent `code-review`
reported Standards: 0 findings; Spec: 1 confirmed budget admission defect in #11,
with no confirmed defects in #4/#5/#6. The budget defect is handled separately
with a fresh implementer and regression tests, recorded in issue-11 evidence.

An additional browser check, separate from the implementation sessions, used the
isolated E2E JAR built by that check. It recorded exact git HEAD, screenshot and
trace for both scenarios: booking with topic → confirmation → reload → owner
sees topic; and booking without topic → confirmation/reload → owner sees meeting.
Both passed at `675a9b6`. At baseline `0901ca8` the topic scenario failed because
the topic input was absent, while the no-topic scenario passed. Local artifacts
are ignored `.cache/evidence/independent/<SHA>/`; these supplement, rather than
replace, the final Actions browser artifact at the final PR head SHA.

The first checkpoint draft is [PR #12](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/pull/12).
Its separate [automatic review](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/actions/runs/43740339479)
successfully published the then-correct finding that #6 was still pending, and
identified the missing final CI/artifact evidence. #6 was subsequently implemented
in its own worktree and merged. That review did not trigger the implementation.
The initial PR CI [passed](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/actions/runs/43740339496).
Final automatic issue-to-PR publication and review-comment correction cycle remain
separate verification steps; the timed-out initial source run is not reported as success.

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

## Ticket #6

Executed locally on Windows on 2026-11-15 in `.cache/worktrees/ticket-6`,
branch `implement/6-owner-topic`, based on integration commit
`44ece4ef9798e1661ee6f1413f09f477777cb1dd` (includes #5). These runs tested
the working tree with the changes recorded in this commit; they are not claims
of a clean committed SHA run. Full `mise run check` is reserved for the combined
integration branch.

Owner cards now show nonblank topics as React text, preserve newlines and use
the existing card wrapping for long text. Missing topics produce no label.
The owner loading, error, retry, order and date formatting code is unchanged.

### Red → green

The existing real-browser owner journey now runs both with and without a topic
on desktop and mobile: type creation → guest booking → confirmation/reload →
owner list/reload → refresh → navigation back. Assertions locate the specific
meeting by its type title and check name, email, Moscow date/time and topic.
The long topic contains literal `<b>` tags and supplementary Unicode; the test
checks that no `b` element exists, only the matching card contains that topic,
and the page fits the viewport. The final topic includes the project name so
parallel desktop/mobile bookings have distinct text.

Commands, from the worktree root unless noted:

- `mise exec -- npm ci`: 495 packages installed, zero vulnerabilities.
- `mise exec -- npm run build --workspace frontend`: passed (both RED and GREEN).
- From `backend`,
  `mise exec -- .\mvnw.cmd --batch-mode --no-transfer-progress -Pe2e clean package -DskipTests`:
  `BUILD SUCCESS` for both builds.
- To run only the owner scenarios with the existing isolated H2 harness, made a
  temporary copy of `scripts/e2e.mjs` at `scripts/.cache-owner-e2e.mjs`, replacing
  its Playwright arguments `'test'` with `'test', 'e2e/owner-meetings.spec.ts'`.
  Ran `mise exec -- node scripts/.cache-owner-e2e.mjs`.
  RED before owner rendering: `2 failed`, `2 passed (10.5s)`; both topic cases
  failed at the owner card's `toBeVisible` assertion because the topic element
  was absent. Both no-topic cases passed on the original owner implementation.
  GREEN after conditional text rendering and rebuild: `4 passed (4.9s)`;
  a direct rerun confirmed exit 0 and `4 passed (4.7s)`.
  Both harness runs stopped the server and removed their temporary database.
  The temporary harness was removed; no test-runner or CI changes are required.
  Raw RED/GREEN logs are local ignored `.cache-topic6-*.log` files.
- `mise exec -- npm run test --workspace frontend -- --run src/OwnerMeetings.test.tsx`:
  all 3 existing owner tests passed, including API ordering, Moscow midnight,
  loading/empty list, errors and explicit retry.
- `git merge feat/meeting-topic`: already up to date before commit.
- `git diff --check`: passed.

The risk is limited to owner card text/layout. Reverting the owner rendering
leaves persisted topics and guest booking intact; the #5 database rollback
constraints above still apply to reverting the combined feature.

`mise run lint:commit` passed after formatting the final test data expression:
Prettier, ESLint, actionlint and Maven checkstyle (`0 Checkstyle violations`,
`BUILD SUCCESS`).
