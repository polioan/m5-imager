import React from 'react'
import ReactDOM from 'react-dom/client'
import log from 'electron-log'
import { App } from './app'

const selector = '#root'

const root = document.querySelector(selector)

if (root) {
  log.info(`Found selector ${selector}`)
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  log.info('Rendered')
} else {
  log.error(`Can't find selector ${selector}`)
}
