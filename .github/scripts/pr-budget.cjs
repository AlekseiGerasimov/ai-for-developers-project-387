module.exports = async function attempts(runs, current, number, jobsForRun) {
  let count = 0
  for (const run of runs) {
    if (
      run.display_title !== `OpenCode ${number}` ||
      (run.run_number > current.run_number && current.run_attempt <= 1) ||
      !['issue_comment', 'pull_request_review_comment'].includes(run.event)
    )
      continue
    // Include inherited authorization when only failed jobs are rerun.
    const jobs = await jobsForRun(run)
    if (
      jobs.some(
        (job) => job.name === 'authorize' && job.conclusion === 'success',
      )
    ) {
      count += run.run_attempt
    }
  }
  return count
}
