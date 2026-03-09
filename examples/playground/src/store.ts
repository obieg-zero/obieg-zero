import { createOpfs } from '@obieg-zero/store-v2'
import { createStoreDB } from '@obieg-zero/store-v2'
import type { OpfsHandle, StoreDB } from '@obieg-zero/store-v2'

let opfs: OpfsHandle | null = null
let db: StoreDB | null = null

export function getOpfs(): OpfsHandle {
  if (!opfs) opfs = createOpfs()
  return opfs
}

export function getDB(): StoreDB {
  if (!db) db = createStoreDB()
  return db
}
