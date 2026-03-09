import { defineModule } from '@obieg-zero/core';
import { opfsUpload, opfsRead, opfsDelete, opfsDeleteProject, opfsOpen } from './opfs.js';
import { persistSave, persistLoad, persistDelete } from './persist.js';

export const storageModule = defineModule({
  id: 'storage',
  label: 'Storage (OPFS + IndexedDB)',
  settings: {
    persistKeys: { type: 'string', label: 'Klucze do zapisu (CSV)' },
    opfsRoot: { type: 'string', label: 'Katalog OPFS' },
    revokeTimeout: { type: 'number', label: 'URL revoke timeout (ms)' },
  },
  nodes: () => ({
    'upload': opfsUpload(),
    'read-file': opfsRead(),
    'delete-file': opfsDelete(),
    'delete-project': opfsDeleteProject(),
    'open-file': opfsOpen(),
    'save': persistSave(),
    'load': persistLoad(),
    'delete-data': persistDelete(),
  }),
});
