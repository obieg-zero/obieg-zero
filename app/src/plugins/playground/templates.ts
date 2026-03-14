import type { PipelineRecord } from '@obieg-zero/store-v2'

export const BIELIK = 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf'

function pipe(types: { type: string; label: string; config?: Record<string, string> }[]) {
  const nodes = types.map((t, i) => ({ id: `${i + 1}`, type: t.type, position: { x: 300, y: i * 120 }, data: { label: t.label, config: t.config || {} } }))
  const edges = types.slice(1).map((_, i) => ({ id: `e${i + 1}-${i + 2}`, source: `${i + 1}`, sourceHandle: 'next', target: `${i + 2}` }))
  return { nodes, edges }
}

function dag(branches: { docGroup: string; chunkSize: string; questions: string; topK?: string }[]) {
  const nodes: any[] = [], edges: any[] = [], colW = 420, graphId = 'graph-1'
  branches.forEach((b, col) => {
    const x = col * colW, u = `upload-${col}`, e = `embed-${col}`, ex = `extract-${col}`
    nodes.push(
      { id: u, type: 'upload', position: { x, y: 0 }, data: { label: b.docGroup, config: { docGroup: b.docGroup } } },
      { id: e, type: 'embed', position: { x, y: 140 }, data: { label: 'Embed', config: { model: 'Xenova/multilingual-e5-small', chunkSize: b.chunkSize, language: 'pol' } } },
      { id: ex, type: 'extract', position: { x, y: 280 }, data: { label: 'Extract', config: { questions: b.questions, topK: b.topK || '2', modelUrl: BIELIK } } },
    )
    edges.push({ id: `e:${u}-${e}`, source: u, sourceHandle: 'next', target: e }, { id: `e:${e}-${ex}`, source: e, sourceHandle: 'next', target: ex }, { id: `e:${ex}-${graphId}`, source: ex, sourceHandle: 'next', target: graphId })
  })
  nodes.push({ id: graphId, type: 'graph', position: { x: ((branches.length - 1) * colW) / 2, y: 440 }, data: { label: 'Graph', config: {} } })
  return { nodes, edges }
}

export const SEED_TEMPLATES: Omit<PipelineRecord, 'projectId'>[] = [
  { id: 'tpl:wibor', name: 'Kalkulator WIBOR', ...dag([
    { docGroup: 'Umowa kredytu', chunkSize: '200', questions: 'Nazwa banku to\nKwota kredytu wynosi\nMarza banku wynosi\nStawka WIBOR wynosi\nUmowe podpisano dnia\nOkres kredytu to\nKredytobiorca to' },
    { docGroup: 'Aneksy', chunkSize: '150', questions: 'Nowa stawka WIBOR wynosi\nData wejscia w zycie aneksu to\nPoprzednia stawka WIBOR wynosila\nZmiana marzy wynosi' },
    { docGroup: 'Historia splat', chunkSize: '500', questions: 'Miesieczna rata wynosi\nSaldo zadluzenia wynosi\nData splaty to\nOprocentowanie w okresie wynosi', topK: '1' },
  ]) },
  { id: 'tpl:wibor-full', name: 'WIBOR (pelny)', ...dag([
    { docGroup: 'Umowa kredytu', chunkSize: '200', questions: 'Nazwa banku to\nKwota kredytu wynosi\nMarza banku wynosi\nStawka WIBOR wynosi\nUmowe podpisano dnia\nOkres kredytu to\nKredytobiorca to' },
    { docGroup: 'Aneksy', chunkSize: '150', questions: 'Nowa stawka WIBOR wynosi\nData wejscia w zycie aneksu to\nPoprzednia stawka WIBOR wynosila\nZmiana marzy wynosi' },
    { docGroup: 'Historia splat', chunkSize: '500', questions: 'Miesieczna rata wynosi\nSaldo zadluzenia wynosi\nData splaty to\nOprocentowanie w okresie wynosi', topK: '1' },
    { docGroup: 'Zaswiadczenie z banku', chunkSize: '300', questions: 'Saldo kredytu na dzien wynosi\nHistoria zmian oprocentowania to\nLaczna kwota odsetek wynosi' },
    { docGroup: 'Formularz ESIS', chunkSize: '200', questions: 'RRSO wynosi\nCalkowity koszt kredytu wynosi\nCalkowita kwota do zaplaty wynosi' },
    { docGroup: 'Wezwanie do zaplaty', chunkSize: '200', questions: 'Kwota roszczenia wynosi\nTermin zaplaty to\nPodstawa prawna roszczenia to' },
    { docGroup: 'Potwierdzenie nadania', chunkSize: '150', questions: 'Data nadania to\nAdresat to\nNumer przesylki to', topK: '1' },
  ]) },
  { id: 'tpl:faktura-gaz', name: 'Faktura za gaz', ...pipe([
    { type: 'upload', label: 'Upload', config: { docGroup: 'Faktura' } },
    { type: 'embed', label: 'Embed', config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200', language: 'pol' } },
    { type: 'extract', label: 'Extract', config: { questions: 'Nazwa sprzedawcy to\nNumer faktury to\nOkres rozliczeniowy to\nZuzycie gazu w m3 wynosi\nZuzycie gazu w kWh wynosi\nWspolczynnik konwersji wynosi\nKwota brutto do zaplaty wynosi\nGrupa taryfowa to\nOplata abonamentowa wynosi\nOplata stala wynosi', topK: '2', modelUrl: BIELIK } },
    { type: 'graph', label: 'Graph' },
  ]) },
]
