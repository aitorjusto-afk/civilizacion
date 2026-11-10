/* Generación de la checklist:
   A) API gratuita de Google Gemini desde el navegador.
   B) Sin clave: instrucciones para pegar en Claude y respuesta pegada aquí.
   Extra) Lector local sin IA para probar.
   Siempre: validación + vista previa editable antes de guardar. */
'use strict';

const IA = (() => {
  let borrador = null;   // { tareas: [...], errores: [...], origen }
  let errorGemini = '';
  let abrirB = false;

  const ESQUEMA = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        fecha: { type: 'STRING', description: 'AAAA-MM-DD' },
        asignatura: { type: 'STRING' },
        titulo: { type: 'STRING' },
        minutos: { type: 'INTEGER' },
        tipo: { type: 'STRING', enum: ['estudio', 'entrega', 'examen'] },
        bloques: { type: 'ARRAY', items: { type: 'INTEGER' } },
        sugerida: { type: 'BOOLEAN' },
        pasada: { type: 'BOOLEAN' },
      },
      required: ['fecha', 'asignatura', 'titulo', 'minutos', 'tipo', 'bloques'],
      propertyOrdering: ['fecha', 'asignatura', 'titulo', 'minutos', 'tipo', 'bloques', 'sugerida', 'pasada'],
    },
  };

  /* ---------- Instrucciones ---------- */
  function textoBloques() {
    return App.asignaturas.map((a) => {
      const bl = Modelo.bloquesDe(a.id);
      const cab = `### ${a.id} — ${a.nombre} (examen: ${a.examen ? a.examen + (a.hora ? ' ' + a.hora : '') : 'sin fecha'})`;
      if (!bl.length) return `${cab}\n(sin apuntes)`;
      return `${cab}\n` + bl.map((b) => {
        const extracto = b.texto.replace(/^#+.*$/m, '').replace(/\s+/g, ' ').trim().slice(0, 160);
        return `${b.n}. ${'  '.repeat(Math.max(0, b.nivel - 1))}${b.titulo} (${b.palabras} palabras)${extracto ? ' — ' + extracto + '…' : ''}`;
      }).join('\n');
    }).join('\n\n');
  }

  function instrucciones(paraClaude) {
    const hoy = U.hoy();
    return `Eres un asistente que convierte un calendario de estudio en una checklist en formato JSON. Responde en español.

HOY es ${hoy}. Si una fecha no trae año, usa ${hoy.slice(0, 4)}.

REGLAS
1. Las tareas, fechas y tiempos salen del CALENDARIO. No inventes tareas (salvo lo que dice la regla 9).
2. Una tarea por cada fila del calendario. Si una fila tiene dos asignaturas (por ejemplo "SI+ED"), divídela en dos tareas, una por asignatura, y reparte el tiempo según el texto (si no se indica, a partes iguales).
3. "asignatura": la SIGLA exacta de la lista de ASIGNATURAS.
4. "fecha": formato AAAA-MM-DD.
5. "titulo": el texto de "Qué hacer", copiado tal cual (puedes acortarlo un poco si es muy largo).
6. "tipo": "examen" si la fila es un examen (aparece como "EXAMEN …"), "entrega" si es una entrega ("ENTREGA …"), y "estudio" en el resto.
7. "minutos": el tiempo de la fila en minutos (2 h = 120, 1 h 30 = 90, 45 min = 45). Las entregas y los exámenes llevan "minutos": 0.
8. "bloques": los números de los BLOQUES DE APUNTES de esa misma asignatura que corresponden a la tarea, según sus títulos y contenido. Si no corresponde ninguno, [].
9. Si alguna asignatura que tiene apuntes NO aparece en el calendario, reparte sus bloques en tareas de tipo "estudio" en días libres o con poca carga entre HOY y el día anterior a su examen (si no tiene examen, en las próximas 3 semanas). Calcula los minutos según la longitud (unas 150 palabras ≈ 10 min; mínimo 20 y máximo 120; múltiplos de 5). Esas tareas llevan "sugerida": true. Todas las demás llevan "sugerida": false.
10. "pasada": true si la fecha es anterior a HOY; si no, false.

FORMATO DE SALIDA
Devuelve SOLO un array JSON${paraClaude ? ' dentro de un único bloque de código ```json' : ''}, sin texto antes ni después, con objetos así:
[{ "fecha": "2026-11-10", "asignatura": "SI", "titulo": "Bloque 1: ejercicios", "minutos": 120, "tipo": "estudio", "bloques": [2, 3], "sugerida": false, "pasada": false }]

ASIGNATURAS (sigla — nombre — fecha de examen)
${App.asignaturas.map((a) => `- ${a.id} — ${a.nombre} — ${a.examen ? a.examen + (a.hora ? ' ' + a.hora : '') : 'sin fecha'}`).join('\n')}

CALENDARIO
${App.calendario.trim() || '(no hay calendario: aplica solo la regla 9 con todas las asignaturas que tengan apuntes)'}

BLOQUES DE APUNTES (por asignatura; número. título (longitud) — comienzo del texto)
${textoBloques()}`;
  }

  /* ---------- A) Gemini ---------- */
  async function llamarGemini() {
    const clave = (App.ajustes.claveGemini || '').trim();
    const modelo = (App.ajustes.modelo || 'gemini-2.5-flash').trim().replace(/^models\//, '');
    if (!clave) throw Object.assign(new Error('Falta la clave de Gemini. Pégala en Ajustes.'), { tipo: 'clave' });
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: instrucciones(false) }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0.2 },
        }),
      });
    } catch (e) {
      throw Object.assign(new Error(navigator.onLine === false ? 'No hay conexión a internet.' : 'No se pudo conectar con Gemini (¿sin internet o bloqueado por la red?).'), { tipo: 'red' });
    }
    let datos = null;
    try { datos = await res.json(); } catch (e) { /* sin cuerpo */ }
    if (!res.ok) {
      const msg = (datos && datos.error && datos.error.message) || res.statusText;
      if (res.status === 429) throw new Error('Has llegado al límite gratuito de Gemini por ahora. Espera un rato (o mañana) o usa la opción B con Claude.');
      if (res.status === 400 && /api key/i.test(msg)) throw new Error('La clave de Gemini no es válida. Revísala en Ajustes.');
      if (res.status === 403) throw new Error('Google ha rechazado la clave (403). Comprueba que es una clave de Google AI Studio y que está activa.');
      if (res.status === 404) throw new Error(`El modelo «${modelo}» no existe o no está disponible. Cámbialo en Ajustes («Ver modelos disponibles»).`);
      if (res.status >= 500) throw new Error('Gemini está saturado o con problemas ahora mismo. Prueba en unos minutos.');
      throw new Error(`Error de Gemini (${res.status}): ${msg}`);
    }
    const cand = datos && datos.candidates && datos.candidates[0];
    if (!cand) throw new Error('Gemini no devolvió respuesta' + (datos && datos.promptFeedback ? ` (${datos.promptFeedback.blockReason || 'bloqueada'})` : '') + '.');
    const texto = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
    if (cand.finishReason === 'MAX_TOKENS') throw new Error('La respuesta de Gemini se cortó por larga. Prueba con un calendario más corto o con la opción B.');
    return texto;
  }

  async function listarModelos() {
    const clave = (App.ajustes.claveGemini || '').trim();
    if (!clave) throw new Error('Primero pega la clave.');
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': clave } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((d.error && d.error.message) || `Error ${res.status}`);
    return (d.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  }

  /* ---------- Validación ---------- */
  function extraerJson(texto) {
    let t = String(texto || '').trim();
    const bloque = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
    if (bloque) t = bloque[1].trim();
    try { return JSON.parse(t); } catch (e) { /* buscar el array */ }
    const i = t.indexOf('['), j = t.lastIndexOf(']');
    if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { /* nada */ } }
    throw new Error('No encuentro un JSON válido en el texto. Copia la respuesta completa (la lista que empieza por «[»).');
  }

  function resolverSigla(s) {
    const n = U.sinAcentos(s).trim();
    if (!n) return null;
    const a = App.asignaturas.find((x) => U.sinAcentos(x.id) === n || U.sinAcentos(x.nombre) === n);
    return a ? a.id : null;
  }

  function validar(datos) {
    if (!Array.isArray(datos)) {
      if (datos && Array.isArray(datos.tareas)) datos = datos.tareas;
      else throw new Error('La respuesta no es una lista de tareas (tiene que empezar por «[»).');
    }
    const tareas = [], errores = [];
    const anio = Number(U.hoy().slice(0, 4));
    datos.forEach((d, i) => {
      const fila = `Tarea ${i + 1}`;
      if (!d || typeof d !== 'object') { errores.push(`${fila}: no es un objeto, se ignora.`); return; }
      let fecha = U.esFecha(d.fecha) ? d.fecha : Lector.fechaDe(String(d.fecha || ''), anio);
      if (!fecha) { errores.push(`${fila}: fecha no válida («${d.fecha}»), se ignora.`); return; }
      const titulo = String(d.titulo || '').trim();
      if (!titulo) { errores.push(`${fila}: sin título, se ignora.`); return; }
      const crudas = String(d.asignatura || '').split(/\s*[+\/,&]\s*/).filter(Boolean);
      let siglas = crudas.map((s) => resolverSigla(s) || s.trim().toUpperCase());
      crudas.forEach((s, k) => { if (!resolverSigla(s)) errores.push(`${fila}: la asignatura «${s}» no existe; revísala en la vista previa.`); });
      if (!siglas.length) siglas = [''];
      let tipo = String(d.tipo || '').toLowerCase().trim();
      if (!Modelo.TIPOS.includes(tipo)) tipo = /\bexamen\b/i.test(titulo) ? 'examen' : /\bentrega\b/i.test(titulo) ? 'entrega' : 'estudio';
      let minutos = Math.round(Number(d.minutos) || 0);
      if (tipo !== 'estudio') minutos = 0;
      else if (minutos <= 0) { errores.push(`${fila}: tarea de estudio sin minutos; le pongo 30.`); minutos = 30; }
      const parte = siglas.length > 1 ? Math.max(5, Math.round(minutos / siglas.length / 5) * 5) : minutos;
      siglas.forEach((sigla) => {
        const max = Modelo.bloquesDe(sigla).length;
        const bloques = (Array.isArray(d.bloques) ? d.bloques : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max);
        tareas.push({ fecha, asignatura: sigla, titulo, minutos: tipo === 'estudio' ? parte : 0, tipo, bloques, sugerida: !!d.sugerida });
      });
    });
    if (!tareas.length) errores.unshift('No ha salido ninguna tarea válida.');
    return { tareas, errores };
  }

  /* ---------- Zona de generación (pantalla Importar) ---------- */
  function renderZona(cont) {
    const modo = App.ajustes.modoIA === 'claude' ? 'claude' : 'gemini';
    const hayDatos = App.calendario.trim() || Modelo.hayAlgunApunte();
    const tieneClave = !!(App.ajustes.claveGemini || '').trim();
    const zonaA = `<div class="opcion-ia">
        <h3>A · Con Gemini (gratis)</h3>
        ${tieneClave ? `<p class="pista">Modelo: <code>${U.esc(App.ajustes.modelo)}</code>. Se envían el calendario, tus asignaturas y los títulos de los bloques de apuntes.</p>`
          : `<p class="aviso">Falta tu clave gratuita de Google AI Studio. <a href="#ajustes">Pégala en Ajustes</a>.</p>`}
        <button class="btn primario" id="gen-gemini" ${tieneClave ? '' : 'disabled'}>✨ Generar checklist</button>
        ${errorGemini ? `<div class="aviso error-ia"><strong>No se pudo generar con Gemini.</strong> ${U.esc(errorGemini)}<br><button class="btn mini" id="ir-b">Usar la opción B (Claude, sin clave)</button></div>` : ''}
      </div>`;
    const zonaB = `<div class="opcion-ia" id="opcion-b">
        <h3>B · Sin clave, con tu chat de Claude</h3>
        <ol class="pasos-b">
          <li><button class="btn ${modo === 'claude' ? 'primario' : ''}" id="copiar-claude">📋 Copiar instrucciones para Claude</button></li>
          <li>Pégalas en <a href="https://claude.ai/new" target="_blank" rel="noopener">claude.ai</a> y copia la respuesta.</li>
          <li>Pega aquí la respuesta:<textarea id="resp-claude" rows="6" placeholder='[{ "fecha": "2026-11-10", "asignatura": "SI", ... }]'></textarea>
          <button class="btn" id="validar-claude">Validar e importar</button></li>
        </ol>
      </div>`;
    const local = `<details class="opcion-local"><summary>🧪 Probar sin IA (lector de tablas local)</summary>
        <p class="pista">Lee la tabla del calendario directamente en el navegador y enlaza los bloques por los títulos («Bloque 2», «Tema 1», «UT3»…). Sirve para probar sin gastar la IA; la IA lo hace mejor con calendarios desordenados.</p>
        <button class="btn" id="gen-local">Leer el calendario sin IA</button></details>`;
    cont.innerHTML = (hayDatos ? '' : '<p class="aviso">Primero guarda el calendario y/o los apuntes (pasos 1 y 2).</p>')
      + `<p class="pista">Eliges el método por defecto en <a href="#ajustes">Ajustes</a>. ${App.tareas.length ? `Ya tienes ${App.tareas.length} tareas: al guardar te preguntaré si sustituyo las pendientes o añado.` : ''}</p>`
      + (modo === 'gemini'
        ? zonaA + `<details class="opcion-otra" ${abrirB || errorGemini ? 'open' : ''}><summary>Otra opción: sin clave, con Claude</summary>${zonaB}</details>`
        : zonaB + `<details class="opcion-otra"><summary>Otra opción: con Gemini</summary>${zonaA}</details>`)
      + `<p><button class="btn mini" id="anadir-mano">＋ Añadir una tarea a mano</button></p>` + local;

    const bg = U.$('#gen-gemini', cont);
    if (bg) bg.onclick = async () => {
      if (!hayDatos) return U.avisar('Faltan datos', 'Guarda primero el calendario o los apuntes.');
      bg.disabled = true; bg.innerHTML = '<span class="girando">⏳</span> Generando… (puede tardar un minuto)';
      errorGemini = '';
      try {
        const texto = await llamarGemini();
        abrirBorrador(validar(extraerJson(texto)), 'Gemini');
      } catch (e) {
        console.error(e);
        errorGemini = e.message; abrirB = true;
        renderZona(cont);
        U.$('#opcion-b', cont) && U.$('#opcion-b', cont).scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      renderZona(cont);
    };
    const irB = U.$('#ir-b', cont);
    if (irB) irB.onclick = () => { const d = U.$('.opcion-otra', cont); d.open = true; U.$('#opcion-b', cont).scrollIntoView({ behavior: 'smooth' }); };
    U.$('#copiar-claude', cont).onclick = async () => {
      if (!hayDatos) return U.avisar('Faltan datos', 'Guarda primero el calendario o los apuntes.');
      const ok = await U.copiar(instrucciones(true));
      if (ok) U.tostada('📋 Instrucciones copiadas. Pégalas en claude.ai');
      else mostrarParaCopiar(instrucciones(true));
    };
    U.$('#validar-claude', cont).onclick = () => {
      try { abrirBorrador(validar(extraerJson(U.$('#resp-claude', cont).value)), 'Claude'); }
      catch (e) { U.avisar('No se pudo validar', U.esc(e.message)); }
    };
    U.$('#gen-local', cont).onclick = () => {
      if (!App.calendario.trim() && !Modelo.hayAlgunApunte()) return U.avisar('Faltan datos', 'Guarda primero el calendario o los apuntes.');
      const tareas = Lector.leer(App.calendario);
      tareas.push(...Lector.sugerir(tareas));
      abrirBorrador({ tareas, errores: tareas.length ? [] : ['No he reconocido ninguna fila. Revisa que el calendario tenga columnas Día | Asignatura | Qué hacer | Tiempo.'] }, 'lector local');
    };
    U.$('#anadir-mano', cont).onclick = () => Checklist.editarTarea(null);
  }

  function mostrarParaCopiar(texto) {
    const ta = U.el(`<textarea rows="14" readonly></textarea>`); ta.value = texto;
    U.modal('Copia este texto', ta, [{ texto: 'Cerrar', valor: true, clase: 'primario' }]);
    setTimeout(() => ta.select(), 50);
  }

  /* ---------- Vista previa ---------- */
  function abrirBorrador(resultado, origen) {
    borrador = { ...resultado, origen };
    borrador.tareas = Modelo.ordenadas(borrador.tareas.map((t, i) => ({ ...t, creada: i, _k: U.uid() })));
    renderVistaPrevia();
    const vp = U.$('#vista-previa'); if (vp) vp.scrollIntoView({ behavior: 'smooth' });
  }

  function renderVistaPrevia() {
    const cont = U.$('#vista-previa');
    if (!cont) return;
    if (!borrador) { cont.innerHTML = ''; return; }
    const hoy = U.hoy();
    const optsAsig = (sel) => App.asignaturas.map((a) => `<option value="${U.esc(a.id)}" ${a.id === sel ? 'selected' : ''}>${U.esc(a.id)}</option>`).join('')
      + (sel && !Modelo.asig(sel) ? `<option value="${U.esc(sel)}" selected>${U.esc(sel)} ⚠</option>` : '');
    const total = borrador.tareas.reduce((s, t) => s + (t.minutos || 0), 0);
    cont.innerHTML = `<section class="tarjeta vista-previa">
      <div class="barra-herr"><h2>Vista previa · ${borrador.tareas.length} tareas <span class="pista">(${U.esc(borrador.origen)} · ${U.fmtMin(total) || '0 min'} de estudio)</span></h2></div>
      ${borrador.errores.length ? `<details class="aviso" open><summary>${borrador.errores.length} avisos</summary><ul>${borrador.errores.map((e) => `<li>${U.esc(e)}</li>`).join('')}</ul></details>` : ''}
      <p class="pista">Revisa antes de guardar: cambia el día para mover una tarea, ajusta los minutos, borra o añade filas. «Bloques» son los números de los bloques de apuntes (p. ej. 2,3).</p>
      <div class="vp-lista">
        <div class="vp-fila vp-cab"><span>Día</span><span>Asig.</span><span>Qué hacer</span><span>Tipo</span><span>Min</span><span>Bloques</span><span></span></div>
        ${borrador.tareas.map((t, i) => `<div class="vp-fila ${t.fecha < hoy ? 'pasada' : ''}" data-i="${i}" style="--c:${Modelo.colorDe(t.asignatura)}">
          <input type="date" data-c="fecha" value="${U.esc(t.fecha)}" aria-label="Día">
          <select data-c="asignatura" aria-label="Asignatura">${optsAsig(t.asignatura)}</select>
          <input data-c="titulo" value="${U.esc(t.titulo)}" aria-label="Qué hacer">
          <select data-c="tipo" aria-label="Tipo">${Modelo.TIPOS.map((x) => `<option ${x === t.tipo ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <input type="number" data-c="minutos" min="0" step="5" value="${t.minutos}" ${t.tipo !== 'estudio' ? 'disabled' : ''} aria-label="Minutos">
          <input data-c="bloques" value="${t.bloques.join(', ')}" placeholder="—" aria-label="Bloques" title="${U.esc(Modelo.bloquesDe(t.asignatura).filter((b) => t.bloques.includes(b.n)).map((b) => b.n + '. ' + b.titulo).join('\n'))}">
          <span class="vp-acc">${t.sugerida ? '<span title="Sugerida por la IA">✨</span>' : ''}${t.fecha < hoy ? '<span title="Día pasado">⌛</span>' : ''}<button class="btn mini icono" data-borrar title="Borrar">✕</button></span>
        </div>`).join('')}
      </div>
      <div class="acciones">
        <button class="btn" id="vp-anadir">＋ Añadir fila</button>
        <button class="btn" id="vp-ordenar">Ordenar por fecha</button>
        <span class="separa"></span>
        <button class="btn" id="vp-descartar">Descartar</button>
        <button class="btn primario" id="vp-guardar">Guardar ${borrador.tareas.length} tareas en la checklist</button>
      </div></section>`;

    U.$$('.vp-fila[data-i]', cont).forEach((fila) => {
      const t = borrador.tareas[Number(fila.dataset.i)];
      U.$$('[data-c]', fila).forEach((inp) => inp.addEventListener('change', () => {
        const c = inp.dataset.c;
        if (c === 'minutos') t.minutos = Math.max(0, Math.round(Number(inp.value) || 0));
        else if (c === 'bloques') t.bloques = inp.value.split(/[^\d]+/).map(Number).filter((n) => n > 0);
        else t[c] = inp.value;
        if (c === 'tipo' || c === 'asignatura') { if (t.tipo !== 'estudio') t.minutos = 0; else if (!t.minutos) t.minutos = 30; renderVistaPrevia(); }
      }));
      U.$('[data-borrar]', fila).onclick = () => { borrador.tareas.splice(Number(fila.dataset.i), 1); renderVistaPrevia(); };
    });
    U.$('#vp-anadir').onclick = () => {
      const ult = borrador.tareas[borrador.tareas.length - 1];
      borrador.tareas.push({ fecha: ult ? ult.fecha : hoy, asignatura: ult ? ult.asignatura : (App.asignaturas[0] || {}).id || '', titulo: 'Nueva tarea', minutos: 30, tipo: 'estudio', bloques: [], sugerida: false, _k: U.uid() });
      renderVistaPrevia();
      const filas = U.$$('.vp-fila[data-i]', cont); const f = filas[filas.length - 1]; f.scrollIntoView({ block: 'center' }); U.$('[data-c=titulo]', f).select();
    };
    U.$('#vp-ordenar').onclick = () => { borrador.tareas = Modelo.ordenadas(borrador.tareas.map((t, i) => ({ ...t, creada: i }))); renderVistaPrevia(); };
    U.$('#vp-descartar').onclick = async () => { if (await U.confirmar('Descartar', '¿Descartar esta vista previa?', 'Descartar', 'Cancelar', true)) { borrador = null; renderVistaPrevia(); } };
    U.$('#vp-guardar').onclick = guardar;
  }

  async function guardar() {
    const lista = borrador.tareas.filter((t) => U.esFecha(t.fecha) && String(t.titulo).trim());
    if (!lista.length) return U.avisar('Nada que guardar', 'No hay tareas válidas en la vista previa.');
    const desconocidas = [...new Set(lista.map((t) => t.asignatura).filter((s) => !Modelo.asig(s)))];
    if (desconocidas.length && !(await U.confirmar('Asignaturas desconocidas', `Hay tareas con asignaturas que no existen: <strong>${desconocidas.map(U.esc).join(', ')}</strong>. Saldrán en gris. ¿Guardar igualmente?`, 'Guardar'))) return;
    let modo = 'anadir';
    const pendientes = App.tareas.filter((t) => !t.hecha).length;
    if (pendientes) {
      modo = await U.modal('Ya tienes tareas', `<p>Tienes <strong>${pendientes}</strong> tareas pendientes${App.tareas.length - pendientes ? ` y ${App.tareas.length - pendientes} completadas (las completadas nunca se borran)` : ''}.</p><p>¿Qué hago con las nuevas?</p>`, [
        { texto: 'Cancelar', valor: null },
        { texto: 'Añadirlas', valor: 'anadir' },
        { texto: 'Sustituir las pendientes', valor: 'sustituir', clase: 'primario' },
      ]);
      if (!modo) return;
    }
    const n = Modelo.importarTareas(lista, modo);
    borrador = null; errorGemini = ''; abrirB = false;
    U.tostada(`✅ ${n} tareas guardadas en la checklist`);
    location.hash = '#checklist';
  }

  return { renderZona, renderVistaPrevia, instrucciones, validar, extraerJson, listarModelos };
})();

/* ---------- Lector local (sin IA) ---------- */
const Lector = (() => {
  const MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
  const mk = (y, m, d) => {
    if (!y || !m || !d || m > 12 || d > 31) return null;
    const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return U.esFecha(s) && U.iso(U.aFecha(s)) === s ? s : null;
  };

  function fechaDe(txt, anio) {
    const s = U.sinAcentos(txt);
    let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return mk(+m[1], +m[2], +m[3]);
    m = /\b(\d{1,2})\s*(?:-|\/|\.|\s|de\s)\s*(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?(?:\s*(?:de\s*)?(\d{4}))?/.exec(s);
    if (m) return mk(+m[3] || anio, MES[m[2]], +m[1]);
    m = /\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/.exec(s);
    if (m) { const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : anio; return mk(y, +m[2], +m[1]); }
    return null;
  }

  function minutosDe(txt) {
    const s = U.sinAcentos(txt).trim();
    if (/^[-—–·x]*$/.test(s) || s === '0') return 0;
    let m = /^(\d+(?:[.,]\d+)?)\s*h(?:oras?|rs?)?\.?\s*(?:y\s*)?(?:(\d+)\s*(?:min(?:utos)?|m|')?)?$/.exec(s);
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60 + (+m[2] || 0));
    m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (m) return +m[1] * 60 + +m[2];
    m = /^(\d+)\s*(?:min(?:utos)?|m|')\.?$/.exec(s);
    if (m) return +m[1];
    m = /^(\d+)$/.exec(s);
    if (m) return +m[1];
    return null;
  }

  function siglasDe(celda) {
    if (!celda || celda.length > 60) return null;
    const partes = celda.split(/\s*[+\/,&]\s*|\s+y\s+/).filter(Boolean);
    const res = [];
    for (const p of partes) {
      const n = U.sinAcentos(p).trim();
      const a = App.asignaturas.find((x) => U.sinAcentos(x.id) === n || U.sinAcentos(x.nombre) === n);
      if (!a) return null;
      res.push(a.id);
    }
    return res.length ? res : null;
  }

  function refs(texto) {
    const out = new Set();
    const s = U.sinAcentos(texto);
    const re = /\b(bloques?|temas?|ut|unidad(?:es)?|tema)\s*0?(\d+)((?:\s*(?:,|y|e|\+)\s*(?:ut\s*)?0?\d+)*)/g;
    let m;
    while ((m = re.exec(s))) {
      const tipo = m[1].startsWith('bloque') ? 'b' : m[1].startsWith('tema') ? 't' : 'u';
      out.add(tipo + Number(m[2]));
      (m[3].match(/\d+/g) || []).forEach((n) => out.add(tipo + Number(n)));
    }
    return out;
  }
  const VACIAS = new Set(['repaso', 'repasar', 'ejercicios', 'lectura', 'primera', 'segunda', 'mitad', 'total', 'tarea', 'hacer', 'todos', 'completo', 'videos', 'sobre', 'entre', 'desde', 'hasta', 'tabla', 'tablas']);
  const palabras = (s) => new Set(U.sinAcentos(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 5 && !VACIAS.has(w)));

  function asignarBloques(sigla, titulo) {
    const bl = Modelo.bloquesDe(sigla);
    if (!bl.length) return [];
    const r = refs(titulo);
    const elegidos = new Set();
    bl.forEach((b, i) => {
      const rb = refs(b.titulo);
      if ([...rb].some((x) => r.has(x))) {
        elegidos.add(b.n);
        for (let k = i + 1; k < bl.length && bl[k].nivel > b.nivel; k++) elegidos.add(bl[k].n); // sus subapartados
      }
    });
    if (!elegidos.size) {
      const pt = palabras(titulo);
      bl.forEach((b) => { const pb = palabras(b.titulo); if ([...pb].some((w) => pt.has(w))) elegidos.add(b.n); });
    }
    return [...elegidos].sort((a, b) => a - b);
  }

  function leer(texto) {
    const anio = Number(U.hoy().slice(0, 4));
    const res = [];
    let ultimaFecha = null;
    String(texto || '').split(/\r?\n/).forEach((linea) => {
      const plano = U.sinAcentos(linea);
      if (plano.includes('asignatura') && plano.includes('que hacer')) return;
      let celdas = linea.includes('|') ? linea.split('|') : linea.includes('\t') ? linea.split('\t') : linea.split(/\s{2,}|;/);
      celdas = celdas.map((c) => c.trim()).filter(Boolean);
      if (celdas.length < 2) return;
      const iA = celdas.findIndex((c) => siglasDe(c));
      if (iA < 0) return;
      const siglas = siglasDe(celdas[iA]);
      let fecha = null;
      for (let k = 0; k < iA && !fecha; k++) fecha = fechaDe(celdas[k], anio);
      if (!fecha) fecha = ultimaFecha;
      if (!fecha) return;
      ultimaFecha = fecha;
      let resto = celdas.slice(iA + 1);
      let minutos = null;
      if (resto.length > 1) { const mm = minutosDe(resto[resto.length - 1]); if (mm !== null) { minutos = mm; resto = resto.slice(0, -1); } }
      const titulo = resto.join(' · ').trim();
      if (!titulo) return;
      const tipo = /\bexamen\b/i.test(titulo) ? 'examen' : /\bentrega\b/i.test(titulo) ? 'entrega' : 'estudio';
      const min = tipo === 'estudio' ? (minutos || 30) : 0;
      const parte = siglas.length > 1 ? Math.max(5, Math.round(min / siglas.length / 5) * 5) : min;
      siglas.forEach((s) => res.push({ fecha, asignatura: s, titulo, minutos: tipo === 'estudio' ? parte : 0, tipo, bloques: tipo === 'estudio' ? asignarBloques(s, titulo) : [], sugerida: false }));
    });
    return res;
  }

  /* Asignaturas con apuntes que no salen en el calendario: reparte sus bloques antes del examen. */
  function sugerir(tareas) {
    const hoy = U.hoy();
    const res = [];
    App.asignaturas.forEach((a) => {
      const bl = Modelo.bloquesDe(a.id);
      if (!bl.length || tareas.some((t) => t.asignatura === a.id)) return;
      let fin = a.examen && a.examen > hoy ? U.sumarDias(a.examen, -1) : U.sumarDias(hoy, 21);
      const dias = Math.max(1, U.diasEntre(hoy, fin) + 1);
      // agrupar bloques pequeños en sesiones de al menos 20 min
      const grupos = [];
      let g = null;
      bl.forEach((b) => {
        if (!g || g.palabras >= 300) { g = { bloques: [], palabras: 0, titulos: [] }; grupos.push(g); }
        g.bloques.push(b.n); g.palabras += b.palabras; g.titulos.push(b.titulo);
      });
      grupos.forEach((gr, i) => {
        const dia = U.sumarDias(hoy, Math.min(dias - 1, Math.floor((i * dias) / grupos.length)));
        const min = Math.min(120, Math.max(20, Math.round(gr.palabras / 15 / 5) * 5));
        res.push({ fecha: dia, asignatura: a.id, titulo: `Estudiar: ${gr.titulos.slice(0, 3).join(', ')}${gr.titulos.length > 3 ? '…' : ''}`, minutos: min, tipo: 'estudio', bloques: gr.bloques, sugerida: true });
      });
    });
    return res;
  }

  return { leer, sugerir, fechaDe, minutosDe, asignarBloques };
})();
