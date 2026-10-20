import path from 'path'

import { $ } from 'bun'

export class GitRepo {
  constructor(public repoPath: string) {}

  async exec(args: string[]) {
    return (
      await $`git -C ${path.resolve(this.repoPath)} ${args}`.quiet()
    ).text()
  }

  async revParse(ref: string) {
    return (await this.exec(['rev-parse', ref])).trim()
  }

  async show(ref: string, file: string) {
    return this.exec(['show', `${ref}:${file}`])
  }
}
