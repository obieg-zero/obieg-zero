import type { BlockDef } from './types'
import { opfs } from './types'

export const uploadBlock: BlockDef = {
  type: 'upload',
  label: 'Upload',
  color: '#6366f1',
  fields: [{ key: 'project', label: 'Projekt', default: 'default' }],
  defaults: { project: 'default' },
  async run(config, ctx, log) {
    const project = config.project || 'default'
    await opfs.createProject(project).catch(() => {})

    const files: File[] = (window as any).__miniCtxFiles || []
    if (files.length === 0) { log('Brak plikow — wybierz pliki w karcie Upload'); return }
    delete (window as any).__miniCtxFiles

    for (const file of files) {
      await opfs.writeFile(project, file.name, file)
      log(`Zapisano ${file.name} → OPFS/${project}/`)
    }
    ctx.data.project = project
    log(`Upload: ${files.length} plikow → OPFS/${project}/`)
  },
}
