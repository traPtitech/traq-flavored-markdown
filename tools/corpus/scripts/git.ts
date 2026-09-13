import path from 'path'

import { $ } from 'bun'

export class GitRepo {
  constructor(public repoPath: string) {}

  async exec(args: string[]) {
    return (await $`git -C ${path.resolve(this.repoPath)} ${args}`.quiet())
      .text()
      .trim()
  }

  async revParse(ref: string) {
    return this.exec(['rev-parse', ref])
  }

  async show(ref: string, file: string) {
    return (await this.exec(['show', `${ref}:${file}`])) + '\n'
  }
}
