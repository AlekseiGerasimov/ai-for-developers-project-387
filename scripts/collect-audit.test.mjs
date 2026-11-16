import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const collector = fileURLToPath(new URL('./collect-audit.mjs', import.meta.url))

for (const demo of [true, false]) {
  test(
    demo
      ? 'training report is explicitly synthetic'
      : 'no lockfile means unavailable, not clean',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'calendar-audit-test-'))
      try {
        const result = spawnSync(process.execPath, [collector], {
          cwd: dir,
          encoding: 'utf8',
          env: { ...process.env, AUDIT_DIR: dir, AUDIT_DEMO: String(demo) },
        })
        assert.equal(result.status, 0, result.stderr)
        const context = JSON.parse(
          readFileSync(join(dir, 'context.json'), 'utf8'),
        )
        assert.equal(context.demo, demo)
        assert.equal(context.status, demo ? 'available' : 'unavailable')
        const report = JSON.parse(
          readFileSync(join(dir, 'report.json'), 'utf8'),
        )
        if (demo) {
          assert.match(
            report.vulnerabilities['synthetic-training-package'].via[0].title,
            /TRAINING ONLY/,
          )
        }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  )
}
