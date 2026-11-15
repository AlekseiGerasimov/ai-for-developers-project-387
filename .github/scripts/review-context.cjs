const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
function readGh(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }))
}

function collectReviewContext({ dir, repo: currentRepo, number }, gh = readGh) {
  const prFile = path.join(dir, 'pr.json')
  const pr = JSON.parse(fs.readFileSync(prFile, 'utf8'))
  function requirePublic(repo) {
    // Never pass private linked issue, PR or inline comment contents to the reviewer.
    const visibility = gh(['repo', 'view', repo, '--json', 'visibility'])
    if (visibility.visibility !== 'PUBLIC') throw new Error('Not public')
  }

  requirePublic(currentRepo)
  pr.reviewComments = gh([
    'api',
    '--paginate',
    '--slurp',
    `repos/${currentRepo}/pulls/${number}/comments`,
  ]).flat()
  fs.writeFileSync(prFile, JSON.stringify(pr))

  const text = [
    pr,
    ...(pr.comments ?? []),
    ...(pr.reviews ?? []),
    ...pr.reviewComments,
  ]
    .map((entry) => entry.body ?? '')
    .join('\n')
  const refs = new Map()
  for (const m of text.matchAll(
    /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/(\d+)/g,
  )) {
    refs.set(`${m[1]}/${m[2]}`, [m[1], m[2]])
  }
  for (const m of text.matchAll(/#(\d+)/g)) {
    refs.set(`${currentRepo}/${m[1]}`, [currentRepo, m[1]])
  }
  const results = []
  for (const [repo, number] of refs.values()) {
    try {
      requirePublic(repo)
      const args = [
        'view',
        number,
        '--repo',
        repo,
        '--json',
        'title,body,comments,labels,state',
      ]
      let issue
      try {
        issue = gh(['issue', ...args])
      } catch {
        issue = gh(['pr', ...args])
      }
      results.push({ repo, number, issue })
    } catch {
      results.push({ repo, number, error: 'unavailable' })
    }
  }
  fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify(results))
}

module.exports = collectReviewContext
if (require.main === module) {
  collectReviewContext({
    dir: path.join(process.env.RUNNER_TEMP, 'reviewer'),
    repo: process.env.REPO,
    number: process.env.PR,
  })
}
