import { beforeAll, vi } from 'vitest'

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
