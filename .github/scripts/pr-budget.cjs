module.exports = function attempts(runs, current, number) {
  return runs
    .filter(
      (r) =>
        r.display_title === `OpenCode ${number}` &&
        r.run_number <= current.run_number &&
        ['issue_comment', 'pull_request_review_comment'].includes(r.event),
    )
    .reduce((sum, r) => sum + r.run_attempt, 0)
}
