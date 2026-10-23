import { expect, test } from 'bun:test'

import { initialViewerState, viewerReducer } from './state.ts'

test('out-of-range page input becomes the navigation state, not only the displayed result', () => {
  const first = viewerReducer(initialViewerState, {
    type: 'page',
    page: 99,
    totalPages: 1
  })
  expect(first.query.page).toBe(1)
  expect(
    viewerReducer(first, {
      type: 'page',
      page: first.query.page - 1,
      totalPages: 1
    }).query.page
  ).toBe(1)
  for (const page of [NaN, Infinity, -4])
    expect(
      viewerReducer(first, { type: 'page', page, totalPages: 3 }).query.page
    ).toBe(1)
  expect(
    viewerReducer(first, { type: 'page', page: 2.9, totalPages: 3 }).query.page
  ).toBe(2)
})

test('search, profile, and whitespace changes reset pagination as one state transition', () => {
  let state = viewerReducer(initialViewerState, {
    type: 'page',
    page: 3,
    totalPages: 4
  })
  state = viewerReducer(state, { type: 'draft', text: 'find me' })
  expect(state.query.search).toBe('')
  expect(state.query.page).toBe(3)
  state = viewerReducer(state, { type: 'search' })
  expect(state.query).toEqual({
    profile: 'render',
    search: 'find me',
    page: 1,
    ignoreWhitespace: false
  })
  state = viewerReducer(state, { type: 'page', page: 2, totalPages: 4 })
  state = viewerReducer(state, { type: 'whitespace', ignore: true })
  expect(state.query.page).toBe(1)
  state = viewerReducer(state, { type: 'profile', profile: 'plainText' })
  expect(state.searchDraft).toBe('')
  expect(state.query).toEqual({
    profile: 'plainText',
    search: '',
    page: 1,
    ignoreWhitespace: true
  })
})
