// Hooks
export { addFilter, applyFilters, addAction, doAction, resetHooks } from './hooks.js'

// Registry
export { registerManifest, markReady, getAllManifests, getManifest, getAllPlugins, isReady, resetRegistry } from './registry.js'

// Profile
export { configureProfileStore, getProfile, isPluginEnabled, setPluginEnabled, useProfile, resetProfileStore } from './profileStore.js'
export type { UserProfile } from './profileStore.js'

// Contracts
export { registerProvider, getProvider, resetContracts } from './contracts.js'

// Installer (OPFS-based: install, load, manage)
export { installFromGitHub, installFromZip, installFromUrl, listInstalled, uninstallPlugin, loadInstalledPlugins } from './installer.js'

// Types
export type { SdkAPI, PluginManifestData, PluginManifest, ExternalPluginEntry, PluginFactory, LayoutSlots, RouteEntry, NavItem, HostAPI, PluginDeps } from './types.js'
