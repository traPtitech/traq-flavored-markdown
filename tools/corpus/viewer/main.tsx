import React from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { ReportRepository, readEmbeddedReport } from './data/repository.ts'
// @ts-expect-error Typescript doesn't know about CSS imports
import './viewer.css'

let repository: ReportRepository | null = null
try {
  repository = new ReportRepository(readEmbeddedReport(document))
} catch {
  /* Render the loading error. */
}

const root = document.getElementById('root')!
createRoot(root).render(
  <React.StrictMode>
    <App repository={repository} />
  </React.StrictMode>
)
