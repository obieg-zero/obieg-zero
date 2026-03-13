import { useState, useCallback } from 'react'
import { getAllManifests } from './registry.js'

export interface UserProfile { [pluginId: string]: boolean }

let storageKey = 'oz-profile'
let storage: Storage = typeof localStorage !== 'undefined' ? localStorage : (undefined as any)

export function configureProfileStore(opts: { storageKey?: string; storage?: Storage }): void {
  if (opts.storageKey) storageKey = opts.storageKey
  if (opts.storage) storage = opts.storage
}

function buildDefaults(): UserProfile {
  const profile: UserProfile = {}
  for (const m of getAllManifests()) profile[m.id] = m.defaultEnabled !== false
  return profile
}

export function getProfile(): UserProfile {
  const defaults = buildDefaults()
  try {
    const raw = storage?.getItem(storageKey)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch { return defaults }
}

export function isPluginEnabled(pluginId: string): boolean {
  const m = getAllManifests().find(x => x.id === pluginId)
  if (m?.alwaysOn) return true
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
