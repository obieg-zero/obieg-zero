import type { NodeDef } from '@obieg-zero/core';

async function getProjectDir(projectId: string, rootDir = 'obieg-zero'): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const projects = await root.getDirectoryHandle(rootDir, { create: true });
  return projects.getDirectoryHandle(projectId, { create: true });
}

export function opfsUpload(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      const file: File = ctx.get('file');
      if (!projectId || !fileKey || !file) throw new Error('opfsUpload: needs $projectId, $fileKey, $file');

      ctx.progress('Saving file…');
      const dir = await getProjectDir(projectId, ctx.get('opfsRoot'));
      const handle = await dir.getFileHandle(fileKey, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      ctx.set('storedFile', { projectId, fileKey, name: file.name, size: file.size });
      ctx.progress('File saved');
    },
  };
}

export function opfsRead(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      if (!projectId || !fileKey) throw new Error('opfsRead: needs $projectId, $fileKey');

      const dir = await getProjectDir(projectId, ctx.get('opfsRoot'));
      try {
        const handle = await dir.getFileHandle(fileKey);
        ctx.set('file', await handle.getFile());
      } catch {
        throw new Error(`opfsRead: file "${fileKey}" not found in project "${projectId}"`);
      }
    },
  };
}

export function opfsDelete(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      if (!projectId || !fileKey) throw new Error('opfsDelete: needs $projectId, $fileKey');

      const dir = await getProjectDir(projectId, ctx.get('opfsRoot'));
      try { await dir.removeEntry(fileKey); }
      catch { throw new Error(`opfsDelete: file "${fileKey}" not found in project "${projectId}"`); }
    },
  };
}

export function opfsDeleteProject(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      if (!projectId) throw new Error('opfsDeleteProject: needs $projectId');

      try {
        const root = await navigator.storage.getDirectory();
        const projects = await root.getDirectoryHandle(ctx.get('opfsRoot') ?? 'obieg-zero');
        await projects.removeEntry(projectId, { recursive: true });
      } catch {
        throw new Error(`opfsDeleteProject: project "${projectId}" not found`);
      }
    },
  };
}

export function opfsOpen(): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      const fileKey: string = ctx.get('fileKey');
      if (!projectId || !fileKey) throw new Error('opfsOpen: needs $projectId, $fileKey');

      const dir = await getProjectDir(projectId, ctx.get('opfsRoot'));
      const handle = await dir.getFileHandle(fileKey);
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      ctx.set('fileUrl', url);
      window.open(url, '_blank');
      const revoke = ctx.get('revokeTimeout') ?? 60_000;
      setTimeout(() => URL.revokeObjectURL(url), revoke);
    },
  };
}
