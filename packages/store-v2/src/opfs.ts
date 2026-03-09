// OPFS layer — file storage organized by project/document

export interface OpfsHandle {
  listProjects(): Promise<string[]>
  createProject(name: string): Promise<void>
  removeProject(name: string): Promise<void>

  listFiles(project: string): Promise<string[]>
  writeFile(project: string, filename: string, data: File | Blob | ArrayBuffer): Promise<void>
  readFile(project: string, filename: string): Promise<File>
  removeFile(project: string, filename: string): Promise<void>
}

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory()
}

async function getDir(parent: FileSystemDirectoryHandle, name: string, create = false): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create })
}

async function listEntries(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const [name] of (dir as any).entries()) {
    names.push(name)
  }
  return names.sort()
}

async function removeDirRecursive(parent: FileSystemDirectoryHandle, name: string): Promise<void> {
  await (parent as any).removeEntry(name, { recursive: true })
}

export function createOpfs(): OpfsHandle {
  return {
    async listProjects() {
      const root = await getRoot()
      return listEntries(root)
    },

    async createProject(name) {
      const root = await getRoot()
      await getDir(root, name, true)
    },

    async removeProject(name) {
      const root = await getRoot()
      await removeDirRecursive(root, name)
    },

    async listFiles(project) {
      const root = await getRoot()
      const dir = await getDir(root, project)
      return listEntries(dir)
    },

    async writeFile(project, filename, data) {
      const root = await getRoot()
      const dir = await getDir(root, project, true)
      const fileHandle = await dir.getFileHandle(filename, { create: true })
      const writable = await (fileHandle as any).createWritable()
      if (data instanceof File || data instanceof Blob) {
        await writable.write(await data.arrayBuffer())
      } else {
        await writable.write(data)
      }
      await writable.close()
    },

    async readFile(project, filename) {
      const root = await getRoot()
      const dir = await getDir(root, project)
      const fileHandle = await dir.getFileHandle(filename)
      return fileHandle.getFile()
    },

    async removeFile(project, filename) {
      const root = await getRoot()
      const dir = await getDir(root, project)
      await (dir as any).removeEntry(filename)
    },
  }
}
