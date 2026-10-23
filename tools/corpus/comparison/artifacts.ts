import path from 'node:path'

import { packageRoot, repositoryRoot, sdkRoot } from '../../workspace/paths.ts'
import { fingerprintFiles, sha256 } from '../infrastructure/files.ts'
import { artifactSchema } from '../protocol/comparison.ts'
import { type Infer, parse } from '../protocol/schema.ts'

export async function candidateArtifacts(
  wasm: string,
  candidateDirectory = path.join(sdkRoot, 'dist')
): Promise<Infer<typeof artifactSchema>> {
  const metadata = await Bun.file(
    path.join(candidateDirectory, 'contract.json')
  ).json()
  const wasmSha256 = await sha256(wasm)
  if (metadata.sha256 !== wasmSha256)
    throw new Error(
      'Candidate Wasm does not match its artifact manifest; rebuild the SDK'
    )
  const roots = (
    [
      'core',
      'commonmark-plugin',
      'extensions-plugin',
      'traq-plugin',
      'sdk'
    ] as const
  ).map(owner => path.join(packageRoot(owner), 'dist'))
  const files = roots.flatMap(root =>
    [...new Bun.Glob('**/*.js').scanSync({ cwd: root, onlyFiles: true })].map(
      file => path.relative(repositoryRoot, path.join(root, file))
    )
  )
  if (!files.length)
    throw new Error('Build the candidate TypeScript packages before comparison')
  return parse(artifactSchema, {
    wasmSha256,
    javascriptSha256: await fingerprintFiles(repositoryRoot, files),
    contractId: metadata.contractId,
    sourceFingerprint: metadata.provenance?.sourceFingerprint
  })
}
