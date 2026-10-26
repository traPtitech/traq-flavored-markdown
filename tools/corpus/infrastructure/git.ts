import path from 'path'

import { captureProcess } from '../../workspace/infrastructure/process.ts'

export class GitRepo {
  constructor(public repoPath: string) {}

  async exec(args: string[]) {
    return captureProcess('git', args, path.resolve(this.repoPath))
  }

  async revParse(ref: string) {
    return (await this.exec(['rev-parse', ref])).trim()
  }

  async show(ref: string, file: string) {
    return this.exec(['show', `${ref}:${file}`])
  }
}
