const { test } = require('node:test')
const assert = require('node:assert/strict')
const eligible = require('./triage-policy.cjs')

const incoming = {
  state: 'open',
  user: { type: 'User' },
  author_association: 'OWNER',
  labels: [{ name: 'enhancement' }, { name: 'needs-triage' }],
}

test('incoming requests from trusted authors are eligible', () => {
  for (const role of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
    assert.equal(eligible({ ...incoming, author_association: role }), true)
  }
  assert.equal(eligible({ ...incoming, labels: [] }), true)
})

test('prepared specs and tickets skip even with a stale needs-triage label', () => {
  for (const name of ['ready-for-agent', 'ready-for-human', 'wontfix']) {
    assert.equal(
      eligible({ ...incoming, labels: [...incoming.labels, { name }] }),
      false,
    )
  }
})

test('untrusted authors, bots, closed issues and PRs skip', () => {
  for (const patch of [
    { author_association: 'CONTRIBUTOR' },
    { author_association: 'NONE' },
    { user: { type: 'Bot' } },
    { state: 'closed' },
    { pull_request: {} },
  ]) {
    assert.equal(eligible({ ...incoming, ...patch }), false)
  }
})
