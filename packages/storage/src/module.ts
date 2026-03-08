import { defineModule } from '@obieg-zero/core';
import { opfsUpload, opfsRead, opfsDelete, opfsDeleteProject, opfsOpen } from './opfs.js';
import { persistSave, persistLoad, persistDelete } from './persist.js';

export const storageModule = defineModule({
  id: 'storage',
  label: 'Storage (OPFS + IndexedDB)',
  settings: {
    persistKeys: { type: 'string', label: 'Klucze do zapisu (CSV)', default: 'pages,chunks,extracted' },
    opfsRoot: { type: 'string', label: 'Katalog OPFS', default: 'obieg-zero' },
    revokeTimeout: { type: 'number', label: 'URL revoke timeout (ms)', default: 60000 },
  },
  nodes: (config) => {
    const keys = typeof config.persistKeys === 'string'
      ? config.persistKeys.split(',').map((k: string) => k.trim()).filter(Boolean)
      : config.persistKeys;
    return {
      'upload': opfsUpload(),
      'read-file': opfsRead(),
      'delete-file': opfsDelete(),
      'delete-project': opfsDeleteProject(),
      'open-file': opfsOpen(),
      'save': persistSave({ keys }),
      'load': persistLoad({ keys }),
      'delete-data': persistDelete({ keys }),
    };
  },
});
