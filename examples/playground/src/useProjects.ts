import { useState, useEffect, useCallback } from 'react'
import type { ProjectRecord, DocumentRecord } from '@obieg-zero/store-v2'
import { opfs, db } from './store.ts'

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])

  const refresh = useCallback(async () => {
    const list = await db.listProjects()
    setProjects(list)
  }, [])

  const refreshDocs = useCallback(async (projectId: string) => {
    const docs = await db.listDocuments(projectId)
    setDocuments(docs)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (current) refreshDocs(current)
    else setDocuments([])
  }, [current, refreshDocs])

  const createProject = useCallback(async (name: string) => {
    const id = `proj-${Date.now()}`
    await opfs.createProject(id)
    await db.addProject({ id, name, createdAt: Date.now() })
    await refresh()
    setCurrent(id)
    return id
  }, [refresh])

  const removeProject = useCallback(async (id: string) => {
    await opfs.removeProject(id).catch(() => {})
    await db.removeProject(id)
    if (current === id) setCurrent(null)
    await refresh()
  }, [current, refresh])

  const selectProject = useCallback((id: string | null) => {
    setCurrent(id)
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    if (!current) return
    await opfs.writeFile(current, file.name, file)
    const docId = `${current}:${file.name}`
    await db.addDocument({
      id: docId,
      projectId: current,
      filename: file.name,
      addedAt: Date.now(),
    })
    await refreshDocs(current)
    return docId
  }, [current, refreshDocs])

  return { projects, current, documents, createProject, removeProject, selectProject, uploadFile, refreshDocs }
}
