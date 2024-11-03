import path from 'node:path'

export function resolveExePath(name: string) {
  if (process.env.NODE_ENV === 'development') {
    return path.resolve(`./${name}.exe`)
  }
  return path.resolve(`./resources/${name}.exe`)
}
