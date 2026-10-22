export type Task = {
  dependencies: readonly string[]
  run: () => Promise<unknown>
}

/** Execute each prerequisite once, fail on unknown edges/cycles, and preserve order. */
export async function runTasks(
  tasks: ReadonlyMap<string, Task>,
  targets: readonly string[]
) {
  const complete = new Set<string>()
  const active = new Set<string>()
  async function visit(name: string): Promise<void> {
    if (complete.has(name)) return
    if (active.has(name))
      throw new Error('Build task cycle: ' + [...active, name].join(' -> '))
    const task = tasks.get(name)
    if (!task) throw new Error('Unknown build task: ' + name)
    active.add(name)
    for (const dependency of task.dependencies) await visit(dependency)
    await task.run()
    active.delete(name)
    complete.add(name)
  }
  for (const target of targets) await visit(target)
}
