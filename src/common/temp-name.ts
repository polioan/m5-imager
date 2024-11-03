import os from 'node:os'
import path from 'node:path'
import { v4 as uuid } from 'uuid'

export function tempName() {
  return `temp${uuid().replaceAll('-', '')}`
}

export const tempRootName = tempName()

export const tempRoot = path.join(os.tmpdir(), tempRootName)
