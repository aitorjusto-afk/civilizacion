/* Almacenamiento en el navegador.
   - localStorage: asignaturas, tareas, progreso (piezas), sesiones, ajustes y sesión activa.
   - IndexedDB: apuntes (uno por asignatura) y calendario.
   Todo con try/catch: si el navegador bloquea el almacenamiento, se sigue funcionando en memoria. */
'use strict';

const Almacen = (() => {
  const PREFIJO = 'civ.';
  const CLAVES = ['asignaturas', 'tareas', 'piezas', 'sesiones', 'ajustes', 'sesionActiva', 'iniciado'];
  const memoria = {};
  let avisado = false;

  function avisoFallo(e) {
    console.warn('Almacenamiento no disponible', e);
    if (!avisado && window.U) { avisado = true; setTimeout(() => U.tostada('⚠️ Tu navegador no deja guardar datos: los cambios se perderán al cerrar.', { tipo: 'error', duracion: 7000 }), 500); }
  }

  function leer(clave, porDefecto) {
    try {
      const v = localStorage.getItem(PREFIJO + clave);
      if (v !== null) return JSON.parse(v);
    } catch (e) { avisoFallo(e); }
    return clave in memoria ? memoria[clave] : porDefecto;
  }
  function guardar(clave, valor) {
    memoria[clave] = valor;
    try { localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); return true; }
    catch (e) { avisoFallo(e); return false; }
  }
  function borrar(clave) {
    delete memoria[clave];
    try { localStorage.removeItem(PREFIJO + clave); } catch (e) { avisoFallo(e); }
  }

  /* ---------- IndexedDB ---------- */
  const memIdb = { apuntes: {}, kv: {}, archivos: {} };
  let promesaDb = null;
  function db() {
    if (!promesaDb) {
      promesaDb = new Promise((res, rej) => {
        try {
          const r = indexedDB.open('estudio-civilizacion', 2);
          r.onupgradeneeded = () => {
            const d = r.result;
            ['apuntes', 'kv', 'archivos'].forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
          };
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
          r.onblocked = () => rej(new Error('IndexedDB bloqueada'));
        } catch (e) { rej(e); }
      });
      promesaDb.catch(avisoFallo);
    }
    return promesaDb;
  }
  function peticion(store, modo, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const tx = d.transaction(store, modo);
      const r = fn(tx.objectStore(store));
      tx.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    }));
  }
  async function idbLeer(store, clave) {
    try { return await peticion(store, 'readonly', (s) => s.get(clave)); }
    catch (e) { return memIdb[store][clave]; }
  }
  async function idbGuardar(store, clave, valor) {
    memIdb[store][clave] = valor;
    try { await peticion(store, 'readwrite', (s) => s.put(valor, clave)); return true; }
    catch (e) { avisoFallo(e); return false; }
  }
  async function idbBorrar(store, clave) {
    delete memIdb[store][clave];
    try { await peticion(store, 'readwrite', (s) => s.delete(clave)); } catch (e) { avisoFallo(e); }
  }
  async function idbTodo(store) {
    try {
      const d = await db();
      return await new Promise((res, rej) => {
        const out = {};
        const tx = d.transaction(store, 'readonly');
        const r = tx.objectStore(store).openCursor();
        r.onsuccess = () => { const c = r.result; if (c) { out[c.key] = c.value; c.continue(); } };
        tx.oncomplete = () => res(out);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { return { ...memIdb[store] }; }
  }
  async function idbVaciar(store) {
    memIdb[store] = {};
    try { await peticion(store, 'readwrite', (s) => s.clear()); } catch (e) { avisoFallo(e); }
  }

  /* ---------- Copia de seguridad ---------- */
  function aBase64(buf) {
    const b = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deBase64(txt) {
    const s = atob(txt);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b.buffer;
  }
  async function exportar(incluirClave) {
    const ls = {};
    CLAVES.forEach((k) => { const v = leer(k, undefined); if (v !== undefined) ls[k] = v; });
    if (ls.ajustes && !incluirClave) ls.ajustes = { ...ls.ajustes, claveGemini: '' };
    const archivos = {};
    Object.entries(await idbTodo('archivos')).forEach(([sigla, lista]) => {
      archivos[sigla] = (lista || []).map((f) => ({ ...f, datos: aBase64(f.datos) }));
    });
    return {
      app: 'civilizacion-de-estudio', version: 2, creada: new Date().toISOString(),
      localStorage: ls, apuntes: await idbTodo('apuntes'), kv: await idbTodo('kv'), archivos,
    };
  }
  async function importar(datos) {
    if (!datos || datos.app !== 'civilizacion-de-estudio' || !datos.localStorage) throw new Error('El archivo no es una copia de seguridad de esta web.');
    const claveActual = (leer('ajustes', {}) || {}).claveGemini || '';
    CLAVES.forEach((k) => borrar(k));
    Object.entries(datos.localStorage).forEach(([k, v]) => { if (CLAVES.includes(k)) guardar(k, v); });
    // si la copia no traía la clave, se conserva la del dispositivo
    const aj = leer('ajustes', {}) || {};
    if (!aj.claveGemini && claveActual) guardar('ajustes', { ...aj, claveGemini: claveActual });
    await idbVaciar('apuntes'); await idbVaciar('kv'); await idbVaciar('archivos');
    for (const [k, v] of Object.entries(datos.apuntes || {})) await idbGuardar('apuntes', k, v);
    for (const [k, v] of Object.entries(datos.kv || {})) await idbGuardar('kv', k, v);
    for (const [k, lista] of Object.entries(datos.archivos || {})) {
      await idbGuardar('archivos', k, (lista || []).map((f) => ({ ...f, datos: deBase64(f.datos) })));
    }
  }
  async function reiniciar() {
    CLAVES.forEach((k) => borrar(k));
    await idbVaciar('apuntes'); await idbVaciar('kv'); await idbVaciar('archivos');
  }

  return { leer, guardar, borrar, idbLeer, idbGuardar, idbBorrar, idbTodo, exportar, importar, reiniciar };
})();
