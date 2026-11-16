import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.env.AUDIT_DIR
if (!dir) throw new Error('AUDIT_DIR is required (use a temporary directory)')
mkdirSync(dir, { recursive: true })
const demo = process.env.AUDIT_DEMO === 'true'
const result = demo
  ? {
      status: 1,
      stdout: JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {
          'synthetic-training-package': {
            name: 'synthetic-training-package',
            severity: 'high',
            range: '<1.0.1',
            fixAvailable: true,
            via: [
              {
                source: 'training-001',
                title:
                  'TRAINING ONLY: synthetic audit finding, not a real defect',
                severity: 'high',
                range: '<1.0.1',
              },
            ],
          },
        },
      }),
      stderr: '',
    }
  : spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['audit', '--json', '--package-lock-only', '--audit-level=high'],
      {
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        shell: process.platform === 'win32',
      },
    )
let report
try {
  report = JSON.parse(result.stdout)
} catch {
  // Missing data is not a clean audit; preserve malformed output for diagnosis.
}
const available =
  !result.error &&
  [0, 1].includes(result.status) &&
  report?.auditReportVersion === 2 &&
  !report.error &&
  report.vulnerabilities != null
writeFileSync(join(dir, 'report.json'), result.stdout || '{}')
writeFileSync(
  join(dir, 'stderr.txt'),
  [result.stderr, result.error?.message].filter(Boolean).join('\n'),
)
writeFileSync(
  join(dir, 'context.json'),
  JSON.stringify(
    {
      application: 'calendar-workspace',
      repository: process.env.GITHUB_REPOSITORY,
      sha: process.env.GITHUB_SHA,
      run: process.env.AUDIT_RUN_URL,
      collectedAt: new Date().toISOString(),
      demo,
      status: available ? 'available' : 'unavailable',
      exitCode: result.status,
    },
    null,
    2,
  ),
)
