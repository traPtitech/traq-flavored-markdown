import React from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
// @ts-expect-error Typescript doesn't know about CSS imports
import './viewer.css'

const root = document.getElementById('root')!
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
