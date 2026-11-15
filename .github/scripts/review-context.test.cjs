const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const collectReviewContext = require('./review-context.cjs')

function fixture(t, pr) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-context-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.writeFileSync(path.join(dir, 'pr.json'), JSON.stringify(pr))
  return {
    dir,
    read: (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')),
  }
}

test('attaches all inline comment pages and resolves PR approvals with issue fallback', (t) => {
  const pr = {
    body: 'Specification #4',
    comments: [
      {
        body: 'Approval: https://github.com/public/calendar/pull/14#issuecomment-6898641935',
      },
    ],
    reviews: [{ body: 'Reviewed #4' }],
  }
  const { dir, read } = fixture(t, pr)
  const inline = {
    id: 42,
    path: 'playwright.config.ts',
    line: 9,
    body: 'Preserve JSON evidence; see https://github.com/public/spec/issues/5',
    diff_hunk: '@@ -1 +1 @@',
    user: { login: 'owner' },
    html_url: 'https://github.com/public/calendar/pull/13#discussion_r42',
  }
  const reply = { id: 43, in_reply_to_id: 42, body: 'Addressed' }
  const approval = {
    title: 'Budget policy',
    state: 'MERGED',
    comments: [{ body: 'Approved merge', url: pr.comments[0].body.slice(10) }],
  }
  const calls = []
  collectReviewContext(
    { dir, repo: 'public/calendar', number: '13' },
    (args) => {
      calls.push(args)
      if (args[0] === 'repo') return { visibility: 'PUBLIC' }
      if (args[0] === 'api') {
        assert.deepEqual(args, [
          'api',
          '--paginate',
          '--slurp',
          'repos/public/calendar/pulls/13/comments',
        ])
        return [[inline], [reply]]
      }
      if (args[2] === '14') {
        if (args[0] === 'issue') throw new Error('is a pull request')
        assert.equal(args[0], 'pr')
        return approval
      }
      assert.equal(args[0], 'issue')
      return { title: `Issue ${args[2]}` }
    },
  )
  assert.deepEqual(read('pr.json'), { ...pr, reviewComments: [inline, reply] })
  const issues = read('issues.json')
  assert.deepEqual(
    issues.find((entry) => entry.number === '14'),
    { repo: 'public/calendar', number: '14', issue: approval },
  )
  assert.ok(
    issues.some(
      (entry) => entry.repo === 'public/spec' && entry.number === '5',
    ),
  )
  assert.equal(
    calls.filter((args) => args[0] === 'issue' && args[2] === '4').length,
    1,
  )
})

test('private and unknown linked repositories are never read, including PR fallback', (t) => {
  const { dir, read } = fixture(t, {
    body: 'https://github.com/private/calendar/pull/14 https://github.com/unknown/calendar/issues/5 https://example.com/public/calendar/pull/6',
  })
  const calls = []
  collectReviewContext(
    { dir, repo: 'public/calendar', number: '13' },
    (args) => {
      calls.push(args)
      if (args[0] === 'api') return [[]]
      assert.equal(args[0], 'repo')
      if (args[2] === 'unknown/calendar') throw new Error('API unavailable')
      return {
        visibility: args[2] === 'public/calendar' ? 'PUBLIC' : 'PRIVATE',
      }
    },
  )
  assert.deepEqual(read('issues.json'), [
    { repo: 'private/calendar', number: '14', error: 'unavailable' },
    { repo: 'unknown/calendar', number: '5', error: 'unavailable' },
  ])
  assert.equal(calls.filter((args) => args[0] === 'api').length, 1)
})

test('private current PR is rejected before fetching inline comments', (t) => {
  const { dir, read } = fixture(t, { body: '' })
  assert.throws(
    () =>
      collectReviewContext(
        { dir, repo: 'private/calendar', number: '13' },
        (args) => {
          assert.equal(args[0], 'repo')
          return { visibility: 'PRIVATE' }
        },
      ),
    /Not public/,
  )
  assert.deepEqual(read('pr.json'), { body: '' })
})

test('unavailable public links remain explicit evidence gaps', (t) => {
  const { dir, read } = fixture(t, { body: 'Missing #99' })
  const reads = []
  collectReviewContext(
    { dir, repo: 'public/calendar', number: '13' },
    (args) => {
      if (args[0] === 'repo') return { visibility: 'PUBLIC' }
      if (args[0] === 'api') return [[]]
      reads.push(args[0])
      throw new Error('Not found')
    },
  )
  assert.deepEqual(reads, ['issue', 'pr'])
  assert.deepEqual(read('issues.json'), [
    { repo: 'public/calendar', number: '99', error: 'unavailable' },
  ])
})
