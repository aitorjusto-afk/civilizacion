/* Pantalla Importar: calendario (PDF o texto), apuntes por asignatura (.md, .txt, .pdf) y zona de generación. */
'use strict';

const Importar = (() => {
  /* ---------- pdf.js (se carga solo cuando hace falta) ---------- */
  async function cargarPdfjs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await U.cargarScript('vendor/pdf.min.js');
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    // Abierta como archivo local (file://) el navegador no deja crear el worker: se carga en la página.
    if (location.protocol === 'file:') await U.cargarScript('vendor/pdf.worker.min.js');
    return lib;
  }

  /* Extrae el texto de un PDF reconstruyendo las líneas. Las celdas separadas se unen con " | ".
     Con conTitulos, las líneas de letra grande se convierten en títulos Markdown (para apuntes). */
  async function textoDePdf(file, { conTitulos = false } = {}) {
    const lib = await cargarPdfjs();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const todas = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const pagina = await pdf.getPage(p);
      const tc = await pagina.getTextContent();
      const lineas = [];
      tc.items.forEach((it) => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4], y = it.transform[5];
        const alto = Math.abs(it.height || Math.hypot(it.transform[2], it.transform[3])) || 10;
        let l = lineas.find((L) => Math.abs(L.y - y) < Math.max(2.5, alto * 0.35));
        if (!l) { l = { y, items: [], alto: 0 }; lineas.push(l); }
        l.items.push({ x, w: it.width || 0, s: it.str, alto });
        l.alto = Math.max(l.alto, alto);
      });
      lineas.sort((a, b) => b.y - a.y);
      lineas.forEach((l) => {
        l.items.sort((a, b) => a.x - b.x);
        let txt = '', fin = null;
        l.items.forEach((it) => {
          if (fin !== null) {
            const hueco = it.x - fin;
            if (hueco > Math.max(10, it.alto * 1.2)) txt += ' | ';
            else if (hueco > it.alto * 0.15 && !txt.endsWith(' ') && !it.s.startsWith(' ')) txt += ' ';
          }
          txt += it.s; fin = it.x + it.w;
        });
        todas.push({ texto: txt.replace(/\s+/g, ' ').trim(), alto: l.alto });
      });
      todas.push({ texto: '', alto: 0 });
    }
    if (!conTitulos) return todas.map((l) => l.texto).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const altos = todas.filter((l) => l.texto).map((l) => l.alto).sort((a, b) => a - b);
    const mediana = altos[Math.floor(altos.length / 2)] || 10;
    return todas.map((l) => {
      if (!l.texto) return '';
      if (l.alto > mediana * 1.5 && l.texto.length < 90) return `\n# ${l.texto}\n`;
      if (l.alto > mediana * 1.2 && l.texto.length < 90) return `\n## ${l.texto}\n`;
      return l.texto;
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function leerArchivo(file, paraApuntes) {
    const nombre = file.name.toLowerCase();
    if (nombre.endsWith('.pdf') || file.type === 'application/pdf') return textoDePdf(file, { conTitulos: paraApuntes });
    return U.leerTexto(file);
  }

  /* ---------- Render ---------- */
  function render() {
    const cont = U.$('#importar-contenido');
    const n = App.calendario ? App.calendario.split('\n').filter((l) => l.trim()).length : 0;
    cont.innerHTML = `
      <div class="barra-herr"><h1>Importar</h1></div>
      <ol class="pasos">
        <li class="${App.calendario ? 'hecho' : ''}">Calendario</li>
        <li class="${Object.keys(App.apuntes).length ? 'hecho' : ''}">Apuntes</li>
        <li class="${App.tareas.length ? 'hecho' : ''}">Generar checklist</li>
      </ol>

      <section class="tarjeta" id="imp-calendario">
        <h2>1 · Calendario</h2>
        <p class="pista">Sube el PDF de tu calendario (tabla con <em>Día | Asignatura | Qué hacer | Tiempo</em>) o pega el texto. El texto se extrae aquí mismo, en tu navegador.</p>
        <div class="acciones">
          <label class="btn primario">📄 Subir PDF o texto<input type="file" id="cal-archivo" accept=".pdf,.txt,.md,.csv,application/pdf,text/plain" hidden></label>
          <button class="btn" id="cal-ejemplo">🧪 Cargar calendario de ejemplo</button>
        </div>
        <textarea id="cal-texto" rows="9" placeholder="Día | Asignatura | Qué hacer | Tiempo&#10;lun 9-nov | SI | Leer el bloque 1 | 45 min&#10;lun 16-nov | SI | EXAMEN Sistemas 12:30 | —">${U.esc(App.calendario)}</textarea>
        <div class="acciones"><button class="btn" id="cal-guardar">Guardar calendario</button><span class="pista" id="cal-estado">${n ? `Guardado: ${n} líneas.` : 'Sin calendario guardado.'}</span></div>
      </section>

      <section class="tarjeta" id="imp-apuntes">
        <h2>2 · Apuntes</h2>
        <p class="pista">Por cada asignatura puedes pegar texto o importar archivos .md, .txt o .pdf. Se dividen en bloques numerados por sus títulos.</p>
        <div class="acciones">
          <label class="btn">📚 Importar varios archivos<input type="file" id="ap-varios" multiple accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf" hidden></label>
          <button class="btn" id="ap-ejemplo">🧪 Cargar apuntes de ejemplo</button>
        </div>
        <ul class="lista-apuntes">${App.asignaturas.map((a) => {
          const bl = Modelo.bloquesDe(a.id);
          const pal = bl.reduce((s, b) => s + b.palabras, 0);
          return `<li style="--c:${a.color}"><span class="sigla" style="background:${a.color};color:${U.colorTexto(a.color)}">${U.esc(a.id)}</span>
            <span class="nombre">${U.esc(a.nombre)}<br><small class="pista">${bl.length ? `${bl.length} bloques · ${pal} palabras` : 'Sin apuntes'}</small></span>
            <span class="acciones"><label class="btn mini">Importar<input type="file" data-ap="${U.esc(a.id)}" multiple accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf" hidden></label>
            <button class="btn mini" data-pegar="${U.esc(a.id)}">${bl.length ? 'Editar' : 'Pegar'}</button></span></li>`;
        }).join('')}</ul>
      </section>

      <section class="tarjeta" id="imp-generar">
        <h2>3 · Generar la checklist</h2>
        <div id="gen-zona"></div>
      </section>
      <div id="vista-previa"></div>`;

    U.$('#cal-archivo').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      U.$('#cal-estado').textContent = 'Leyendo…';
      try {
        const txt = await leerArchivo(f, false);
        U.$('#cal-texto').value = txt;
        await Modelo.guardarCalendario(txt);
        U.tostada(`Calendario leído: ${txt.split('\n').filter((l) => l.trim()).length} líneas. Revísalo y corrige lo que haga falta.`);
        render();
      } catch (err) { console.error(err); U.$('#cal-estado').textContent = 'No se pudo leer el archivo: ' + err.message; }
    };
    U.$('#cal-ejemplo').onclick = async () => { await Modelo.guardarCalendario(Ejemplo.calendario); U.tostada('Calendario de ejemplo cargado'); render(); };
    U.$('#cal-guardar').onclick = async () => { await Modelo.guardarCalendario(U.$('#cal-texto').value); U.tostada('Calendario guardado'); render(); };

    U.$$('[data-ap]').forEach((inp) => (inp.onchange = (e) => importarApuntes(inp.dataset.ap, [...e.target.files])));
    U.$$('[data-pegar]').forEach((b) => (b.onclick = () => Apuntes.abrir(b.dataset.pegar, true)));
    U.$('#ap-varios').onchange = (e) => importarVarios([...e.target.files]);
    U.$('#ap-ejemplo').onclick = cargarApuntesEjemplo;

    IA.renderZona(U.$('#gen-zona'));
    IA.renderVistaPrevia();
  }

  async function importarApuntes(sigla, archivos) {
    if (!archivos.length) return;
    try {
      const textos = [];
      for (const f of archivos) textos.push(await leerArchivo(f, true));
      let nuevo = textos.join('\n\n');
      if (App.apuntes[sigla]) {
        const r = await U.modal('Ya hay apuntes', `<p>${U.esc(Modelo.nombreDe(sigla))} ya tiene apuntes. ¿Qué hago con los nuevos?</p>`, [
          { texto: 'Cancelar', valor: null }, { texto: 'Añadir al final', valor: 'anadir' }, { texto: 'Sustituir', valor: 'sustituir', clase: 'primario' }]);
        if (!r) return;
        if (r === 'anadir') nuevo = App.apuntes[sigla] + '\n\n' + nuevo;
      }
      await Modelo.guardarApuntes(sigla, nuevo);
      U.tostada(`Apuntes de ${sigla}: ${Modelo.bloquesDe(sigla).length} bloques`);
      render();
    } catch (err) { console.error(err); U.avisar('No se pudo importar', U.esc(err.message)); }
  }

  function adivinarAsignatura(nombreArchivo) {
    const n = U.sinAcentos(nombreArchivo.replace(/\.[^.]+$/, '')).replace(/[_\-.]+/g, ' ');
    const palabras = n.split(/\s+/);
    for (const a of App.asignaturas) if (palabras.includes(U.sinAcentos(a.id))) return a.id;
    for (const a of App.asignaturas) {
      const claves = U.sinAcentos(a.nombre).split(/\s+/).filter((w) => w.length > 4);
      if (claves.some((w) => n.includes(w))) return a.id;
    }
    return '';
  }

  async function importarVarios(archivos) {
    if (!archivos.length) return;
    const form = U.el(`<div class="form">${archivos.map((f, i) => `<label>${U.esc(f.name)}
      <select data-i="${i}"><option value="">— No importar —</option>${App.asignaturas.map((a) => `<option value="${U.esc(a.id)}" ${adivinarAsignatura(f.name) === a.id ? 'selected' : ''}>${U.esc(a.id)} · ${U.esc(a.nombre)}</option>`).join('')}</select></label>`).join('')}
      <p class="pista">Si una asignatura ya tenía apuntes, se sustituyen.</p></div>`);
    const r = await U.modal('¿De qué asignatura es cada archivo?', form, [{ texto: 'Cancelar', valor: null }, { texto: 'Importar', clase: 'primario', valor: () => U.$$('select', form).map((s) => s.value) }]);
    if (!r) return;
    const porAsig = {};
    r.forEach((sigla, i) => { if (sigla) (porAsig[sigla] = porAsig[sigla] || []).push(archivos[i]); });
    try {
      for (const [sigla, fs] of Object.entries(porAsig)) {
        const textos = [];
        for (const f of fs) textos.push(await leerArchivo(f, true));
        await Modelo.guardarApuntes(sigla, textos.join('\n\n'));
      }
      U.tostada(`Apuntes importados en ${Object.keys(porAsig).length} asignaturas`);
    } catch (err) { console.error(err); U.avisar('No se pudo importar', U.esc(err.message)); }
    render();
  }

  async function cargarApuntesEjemplo() {
    const hay = Object.keys(App.apuntes).length;
    if (hay && !(await U.confirmar('Cargar apuntes de ejemplo', 'Se sustituirán los apuntes de las asignaturas de ejemplo (SI, ED, DWES, BD, PROG y LM). ¿Seguir?', 'Cargar'))) return;
    for (const [sigla, texto] of Object.entries(Ejemplo.apuntes)) if (Modelo.asig(sigla)) await Modelo.guardarApuntes(sigla, texto);
    U.tostada('Apuntes de ejemplo cargados');
    render();
  }

  return { render, textoDePdf, leerArchivo };
})();
