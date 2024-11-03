import { openFileDialog } from './helpers/open-file-dialog'
import log from 'electron-log'
import sharp from 'sharp'
import {
  boards,
  screenHeight,
  screenWidth,
  unknownError,
} from '../common/constants'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { ToastContainer, toast } from 'react-toastify'
import { useState } from 'react'
import { licenses } from '../common/licenses'
import path from 'node:path'
import { tempName, tempRootName, tempRoot } from '../common/temp-name'
import { resolveExePath } from '../common/resolve-exe-path'
import 'react-toastify/ReactToastify.min.css'
import './index.css'

export function App() {
  const [images, setImages] = useState<{ path: string; name: string }[]>([])

  const [showLicenses, setShowLicenses] = useState(false)

  const [isLoading, setIsLoading] = useState(false)

  const [boardToCompile, setBoardToCompile] = useState<
    (typeof boards)[number]['value']
  >(boards[0].value)

  async function onChoose() {
    try {
      setIsLoading(true)

      const [file] = await openFileDialog({
        multiple: false,
        accept: 'image/png',
      })

      if (!file) {
        log.warn('No file selected')
        toast.warn('No file selected')
        return
      }

      log.info('File ready to processing', file.name)

      const buffer = await file.arrayBuffer()

      const metadata = await sharp(buffer).metadata()

      if (metadata.width !== screenWidth || metadata.height !== screenHeight) {
        const message = `Image ${file.name} has invalid dimensions ${metadata.width ?? 0}x${metadata.height ?? 0} instead of ${screenWidth}x${screenHeight}`
        log.error(message)
        toast.error(message)
        return
      }

      await fs.mkdir(tempRoot, { recursive: true })

      const toWrite = path.join(tempRoot, `${tempName()}.png`)

      await sharp(buffer).toFile(toWrite)

      log.info('File saved to', toWrite)

      setImages([...images, { path: toWrite, name: file.name }])
    } catch (error) {
      log.error(error)
      toast.error(error instanceof Error ? error.message : unknownError)
    } finally {
      setIsLoading(false)
    }
  }

  function onLicenses() {
    setShowLicenses(showLicenses => {
      return !showLicenses
    })
  }

  async function onCompile() {
    async function createHeaders(files: string[]) {
      await fs.mkdir(tempRoot, { recursive: true })

      const result = await Promise.all(
        files.map(f => {
          return new Promise<string>((resolve, reject) => {
            const toWrite = path.join(
              tempRoot,
              path.parse(f).base.replace('.png', '.c')
            )

            log.info('Will write header to', toWrite)

            const exeProcess = spawn(
              resolveExePath('UTFTConverter'),
              [path.parse(f).base, '/c'],
              { cwd: tempRoot }
            )

            exeProcess.stdout.on('data', data => {
              log.info('Data from UTFTConverter', String(data))
            })

            exeProcess.stderr.on('data', data => {
              log.error('Error from UTFTConverter', String(data))
            })

            exeProcess.on('error', error => {
              reject(error)
            })

            exeProcess.on('close', code => {
              if (code === 0) {
                resolve(toWrite)
              } else {
                reject(
                  new Error(
                    `UTFTConverter closed unexpectedly with code ${code}`
                  )
                )
              }
            })
          })
        })
      )
      return result
    }

    async function normalizeHeaders(files: string[]) {
      const result = await Promise.all(
        files.map(async f => {
          const toWrite = `${path.parse(f).dir}${path.sep}${path.parse(f).base.replace('.c', '.h')}`

          log.info('Will write normalized header to', toWrite)

          const header = await fs.readFile(f, { encoding: 'utf8' })

          await fs.rm(f, { force: true })

          await fs.writeFile(
            toWrite,
            header.replace(
              '#include <avr/pgmspace.h>',
              `
#if defined(__AVR__)
#include<avr/pgmspace.h>
#elif defined(__PIC32MX__)
#define PROGMEM
#elif defined(__arm__)
#define PROGMEM
#endif
              `
            ),
            { encoding: 'utf8' }
          )

          return toWrite
        })
      )
      return result
    }

    async function createIno(files: string[]) {
      await fs.mkdir(tempRoot, { recursive: true })

      const toWrite = path.join(tempRoot, `${tempRootName}.ino`)

      log.info('Will write ino source to', toWrite)

      const source = `
${files
  .map(file => {
    return `#include "${path.parse(file).base}"`
  })
  .join('\n')}

