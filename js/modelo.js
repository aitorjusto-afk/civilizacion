/* Estado de la aplicación y reglas de las tareas y las piezas de la civilización. */
'use strict';

const App = {
  prueba: new URLSearchParams(location.search).has('prueba'),
  asignaturas: [],
  tareas: [],
  piezas: [],     // { tareaId, asignatura, slot, ts, danada }
  sesiones: [],   // registro de sesiones de estudio
  ajustes: {},
  apuntes: {},    // { SIGLA: texto markdown }
  calendario: '', // texto del calendario
  animarPieza: null,
};

const Modelo = (() => {
  const ASIG_DEFECTO = [
    { id: 'SI', nombre: 'Sistemas Informáticos', color: '#e07a3f', examen: '2026-11-16', hora: '12:30' },
    { id: 'ED', nombre: 'Entornos de Desarrollo', color: '#2a9d8f', examen: '2026-11-18', hora: '' },
    { id: 'DWES', nombre: 'Desarrollo Web en Entorno Servidor', color: '#8e5cc4', examen: '2026-11-23', hora: '' },
    { id: 'BD', nombre: 'Bases de Datos', color: '#3a7fc8', examen: '2026-11-24', hora: '' },
    { id: 'PROG', nombre: 'Programación Java', color: '#c9a227', examen: '2026-11-25', hora: '' },
    { id: 'LM', nombre: 'Lenguajes de Marcas', color: '#d1495b', examen: '', hora: '' },
  ];
  const AJUSTES_DEFECTO = { modoIA: 'gemini', claveGemini: '', modelo: 'gemini-2.5-flash' };
  const TIPOS = ['estudio', 'entrega', 'examen'];

  async function cargar() {
    if (!Almacen.leer('iniciado', false)) {
      Almacen.guardar('asignaturas', ASIG_DEFECTO);
      Almacen.guardar('iniciado', true);
    }
    App.asignaturas = Almacen.leer('asignaturas', ASIG_DEFECTO) || [];
    App.tareas = (Almacen.leer('tareas', []) || []).map(normalizar).filter(Boolean);
    App.piezas = Almacen.leer('piezas', []) || [];
    App.sesiones = Almacen.leer('sesiones', []) || [];
    App.ajustes = { ...AJUSTES_DEFECTO, ...(Almacen.leer('ajustes', {}) || {}) };
    App.apuntes = (await Almacen.idbTodo('apuntes')) || {};
    App.calendario = (await Almacen.idbLeer('kv', 'calendario')) || '';
    sincronizarPiezas();
  }

  // Coherencia: cada tarea hecha tiene una pieza y cada pieza tiene su tarea hecha.
  function sincronizarPiezas() {
    const hechas = new Map(App.tareas.filter((t) => t.hecha).map((t) => [t.id, t]));
    const antes = App.piezas.length;
    App.piezas = App.piezas.filter((p) => hechas.has(p.tareaId));
    const conPieza = new Set(App.piezas.map((p) => p.tareaId));
    [...hechas.values()].sort((a, b) => (a.hechaEn || 0) - (b.hechaEn || 0)).forEach((t) => {
      if (!conPieza.has(t.id)) App.piezas.push(nuevaPieza(t, false));
    });
    if (App.piezas.length !== antes) guardarPiezas();
  }

  const guardarTareas = () => Almacen.guardar('tareas', App.tareas);
  const guardarPiezas = () => Almacen.guardar('piezas', App.piezas);
  const guardarAsignaturas = () => Almacen.guardar('asignaturas', App.asignaturas);
  const guardarAjustes = () => Almacen.guardar('ajustes', App.ajustes);

  const asig = (id) => App.asignaturas.find((a) => a.id === id);
  const colorDe = (id) => (asig(id) || {}).color || '#8a8a8a';
  const nombreDe = (id) => (asig(id) || {}).nombre || id || '¿?';

  function normalizar(t) {
    if (!t || typeof t !== 'object') return null;
    const tipo = TIPOS.includes(t.tipo) ? t.tipo : 'estudio';
    return {
      id: t.id || U.uid(),
      fecha: U.esFecha(t.fecha) ? t.fecha : U.hoy(),
      asignatura: String(t.asignatura || '').trim(),
      titulo: String(t.titulo || '').trim() || 'Tarea sin título',
      minutos: tipo === 'estudio' ? Math.max(0, Math.round(Number(t.minutos) || 0)) : 0,
      tipo,
      bloques: Array.isArray(t.bloques) ? [...new Set(t.bloques.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b) : [],
      sugerida: !!t.sugerida,
      hecha: !!t.hecha,
      hechaEn: t.hechaEn || null,
      creada: t.creada || Date.now(),
    };
  }

  function ordenadas(lista = App.tareas) {
    const ordenTipo = { examen: 0, entrega: 1, estudio: 2 };
    return [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenTipo[a.tipo] - ordenTipo[b.tipo] || a.creada - b.creada);
  }

  const total = () => App.tareas.length;
  const hechas = () => App.tareas.filter((t) => t.hecha).length;
  const pasada = (t) => !t.hecha && t.fecha < U.hoy();

  function nuevaPieza(t, danada) {
    let slot = null;
    if (t.tipo !== 'examen') {
      const usados = new Set(App.piezas.filter((p) => p.slot !== null).map((p) => p.slot));
      slot = 0; while (usados.has(slot)) slot++;
    }
    return { tareaId: t.id, asignatura: t.asignatura, slot, ts: Date.now(), danada: !!danada };
  }

  /* Completa una tarea: añade su pieza a la civilización. Devuelve la pieza. */
  function completar(id, { danada = false } = {}) {
    const t = App.tareas.find((x) => x.id === id);
    if (!t) return null;
    if (t.hecha) {
      const p = App.piezas.find((x) => x.tareaId === id);
      if (p && !danada && p.danada) { p.danada = false; guardarPiezas(); }
      return p;
    }
    t.hecha = true; t.hechaEn = Date.now();
    const p = nuevaPieza(t, danada);
    App.piezas.push(p);
    App.animarPieza = id;
    guardarTareas(); guardarPiezas();
    return p;
  }
  function descompletar(id) {
    const t = App.tareas.find((x) => x.id === id);
    if (!t) return;
    t.hecha = false; t.hechaEn = null;
    App.piezas = App.piezas.filter((p) => p.tareaId !== id);
    guardarTareas(); guardarPiezas();
  }
  function borrarTarea(id) {
    App.tareas = App.tareas.filter((t) => t.id !== id);
    App.piezas = App.piezas.filter((p) => p.tareaId !== id);
    guardarTareas(); guardarPiezas();
  }
  function guardarTarea(datos) {
    const t = normalizar(datos);
    const i = App.tareas.findIndex((x) => x.id === t.id);
    if (i >= 0) {
      const vieja = App.tareas[i];
      t.hecha = vieja.hecha; t.hechaEn = vieja.hechaEn; t.creada = vieja.creada;
      App.tareas[i] = t;
      const p = App.piezas.find((x) => x.tareaId === t.id);
      if (p) {
        p.asignatura = t.asignatura;
        // si cambia a examen/no examen, se recoloca la pieza
        if ((t.tipo === 'examen') !== (p.slot === null)) { App.piezas = App.piezas.filter((x) => x !== p); App.piezas.push(nuevaPieza(t, p.danada)); }
        guardarPiezas();
      }
    } else App.tareas.push(t);
    guardarTareas();
    return t;
  }
  /* Una sesión limpia de una asignatura repara sus piezas dañadas. */
  function reparar(asignatura) {
    let n = 0;
    App.piezas.forEach((p) => { if (p.danada && p.asignatura === asignatura) { p.danada = false; n++; } });
    if (n) guardarPiezas();
    return n;
  }
  const piezaDe = (id) => App.piezas.find((p) => p.tareaId === id);

  function registrarSesion(s) {
    App.sesiones.push(s);
    if (App.sesiones.length > 500) App.sesiones = App.sesiones.slice(-500);
    Almacen.guardar('sesiones', App.sesiones);
  }

  /* Añade tareas importadas. modo: 'sustituir' (borra pendientes) o 'anadir'. Las completadas nunca se borran. */
  function importarTareas(lista, modo) {
    if (modo === 'sustituir') App.tareas = App.tareas.filter((t) => t.hecha);
    const clave = (t) => `${t.fecha}|${t.asignatura}|${U.sinAcentos(t.titulo)}`;
    const existentes = new Set(App.tareas.map(clave));
    let n = 0;
    lista.forEach((d) => {
      const t = normalizar({ ...d, id: U.uid(), hecha: false, creada: Date.now() + n });
      if (existentes.has(clave(t))) return;
      existentes.add(clave(t)); App.tareas.push(t); n++;
    });
    guardarTareas();
    return n;
  }

  const cacheBloques = {};
  function bloquesDe(sigla) {
    const texto = App.apuntes[sigla] || '';
    const c = cacheBloques[sigla];
    if (c && c.texto === texto) return c.bloques;
    const b = U.bloques(texto);
    cacheBloques[sigla] = { texto, bloques: b };
    return b;
  }
  async function guardarApuntes(sigla, texto) {
    if (texto && texto.trim()) { App.apuntes[sigla] = texto; await Almacen.idbGuardar('apuntes', sigla, texto); }
    else { delete App.apuntes[sigla]; await Almacen.idbBorrar('apuntes', sigla); }
  }
  async function guardarCalendario(texto) {
    App.calendario = texto || '';
    await Almacen.idbGuardar('kv', 'calendario', App.calendario);
  }

  return { ASIG_DEFECTO, TIPOS, cargar, sincronizarPiezas, guardarTareas, guardarPiezas, guardarAsignaturas, guardarAjustes, asig, colorDe, nombreDe, normalizar, ordenadas, total, hechas, pasada, completar, descompletar, borrarTarea, guardarTarea, reparar, piezaDe, registrarSesion, importarTareas, bloquesDe, guardarApuntes, guardarCalendario };
})();
