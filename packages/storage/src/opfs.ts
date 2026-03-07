import type { NodeDef } from '@obieg-zero/core';

async function getProjectDir(projectId: string): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const projects = await root.getDirectoryHandle('rag-projects', { create: true });
  return projects.getDirectoryHandle(projectId, { create: true });
}

export function opfsUpload(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      const file: File = ctx.get('file');
      if (!projectId || !fileKey || !file) throw new Error('opfsUpload: needs $projectId, $fileKey, $file');

      ctx.progress('Zapisuję plik…');
      const dir = await getProjectDir(projectId);
      const handle = await dir.getFileHandle(fileKey, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      ctx.set('storedFile', { projectId, fileKey, name: file.name, size: file.size });
      ctx.progress('Plik zapisany');
    },
  };
}

export function opfsRead(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      if (!projectId || !fileKey) throw new Error('opfsRead: needs $projectId, $fileKey');

      const dir = await getProjectDir(projectId);
      const handle = await dir.getFileHandle(fileKey);
      const file = await handle.getFile();
      ctx.set('file', file);
    },
  };
}

export function opfsDelete(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      if (!projectId || !fileKey) throw new Error('opfsDelete: needs $projectId, $fileKey');

      const dir = await getProjectDir(projectId);
      await dir.removeEntry(fileKey);
    },
  };
}

export function opfsDeleteProject(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      if (!projectId) throw new Error('opfsDeleteProject: needs $projectId');

      const root = await navigator.storage.getDirectory();
      const projects = await root.getDirectoryHandle('rag-projects');
      await projects.removeEntry(projectId, { recursive: true });
    },
  };
}

export function opfsOpen(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      if (!projectId || !fileKey) throw new Error('opfsOpen: needs $projectId, $fileKey');

      const dir = await getProjectDir(projectId);
      const handle = await dir.getFileHandle(fileKey);
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      ctx.set('fileUrl', url);
      window.open(url, '_blank');
    },
  };
}