#if defined(ARDUINO_M5STACK_STICKC_PLUS)
#include <M5StickCPlus.h>
#endif

#if defined(ARDUINO_M5STACK_STICKC_PLUS2)
#include <M5StickCPlus2.h>
#endif

#if defined(ARDUINO_M5STACK_CARDPUTER)
#include <M5Cardputer.h>
#endif

volatile int8_t stage = 0;
volatile bool shouldUpdate = true;

const std::array<const unsigned short*, ${files.length}> images = { ${files
        .map(file => {
          return path.parse(file).base.replace('.h', '')
        })
        .join(',')} };

void setup() {
#if defined(ARDUINO_M5STACK_STICKC_PLUS) || defined(ARDUINO_M5STACK_STICKC_PLUS2)
  M5.begin();
#endif

#if defined(ARDUINO_M5STACK_CARDPUTER)
  auto cfg = M5.config();
  M5Cardputer.begin(cfg, true);
#endif

  M5.Lcd.begin();
  M5.Lcd.setSwapBytes(true);
}

void draw(const unsigned short* image) {
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setRotation(0);
  M5.Lcd.pushImage(0, 0, M5.Lcd.width(), M5.Lcd.height(), image);
  shouldUpdate = false;
}

void nextStage() {
  stage++;
  if (stage == images.size()) {
    stage = 0;
  }
  shouldUpdate = true;
}

#if defined(ARDUINO_M5STACK_CARDPUTER)
void previousStage() {
  stage--;
  if (stage == -1) {
    stage = images.size() - 1;
  }
  shouldUpdate = true;
}
#endif

