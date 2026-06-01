import { execSync } from 'node:child_process'
import { join } from 'node:path'

describe('CLI tests', () => {
  it('should print a message', () => {
    const cliPath = join(process.cwd(), 'apps/accounts-service/dist')

    const output = execSync(`node ${cliPath}`).toString()

    expect(output).toMatch(/Hello World/)
  })
})
