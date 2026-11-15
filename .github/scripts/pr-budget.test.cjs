const { test } = require('node:test')
const assert = require('node:assert/strict')
const attempts = require(process.env.PR_BUDGET_MODULE || './pr-budget.cjs')
const run = (n, event = 'issue_comment', attempt = 1, pr = 42) => ({
  display_title: `OpenCode ${pr}`,
  run_number: n,
  event,
  run_attempt: attempt,
})
const authorized = async () => [{ name: 'authorize', conclusion: 'success' }]
const count = (runs, number, attempt = 1, jobs = authorized) =>
  attempts(runs, { run_number: number, run_attempt: attempt }, 42, jobs)

test('both comment channels and reruns exhaust the same PR budget', async () => {
  const runs = [run(1), run(2, 'pull_request_review_comment', 2)]
  assert.equal(await count(runs, 2), 3)
  assert.ok((await count([...runs, run(3)], 3)) > 3)
})
test('other PRs, future runs and automatic review cannot consume this budget', async () => {
  assert.equal(
    await count(
      [run(1), run(2, 'pull_request'), run(3, 'issue_comment', 1, 43), run(9)],
      3,
    ),
    1,
  )
})
test('cancellations still consume an attempt', async () => {
  assert.equal(await count([{ ...run(1), conclusion: 'cancelled' }], 1), 1)
})

test('rejected comments cannot exhaust a trusted human budget', async () => {
  assert.equal(
    await count([run(1), run(2), run(3), run(4)], 4, 1, async (r) => [
      {
        name: 'authorize',
        conclusion: r.run_number === 4 ? 'success' : 'skipped',
      },
    ]),
    1,
  )
})
test('rerunning an old workflow cannot bypass newer admitted requests', async () => {
  assert.equal(
    await count([run(1, 'issue_comment', 2), run(2), run(3)], 1, 2),
    4,
  )
})
test('unavailable authorization history fails closed', async () => {
  await assert.rejects(
    count([run(1)], 1, 1, async () => {
      throw new Error('history unavailable')
    }),
    /history unavailable/,
  )
})
