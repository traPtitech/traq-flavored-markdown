import React from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { bootstrapReport } from './data/bootstrap.ts'
// @ts-expect-error Typescript doesn't know about CSS imports
import './viewer.css'

const bootstrap = bootstrapReport(document)

const root = document.getElementById('root')!
createRoot(root).render(
  <React.StrictMode>
    <App bootstrap={bootstrap} />
  </React.StrictMode>
)
