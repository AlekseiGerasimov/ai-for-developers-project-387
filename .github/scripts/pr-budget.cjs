// Keep the current-run argument for queued workflows and reruns of older versions.
module.exports = async function attempts(runs, _current, number, jobsForRun) {
  let count = 0
  for (const run of runs) {
    if (
      run.display_title !== `OpenCode ${number}` ||
      !['issue_comment', 'pull_request_review_comment'].includes(run.event)
    )
      continue
    // Include inherited admission when only failed jobs are rerun.
    const jobs = await jobsForRun(run)
    const admissions = jobs
      .filter((job) => job.name === 'authorize')
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.name === 'Record admitted command')
    // Older workflows have no marker. A started budget step proves admission;
    // a successful guard alone also occurs for rejected commands.
    const admitted = admissions.length
      ? admissions.some((step) => step.conclusion === 'success')
      : jobs.some(
          (job) =>
            job.name === 'opencode' &&
            job.steps?.some(
              (step) =>
                step.name === 'Check PR budget' &&
                (step.status === 'in_progress' ||
                  (step.status === 'completed' &&
                    step.conclusion !== 'skipped')),
            ),
        )
    if (admitted) {
      count += run.run_attempt
    }
  }
  return count
}
