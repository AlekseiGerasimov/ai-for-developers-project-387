const { test } = require('node:test')
const assert = require('node:assert/strict')
const attempts = require('./pr-budget.cjs')
const run = (n, event = 'issue_comment', attempt = 1, pr = 42) => ({
  display_title: `OpenCode ${pr}`,
  run_number: n,
  event,
  run_attempt: attempt,
})
test('both comment channels and reruns exhaust the same PR budget', () => {
  const runs = [run(1), run(2, 'pull_request_review_comment', 2)]
  assert.equal(attempts(runs, { run_number: 2 }, 42), 3)
  assert.ok(attempts([...runs, run(3)], { run_number: 3 }, 42) > 3)
})
test('other PRs, future runs and automatic review cannot consume this budget', () => {
  assert.equal(
    attempts(
      [run(1), run(2, 'pull_request'), run(3, 'issue_comment', 1, 43), run(9)],
      { run_number: 3 },
      42,
    ),
    1,
  )
})
test('cancellations still consume an attempt', () => {
  assert.equal(
    attempts([{ ...run(1), conclusion: 'cancelled' }], { run_number: 1 }, 42),
    1,
  )
})
