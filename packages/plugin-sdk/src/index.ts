// Hooks
export { addAction, doAction, resetHooks } from './hooks.js'

// Registry
export { registerPlugin, markReady, getAllPlugins, getPlugin, isReady, resetRegistry } from './registry.js'

// Profile
export { configureProfileStore, getProfile, isPluginEnabled, setPluginEnabled, useProfile, resetProfileStore } from './profileStore.js'
export type { UserProfile } from './profileStore.js'

// Contracts
export { registerProvider, getProvider, resetContracts } from './contracts.js'

// Installer
export { installFromGitHub, installFromZip, installFromUrl, listInstalled, uninstallPlugin, loadInstalledPlugins } from './installer.js'

// Types
export type { PluginDef, PluginManifest, PluginFactory, HostAPI, PluginDeps } from './types.js'
