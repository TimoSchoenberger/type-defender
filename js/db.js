/* Browser storage for key selections and records: IndexedDB, falling back to localStorage (or memory).
   Everything goes through get/all/put/del so a remote store can replace it later. */
(() => {
'use strict';
const NAME = 'type-defender', STORES = ['sets', 'best'];
let ready = null;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}
const idb = db => ({
  run(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode), req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  },
  get(s, id) { return this.run(s, 'readonly', o => o.get(id)); },
  all(s) { return this.run(s, 'readonly', o => o.getAll()); },
  put(s, v) { return this.run(s, 'readwrite', o => o.put(v)); },
  del(s, id) { return this.run(s, 'readwrite', o => o.delete(id)); }
});
// Same interface on localStorage, or on a plain object when even that is blocked.
function local() {
  const mem = {};
  const read = s => { try { return JSON.parse(localStorage.getItem('td-db:' + s)) || {}; } catch (e) { return mem[s] || {}; } };
  const write = (s, v) => { mem[s] = v; try { localStorage.setItem('td-db:' + s, JSON.stringify(v)); } catch (e) { /* memory only */ } };
  return {
    async get(s, id) { return read(s)[id]; },
    async all(s) { return Object.values(read(s)); },
    async put(s, v) { const m = read(s); m[v.id] = v; write(s, m); },
    async del(s, id) { const m = read(s); delete m[id]; write(s, m); }
  };
}
function backend() {
  if (!ready) {
    ready = (async () => {
      try { if (window.indexedDB) return idb(await openIdb()); } catch (e) { /* fall through */ }
      return local();
    })();
  }
  return ready;
}

TD.DB = {
  get: (s, id) => backend().then(b => b.get(s, id)).catch(() => undefined),
  all: s => backend().then(b => b.all(s)).catch(() => []),
  put: (s, v) => backend().then(b => b.put(s, v)).catch(e => console.warn('save failed', e)),
  del: (s, id) => backend().then(b => b.del(s, id)).catch(e => console.warn('delete failed', e))
};
})();
