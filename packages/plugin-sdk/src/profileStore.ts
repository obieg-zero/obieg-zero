import { useState, useCallback } from 'react'
import { getAllPlugins } from './registry.js'

export interface UserProfile { [pluginId: string]: boolean }

let storageKey = 'oz-profile'
let storage: Storage = typeof localStorage !== 'undefined' ? localStorage : (undefined as any)
let deployDefaults: UserProfile = {}
let profileCache: { raw: string | null; result: UserProfile } | null = null

export function configureProfileStore(opts: { storageKey?: string; storage?: Storage; defaults?: UserProfile }): void {
  if (opts.storageKey) storageKey = opts.storageKey
  if (opts.storage) storage = opts.storage
  if (opts.defaults) deployDefaults = opts.defaults
  profileCache = null
}

export function getProfile(): UserProfile {
  const raw = storage?.getItem(storageKey) ?? null
  if (profileCache && profileCache.raw === raw) return profileCache.result

  const defaults: UserProfile = {}
  for (const p of getAllPlugins()) defaults[p.id] = p.defaultEnabled !== false
  const merged = { ...defaults, ...deployDefaults }
  try {
    const result = raw ? { ...merged, ...JSON.parse(raw) } : merged
    profileCache = { raw, result }
    return result
  } catch {
    profileCache = { raw, result: merged }
    return merged
  }
}

export function isPluginEnabled(pluginId: string): boolean {
  const p = getAllPlugins().find(x => x.id === pluginId)
  if (p?.alwaysOn) return true
  return getProfile()[pluginId] !== false
}

export function setPluginEnabled(pluginId: string, enabled: boolean): void {
  const profile = { ...getProfile(), [pluginId]: enabled }
  storage?.setItem(storageKey, JSON.stringify(profile))
  profileCache = null
}

export function useProfile(): [UserProfile, (patch: UserProfile) => void] {
  const [profile, setProfile] = useState(getProfile)
  const update = useCallback((patch: UserProfile) => {
    setProfile(prev => {
      const next = { ...prev, ...patch }
      storage?.setItem(storageKey, JSON.stringify(next))
      profileCache = null
      return next
    })
  }, [])
  return [profile, update]
}
