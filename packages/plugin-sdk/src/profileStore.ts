import { useState, useCallback } from 'react'
import { getAllPlugins } from './registry.js'

export interface UserProfile { [pluginId: string]: boolean }

let storageKey = 'oz-profile'
let storage: Storage = typeof localStorage !== 'undefined' ? localStorage : (undefined as any)
let deployDefaults: UserProfile = {}

export function configureProfileStore(opts: { storageKey?: string; storage?: Storage; defaults?: UserProfile }): void {
  if (opts.storageKey) storageKey = opts.storageKey
  if (opts.storage) storage = opts.storage
  if (opts.defaults) deployDefaults = opts.defaults
}

function buildDefaults(): UserProfile {
  const profile: UserProfile = {}
  for (const p of getAllPlugins()) profile[p.id] = p.defaultEnabled !== false
  return profile
}

export function getProfile(): UserProfile {
  const defaults = { ...buildDefaults(), ...deployDefaults }
  try {
    const raw = storage?.getItem(storageKey)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch { return defaults }
}

export function isPluginEnabled(pluginId: string): boolean {
  const p = getAllPlugins().find(x => x.id === pluginId)
  if (p?.alwaysOn) return true
  return getProfile()[pluginId] !== false
}

export function setPluginEnabled(pluginId: string, enabled: boolean): void {
  const profile = { ...getProfile(), [pluginId]: enabled }
  storage?.setItem(storageKey, JSON.stringify(profile))
}

export function useProfile(): [UserProfile, (patch: UserProfile) => void] {
  const [profile, setProfile] = useState(getProfile)
  const update = useCallback((patch: UserProfile) => {
    setProfile(prev => {
      const next = { ...prev, ...patch }
      storage?.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }, [])
  return [profile, update]
}

export function resetProfileStore(): void {
  storageKey = 'oz-profile'
}
