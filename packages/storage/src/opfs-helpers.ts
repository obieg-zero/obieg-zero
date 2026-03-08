export async function getProjectDir(projectId: string, rootDir = 'obieg-zero'): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const projects = await root.getDirectoryHandle(rootDir, { create: true });
  return projects.getDirectoryHandle(projectId, { create: true });
}
