export const suites = {
  unit: {
    timeout: 5000,
    resources:
      'JavaScript and local test fixtures; no parser Wasm or Go process'
  },
  assembly: {
    timeout: 30000,
    resources: 'Built TypeScript packages, exported contracts, Sass'
  },
  codegen: {
    timeout: 60000,
    resources: 'Go compiler and generated temporary modules; run serially'
  },
  workspace: {
    timeout: 60000,
    resources: 'Go module commands and temporary workspaces; run serially'
  },
  wasm: {
    timeout: 30000,
    resources: 'Fresh bundled/parser Wasm and built SDK; run serially'
  }
} as const
export type SuiteName = keyof typeof suites

export function suiteFor(file: string): SuiteName {
  const name = file.replaceAll('\\', '/')
  if (
    name === 'scripts/package-graph.spec.ts' ||
    name === 'scripts/release-go.spec.ts'
  )
    return 'workspace'
  if (
    /scripts\/codegen\/(go-contract|contract-integers|contract-unions)\.spec\.ts$/.test(
      name
    )
  )
    return 'codegen'
  if (
    name.endsWith('/scripts/styles.spec.ts') ||
    name.endsWith('/typescript/tests/bindings.spec.ts')
  )
    return 'assembly'
  if (name.endsWith('/scripts/wasm-contract.spec.ts')) return 'wasm'
  if (
    name.startsWith('packages/sdk/typescript/tests/') &&
    !name.includes('/tests/unit/')
  )
    return 'wasm'
  return 'unit'
}
