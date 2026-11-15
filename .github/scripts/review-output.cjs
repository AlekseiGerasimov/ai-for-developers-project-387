const fs = require('node:fs')
const events = fs
  .readFileSync('events.jsonl', 'utf8')
  .trim()
  .split('\n')
  .map(JSON.parse)
if (events.some((e) => e.type === 'error'))
  throw new Error('Reviewer returned an error')
const answer = events
  .filter((e) => e.type === 'text')
  .map((e) => e.part.text)
  .join('\n')
if (!answer.trim()) throw new Error('Reviewer returned no text')
fs.writeFileSync('review.md', answer)
