import packageJson from './package.json' with { type: 'json' }
import electronBuilder from 'electron-builder'
import { rimraf } from 'rimraf'
import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import Mustache from 'mustache'
import { rollup } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
import postcss from 'rollup-plugin-postcss'
import cssnano from 'cssnano'

const src = 'src'

const out = 'dist'

const electronOut = 'dist-electron'

const productName = packageJson.name.replaceAll('-', ' ')

const executables = (await fs.readdir('.', { encoding: 'utf-8' })).filter(
  name => {
    return name.endsWith('.exe')
  }
)

async function task(name: string, fn: () => void | Promise<void>) {
  try {
    console.log(`Running task ${name}...`)
    await fn()
    console.log(`Task ${name} completed`)
  } catch (error) {
    console.error(`Task ${name} failed`)
    console.error(error)
    process.exit(1)
  }
}

await Promise.all([
  task('clean-out', async () => {
    await rimraf(`./${out}`)
  }),
  task('clean-electron', async () => {
    await rimraf(`./${electronOut}`)
  }),
])

await task('create-out', async () => {
  await fs.mkdir(`./${out}`)
})

await Promise.all([
  task('build-backend', async () => {
    const bundle = await rollup({
      input: `./${src}/backend/index.ts`,
      plugins: [
        typescript({
          tsconfig: './tsconfig.json',
        }),
        {
          name: 'preserve-extensions',
          resolveId(source, _, options) {
            if (options.isEntry) {
              return null
            }
            if (source.startsWith('node:')) {
              return {
                id: source.replace('node:', ''),
                external: true,
              }
            }
            if (source.includes('/')) {
              return {
                id: `${source}.js`,
                external: true,
              }
            }
            return null
          },
        },
      ],
    })

    await bundle.write({
      dir: `./${out}`,
      format: 'esm',
    })

    await bundle.close()
  }),
  task('build-frontend', async () => {
    const bundle = await rollup({
      input: `./${src}/frontend/index.tsx`,
      external: ['sharp'],
      plugins: [
        typescript({
          tsconfig: './tsconfig.json',
        }),
        {
          name: 'strip-node-prefix',
          resolveId(source) {
            if (source.startsWith('node:')) {
              return {
                id: source.replace('node:', ''),
                external: true,
              }
            }
            return null
          },
        },
        replace({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
          preventAssignment: true,
        }),
        postcss({
          plugins: [cssnano({})],
          extract: 'index.css',
        }),
        commonjs({}),
        json({}),
        resolve({}),
        terser({
          output: {
            comments: false,
          },
        }),
      ],
    })

    await bundle.write({
      file: `./${out}/react.js`,
      format: 'cjs',
      strict: false,
    })

    await bundle.close()
  }),
  task('build-html', async () => {
    const html = await fs.readFile(`./${src}/frontend/index.html`, {
      encoding: 'utf8',
    })
    const rendered = Mustache.render(html, {
      title: productName,
      script: './react.js',
      style: './index.css',
    })
    await fs.writeFile(`./${out}/index.html`, rendered, {
      encoding: 'utf8',
    })
  }),
])

if (process.env.NODE_ENV === 'development') {
  await task('start', () => {
    execSync('electron .', { stdio: 'inherit' })
  })
} else {
  await task('build-electron', async () => {
    await electronBuilder.build({
      targets: electronBuilder.Platform.WINDOWS.createTarget(),
      config: {
        appId: `com.${new URL(packageJson.author.url).pathname.replaceAll('/', '')}.${packageJson.name.replaceAll('-', '')}`,
        asar: {
          smartUnpack: true,
        },
        productName,
        publish: null,
        compression: 'normal',
        extends: null,
        copyright: `Copyright © 2024 ${packageJson.author.name}`,
        files: [out],
        extraResources: executables.map(executable => {
          return {
            from: `./${executable}`,
            to: '.',
          }
        }),
        buildVersion: packageJson.version,
        directories: {
          output: electronOut,
        },
        removePackageKeywords: false,
        removePackageScripts: true,
        win: {
          target: {
            target: 'portable',
            arch: ['x64'],
          },
          icon: './icon.ico',
          executableName: productName,
        },
        portable: {
          unicode: true,
          warningsAsErrors: true,
          useZip: false,
          unpackDirName: productName,
        },
      },
    })
  })
}
