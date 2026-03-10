export interface OpfsHandle {
  listProjects(): Promise<string[]>
  createProject(name: string): Promise<void>
  removeProject(name: string): Promise<void>
  listFiles(project: string): Promise<string[]>
  writeFile(project: string, filename: string, data: File | Blob | ArrayBuffer): Promise<void>
  readFile(project: string, filename: string): Promise<File>
  removeFile(project: string, filename: string): Promise<void>
}

async function entries(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const [name] of (dir as any).entries()) names.push(name)
  return names.sort()
}

export function createOpfs(): OpfsHandle {
  return {
    async listProjects() {
      return entries(await navigator.storage.getDirectory())
    },

    async createProject(name) {
      const root = await navigator.storage.getDirectory()
      await root.getDirectoryHandle(name, { create: true })
    },

    async removeProject(name) {
      const root = await navigator.storage.getDirectory()
      await (root as any).removeEntry(name, { recursive: true })
    },

    async listFiles(project) {
      const root = await navigator.storage.getDirectory()
      return entries(await root.getDirectoryHandle(project))
    },

    async writeFile(project, filename, data) {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle(project, { create: true })
      const fh = await dir.getFileHandle(filename, { create: true })
      const w = await (fh as any).createWritable()
      await w.write(data instanceof File || data instanceof Blob ? await data.arrayBuffer() : data)
      await w.close()
    },

    async readFile(project, filename) {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle(project)
      return (await dir.getFileHandle(filename)).getFile()
    },

    async removeFile(project, filename) {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle(project)
      await (dir as any).removeEntry(filename)
    },
  }
}
