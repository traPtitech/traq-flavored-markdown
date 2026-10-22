export const suites = {
  unit: {
    timeout: 5000,
    resources:
      'JavaScript and local test fixtures; no parser Wasm or Go process',
    include: [
      'packages/core/typescript/tests/**/*.spec.ts',
      'packages/plugins/*/typescript/tests/**/*.spec.ts',
      'packages/sdk/typescript/tests/unit/**/*.spec.ts',
      'packages/sdk/scripts/{contract-identity,generation}.spec.ts',
      'scripts/{build,checks,testing,workspace,release}/**/*.spec.ts',
      'scripts/release.spec.ts',
      'scripts/codegen/{generation,ir,manifest,output-manifest}.spec.ts'
    ]
  },
  assembly: {
    timeout: 30000,
    resources: 'Built TypeScript packages, exported contracts, Sass',
    include: [
      'packages/sdk/scripts/styles.spec.ts',
      'packages/sdk/typescript/tests/bindings.spec.ts'
    ]
  },
  codegen: {
    timeout: 60000,
    resources: 'Go compiler and generated temporary modules; run serially',
    include: [
      'scripts/codegen/{go-contract,contract-integers,contract-unions}.spec.ts'
    ]
  },
  workspace: {
    timeout: 60000,
    resources: 'Go module commands and temporary workspaces; run serially',
    include: ['scripts/{package-graph,release-go}.spec.ts']
  },
  wasm: {
    timeout: 30000,
    resources: 'Fresh bundled/parser Wasm and built SDK; run serially',
    include: [
      'packages/sdk/scripts/wasm-contract.spec.ts',
      'packages/sdk/typescript/tests/**/*.spec.ts'
    ],
    exclude: [
      'packages/sdk/typescript/tests/unit/**/*.spec.ts',
      'packages/sdk/typescript/tests/bindings.spec.ts'
    ]
  }
} as const
export type SuiteName = keyof typeof suites

export type SuitePatterns = {
  include: readonly string[]
  exclude?: readonly string[]
}

export function suiteFor<Name extends string = SuiteName>(
  file: string,
  definitions: Readonly<Record<Name, SuitePatterns>> = suites as Readonly<
    Record<Name, SuitePatterns>
  >
): Name {
  const name = file.replaceAll('\\', '/')
  const matches = (pattern: string) => new Bun.Glob(pattern).match(name)
  const selected = (Object.entries(definitions) as [Name, SuitePatterns][])
    .filter(
      ([, suite]) =>
        suite.include.some(matches) && !suite.exclude?.some(matches)
    )
    .map(([suite]) => suite)
  if (!selected.length) throw new Error(`Test has no resource suite: ${name}`)
  if (selected.length !== 1)
    throw new Error(
      `Test belongs to multiple resource suites: ${name}: ${selected.join(', ')}`
    )
  return selected[0]
}
