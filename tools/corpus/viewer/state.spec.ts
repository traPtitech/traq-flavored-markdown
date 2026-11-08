import { expect, test } from 'bun:test'

import { initialViewerState, viewerReducer } from './state.ts'

test('category and review transitions reset the page while retaining the other query dimensions', () => {
  const paged = viewerReducer(initialViewerState, {
    type: 'page',
    page: 3,
    totalPages: 4
  })

  const selected = viewerReducer(paged, { type: 'category', category: 'image' })
  expect(selected.query.page).toBe(1)
  expect(selected.query.category).toBe('image')

  const review = viewerReducer(
    { ...selected, query: { ...selected.query, page: 2 } },
    { type: 'review', only: true }
  )

  expect(review.query).toEqual({ ...selected.query, onlyReview: true, page: 1 })
})

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

  for (const page of [NaN, Infinity, -4]) {
    expect(
      viewerReducer(first, { type: 'page', page, totalPages: 3 }).query.page
    ).toBe(1)
  }

  expect(
    viewerReducer(first, { type: 'page', page: 2.9, totalPages: 3 }).query.page
  ).toBe(2)
})

test('search, profile, and filter changes reset pagination as one state transition', () => {
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
    ignoreWhitespace: false,
    ignoreCase: false,
    ignoreLinkedImages: false,
    ignoreHtmlSerialization: false,
    ignoreKatexErrors: false,
    ignoreLinkPolicy: false,
    ignoreNestedLinks: false,
    excludeBots: false
  })

  state = viewerReducer(state, { type: 'page', page: 2, totalPages: 4 })
  state = viewerReducer(state, { type: 'whitespace', ignore: true })
  expect(state.query.page).toBe(1)
  state = viewerReducer(state, { type: 'page', page: 2, totalPages: 4 })
  state = viewerReducer(state, { type: 'case', ignore: true })
  expect(state.query.page).toBe(1)
  state = viewerReducer(state, { type: 'profile', profile: 'plainText' })
  expect(state.searchDraft).toBe('')

  expect(state.query).toEqual({
    profile: 'plainText',
    search: '',
    page: 1,
    ignoreWhitespace: true,
    ignoreCase: true,
    ignoreLinkedImages: false,
    ignoreHtmlSerialization: false,
    ignoreKatexErrors: false,
    ignoreLinkPolicy: false,
    ignoreNestedLinks: false,
    excludeBots: false
  })
})