void loop() {
#if defined(ARDUINO_M5STACK_STICKC_PLUS) || defined(ARDUINO_M5STACK_STICKC_PLUS2)
  M5.update();
#endif

#if defined(ARDUINO_M5STACK_CARDPUTER)
  M5Cardputer.update();
#endif

  if (shouldUpdate) {
    draw(images[stage]);
  }

  if (M5.BtnA.wasReleased()) {
    nextStage();
  }

#if defined(ARDUINO_M5STACK_CARDPUTER)
  if (M5Cardputer.Keyboard.isChange()) {
    if (M5Cardputer.Keyboard.isPressed()) {
      if (M5Cardputer.Keyboard.isKeyPressed(',')) {
        previousStage();
      }
      if (M5Cardputer.Keyboard.isKeyPressed('/')) {
        nextStage();
      }
    }
  }
#endif
}
      `

      await fs.writeFile(toWrite, source, { encoding: 'utf8' })

      return toWrite
    }

    async function runArduinoCli(flags: string[]) {
      await new Promise<void>((resolve, reject) => {
        const exeProcess = spawn(resolveExePath('arduino-cli'), flags)

        exeProcess.stdout.on('data', data => {
          log.info('Data from arduino-cli', String(data))
        })

        exeProcess.stderr.on('data', data => {
          log.error('Error from arduino-cli', String(data))
        })

        exeProcess.on('error', error => {
          reject(error)
        })

        exeProcess.on('close', code => {
          if (code === 0) {
            resolve()
          } else {
            reject(
              new Error(`arduino-cli closed unexpectedly with code ${code}`)
            )
          }
        })
      })
    }

    async function installDependencies() {
      await runArduinoCli([
        'core',
        'install',
        'm5stack:esp32',
        '--additional-urls',
        'https://m5stack.oss-cn-shenzhen.aliyuncs.com/resource/arduino/package_m5stack_index.json',
        '--log-level',
        'warn',
        '--verbose',
      ])

      await runArduinoCli([
        'lib',
        'install',
        'M5Cardputer',
        '--log-level',
        'warn',
        '--verbose',
      ])

      await runArduinoCli([
        'lib',
        'install',
        'M5StickCPlus2',
        '--log-level',
        'warn',
        '--verbose',
      ])

      await runArduinoCli([
        'lib',
        'install',
        'M5StickCPlus',
        '--log-level',
        'warn',
        '--verbose',
      ])
    }

    async function compile(ino: string) {
      log.info(`Will compile ${boardToCompile} from ${ino}`)

      await runArduinoCli([
        'compile',
        '--fqbn',
        boardToCompile,
        '-e',
        '--build-property',
        'build.partitions=huge_app',
        '--build-property',
        'upload.maximum_size=3145728',
        '--log-level',
        'warn',
        '--verbose',
        '--output-dir',
        tempRoot,
        ino,
      ])
    }

    async function finalize() {
      await new Promise<void>((resolve, reject) => {
        const isCardputer = boardToCompile === 'm5stack:esp32:m5stack_cardputer'

        const exeProcess = spawn(resolveExePath('esptool'), [
          '--chip',
          isCardputer ? 'esp32s3' : 'esp32',
          'merge_bin',
          '--output',
          path.join(process.env.PORTABLE_EXECUTABLE_DIR ?? '.', 'firmware.bin'),
          isCardputer ? '0x0000' : '0x1000',
          path.join(tempRoot, `${tempRootName}.ino.bootloader.bin`),
          '0x8000',
          path.join(tempRoot, `${tempRootName}.ino.partitions.bin`),
          '0x10000',
          path.join(tempRoot, `${tempRootName}.ino.bin`),
        ])

        exeProcess.stdout.on('data', data => {
          log.info('Data from esptool', String(data))
        })

        exeProcess.stderr.on('data', data => {
          log.error('Error from esptool', String(data))
        })

        exeProcess.on('error', error => {
          reject(error)
        })

        exeProcess.on('close', code => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`esptool closed unexpectedly with code ${code}`))
          }
        })
      })
    }

    try {
      setIsLoading(true)

      const files = images.map(image => {
        return image.path
      })
      const headers = await createHeaders(files)
      toast.info('Headers created!')
      const normalizedHeaders = await normalizeHeaders(headers)
      toast.info('Headers normalized!')
      const ino = await createIno(normalizedHeaders)
      toast.info('Ino file created!')
      await installDependencies()
      toast.info('Dependencies installed!')
      await compile(ino)
      toast.info('Compilation done!')
      await finalize()
      toast.success('Done! The firmware file is located next to the program')
    } catch (error) {
      log.error(error)
      toast.error(error instanceof Error ? error.message : unknownError)
    } finally {
      setIsLoading(false)
    }
  }

  function onSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    setBoardToCompile(event.target.value as (typeof boards)[number]['value'])
  }

  const hasImages = images.length > 0

  return (
    <>
      <div className='controls-container'>
        <button onClick={onChoose} disabled={isLoading}>
          Choose image
        </button>
        <button onClick={onLicenses}>Licenses</button>
        {hasImages ? (
          <button onClick={onCompile} disabled={isLoading}>
            Compile
          </button>
        ) : null}
        {hasImages ? (
          <select disabled={isLoading} onChange={onSelect}>
            {boards.map(board => {
              return (
                <option value={board.value} key={board.value}>
                  {board.name}
                </option>
              )
            })}
          </select>
        ) : null}
      </div>
      {showLicenses ? (
        <div className='licenses-container'>
          <code>
            <pre>{`Thanks to\n\n${licenses}\n\nAnd also for all my dependencies!`}</pre>
          </code>
        </div>
      ) : null}
      <div className='images-container'>
        {images.map(image => {
          return (
            <div key={image.path}>
              <img src={image.path} alt={image.name} />
            </div>
          )
        })}
      </div>
      <ToastContainer
        closeOnClick
        pauseOnFocusLoss={false}
        pauseOnHover={false}
        rtl={false}
        autoClose={6500}
        newestOnTop
        draggable={false}
        hideProgressBar={false}
        limit={100}
      />
    </>
  )
}
