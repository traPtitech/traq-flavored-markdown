import { expect, test } from 'bun:test'

import { type Task, runTasks } from './tasks.ts'

test('build tasks prepare shared prerequisites exactly once and detect cycles', async () => {
  const completed: string[] = []
  const tasks = new Map<string, Task>([
    [
      'contracts',
      {
        dependencies: [],
        run: async () => {
          completed.push('contracts')
        }
      }
    ],
    [
      'ts',
      {
        dependencies: ['contracts'],
        run: async () => {
          completed.push('ts')
        }
      }
    ],
    [
      'wasm',
      {
        dependencies: ['contracts'],
        run: async () => {
          completed.push('wasm')
        }
      }
    ]
  ])
  await runTasks(tasks, ['ts', 'wasm'])
  expect(completed).toEqual(['contracts', 'ts', 'wasm'])
  tasks.set('contracts', { dependencies: ['ts'], run: async () => {} })
  await expect(runTasks(tasks, ['ts'])).rejects.toThrow('cycle')
})
