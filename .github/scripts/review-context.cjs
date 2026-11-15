const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const dir = path.join(process.env.RUNNER_TEMP, 'reviewer')
const pr = JSON.parse(fs.readFileSync(path.join(dir, 'pr.json'), 'utf8'))
const refs = new Map()
for (const m of pr.body.matchAll(
  /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)/g,
)) {
  refs.set(`${m[1]}/${m[2]}`, [m[1], m[2]])
}
for (const m of pr.body.matchAll(/#(\d+)/g)) {
  refs.set(`${process.env.REPO}/${m[1]}`, [process.env.REPO, m[1]])
}
const results = []
for (const [repo, number] of refs.values()) {
  try {
    // Never pass private linked issue contents to the reviewer.
    const visibility = JSON.parse(
      execFileSync('gh', ['repo', 'view', repo, '--json', 'visibility'], {
        encoding: 'utf8',
      }),
    )
    if (visibility.visibility !== 'PUBLIC') throw new Error('Not public')
    const result = execFileSync(
      'gh',
      [
        'issue',
        'view',
        number,
        '--repo',
        repo,
        '--json',
        'title,body,comments,labels,state',
      ],
      { encoding: 'utf8' },
    )
    results.push({ repo, number, issue: JSON.parse(result) })
  } catch {
    results.push({ repo, number, error: 'unavailable' })
  }
}
fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify(results))
