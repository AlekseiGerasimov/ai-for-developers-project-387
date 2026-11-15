// Recheck live state: a queued request may have become a prepared ticket.
module.exports = function eligible(issue) {
  const prepared = new Set(['ready-for-agent', 'ready-for-human', 'wontfix'])
  return (
    issue.state === 'open' &&
    !issue.pull_request &&
    issue.user?.type === 'User' &&
    ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(issue.author_association) &&
    !issue.labels.some((label) => prepared.has(label.name))
  )
}
