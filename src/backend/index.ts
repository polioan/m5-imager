import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Window } from 'happy-dom'

log.initialize()

log.info('App started')

app
  .whenReady()
  .then(async () => {
    log.info('App ready')

    const window = new Window()

    const toLoad = path.join(import.meta.dirname, './index.html')

    window.document.write(await fs.readFile(toLoad, { encoding: 'utf8' }))

    const { title } = window.document

    window.document.close()
    window.close()

    const win = new BrowserWindow({
      autoHideMenuBar: true,
      width: 800,
      height: 600,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      frame: true,
      title,
      show: false,
    })

    log.info('App window created')

    await win.loadFile(toLoad)

    log.info('App window HTML loaded')

    win.once('ready-to-show', () => {
      log.info('App window ready to show')
      win.show()
    })
  })
  .catch(error => {
    log.error('Error in promise when starting app', error)
  })
