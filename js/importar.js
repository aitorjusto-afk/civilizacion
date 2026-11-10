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
  /* Líneas de texto de una página (para el calendario, la búsqueda y la IA). Celdas separadas con " | ". */
  function lineasDePagina(tc, separarCeldas = true) {
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
    return lineas.map((l) => {
      l.items.sort((a, b) => a.x - b.x);
      let txt = '', fin = null;
      l.items.forEach((it) => {
        if (fin !== null) {
          const hueco = it.x - fin;
          if (separarCeldas && hueco > Math.max(10, it.alto * 1.2)) txt += ' | ';
          else if (hueco > it.alto * 0.15 && !txt.endsWith(' ') && !it.s.startsWith(' ')) txt += ' ';
        }
        txt += it.s; fin = it.x + it.w;
      });
      return { texto: txt.replace(/\s+/g, ' ').trim(), alto: l.alto };
    }).filter((l) => l.texto);
  }

  /* Texto de un PDF (para el calendario). */
  async function textoDePdf(file) {
    const lib = await cargarPdfjs();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const paginas = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      paginas.push(lineasDePagina(tc).map((l) => l.texto).join('\n'));
    }
    pdf.destroy();
    return paginas.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- Apuntes en PDF: se guarda el archivo original y se divide en bloques de páginas ---------- */
  async function paginaDeDestino(pdf, dest) {
    try {
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (!Array.isArray(dest)) return null;
      const ref = dest[0];
      const idx = typeof ref === 'object' && ref ? await pdf.getPageIndex(ref) : Number(ref);
      if (!Number.isInteger(idx)) return null;
      // ¿El destino está arriba del todo de la página?
      let arriba = true;
      const modo = dest[1] && dest[1].name;
      if ((modo === 'XYZ' || modo === 'FitH' || modo === 'FitBH') && typeof dest[modo === 'XYZ' ? 3 : 2] === 'number') {
        const v = (await pdf.getPage(idx + 1)).view; // [x0, y0, x1, y1]
        arriba = dest[modo === 'XYZ' ? 3 : 2] >= v[1] + (v[3] - v[1]) * 0.8;
      }
      return { pagina: idx + 1, arriba };
    } catch (e) { return null; }
  }
  /* De una lista de títulos con su página, saca los bloques con su rango de páginas.
     Un bloque llega hasta donde empieza el siguiente de su mismo nivel: si ese empieza arriba del todo, hasta la página anterior;
     si empieza a mitad de página, esa página se incluye en los dos. */
  function rangos(items, total) {
    if (!items.length) return [];
    const res = items.map((it, i) => {
      let fin = total;
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].nivel <= it.nivel) { fin = Math.max(it.pagina, items[j].pagina - (items[j].arriba ? 1 : 0)); break; }
      }
      return { titulo: it.titulo, nivel: it.nivel, pagIni: it.pagina, pagFin: fin };
    });
    if (items[0].pagina > 1) res.unshift({ titulo: 'Primeras páginas', nivel: 1, pagIni: 1, pagFin: items[0].pagina - 1 });
    return res;
  }
  async function bloquesDeIndice(pdf) {
    let indice = null;
    try { indice = await pdf.getOutline(); } catch (e) { return []; }
    if (!indice || !indice.length) return [];
    const items = [];
    const recorrer = async (lista, nivel) => {
      for (const it of lista) {
        const d = await paginaDeDestino(pdf, it.dest);
        if (d && it.title && it.title.trim()) items.push({ titulo: it.title.trim(), pagina: d.pagina, arriba: d.arriba, nivel });
        if (nivel < 2 && it.items && it.items.length) await recorrer(it.items, nivel + 1);
      }
    };
    await recorrer(indice, 1);
    return rangos(items, pdf.numPages);
  }
  /* Sin índice: busca títulos por tamaño de letra (descarta cabeceras que se repiten en muchas páginas). */
  function bloquesPorTitulos(lineas, total) {
    const altos = lineas.map((l) => l.alto).sort((a, b) => a - b);
    const mediana = altos[Math.floor(altos.length / 2)] || 10;
    const repetidas = {};
    lineas.forEach((l) => { repetidas[l.texto] = (repetidas[l.texto] || new Set()).add(l.pagina); });
    let cand = lineas.filter((l) => l.alto >= mediana * 1.25 && l.texto.length >= 3 && l.texto.length <= 90 && /[a-záéíóúñ]{3}/i.test(l.texto)
      && repetidas[l.texto].size <= Math.max(2, total * 0.3));
    // une títulos de varias líneas seguidas
    const unidos = [];
    cand.forEach((l) => {
      const u = unidos[unidos.length - 1];
      if (u && u.pagina === l.pagina && Math.abs(u.alto - l.alto) < 0.5 && u.indice === l.indice - 1 && u.titulo.length < 90) { u.titulo += ' ' + l.texto; u.indice = l.indice; }
      else unidos.push({ titulo: l.texto, pagina: l.pagina, alto: l.alto, indice: l.indice, arriba: l.posicion <= 2 });
    });
    cand = unidos;
    if (cand.length > total * 3) { // demasiados: quedarse con el tamaño mayor
      const max = Math.max(...cand.map((c) => c.alto));
      cand = cand.filter((c) => c.alto >= max - 0.5);
    }
    if (cand.length < 2 || cand.length > 250) return [];
    const tamanos = [...new Set(cand.map((c) => Math.round(c.alto)))].sort((a, b) => b - a);
    return rangos(cand.map((c) => ({ titulo: c.titulo, pagina: c.pagina, arriba: c.arriba, nivel: Math.min(3, tamanos.indexOf(Math.round(c.alto)) + 1) })), total);
  }
  async function analizarPdf(file) {
    const lib = await cargarPdfjs();
    const datos = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: new Uint8Array(datos.slice(0)) }).promise; // copia: pdf.js se queda el búfer
    const textos = [], lineas = [];
    let proporcion = 1.414, indice = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const pagina = await pdf.getPage(p);
      if (p === 1) { const v = pagina.getViewport({ scale: 1 }); proporcion = v.height / v.width; }
      const ls = lineasDePagina(await pagina.getTextContent(), false);
      textos.push(ls.map((l) => l.texto).join('\n'));
      ls.forEach((l, k) => lineas.push({ ...l, pagina: p, indice: indice++, posicion: k }));
    }
    let bloques = await bloquesDeIndice(pdf);
    if (!bloques.length) bloques = bloquesPorTitulos(lineas, pdf.numPages);
    if (!bloques.length) {
      bloques = textos.map((t, i) => {
        const primera = (t.split('\n').find((x) => x.trim().length > 3) || '').slice(0, 60);
        return { titulo: `Página ${i + 1}${primera ? ': ' + primera : ''}`, nivel: 1, pagIni: i + 1, pagFin: i + 1 };
      });
    }
    const n = pdf.numPages;
    pdf.destroy();
    return { id: U.uid(), nombre: file.name, paginas: n, proporcion, bloques, textos, datos };
  }

  const esPdf = (file) => file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

  async function leerArchivo(file) {
    if (esPdf(file)) return textoDePdf(file);
    return U.leerTexto(file);
  }

  /* Lee archivos de apuntes: los PDF se guardan tal cual; .md y .txt como texto. */
  async function leerApuntes(archivos) {
    const textos = [], pdfs = [];
    for (const f of archivos) {
      if (esPdf(f)) pdfs.push(await analizarPdf(f));
      else textos.push(await U.leerTexto(f));
    }
    return { texto: textos.join('\n\n'), pdfs };
  }
  async function guardarApuntesLeidos(sigla, leidos, modo) {
    if (modo === 'anadir') {
      if (leidos.texto) await Modelo.guardarApuntes(sigla, ((App.apuntes[sigla] || '') + '\n\n' + leidos.texto).trim());
      if (leidos.pdfs.length) await Modelo.guardarPdfs(sigla, [...(App.pdfs[sigla] || []), ...leidos.pdfs]);
    } else {
      await Modelo.guardarApuntes(sigla, leidos.texto);
      await Modelo.guardarPdfs(sigla, leidos.pdfs);
    }
  }

  /* ---------- Render ---------- */
  function render() {
    const cont = U.$('#importar-contenido');
    const n = App.calendario ? App.calendario.split('\n').filter((l) => l.trim()).length : 0;
    cont.innerHTML = `
      <div class="barra-herr"><h1>Importar</h1></div>
      <ol class="pasos">
        <li class="${App.calendario ? 'hecho' : ''}">Calendario</li>
        <li class="${Modelo.hayAlgunApunte() ? 'hecho' : ''}">Apuntes</li>
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
        <p class="pista">Por cada asignatura puedes pegar texto o importar archivos .md, .txt o .pdf. Los PDF se guardan tal cual y se leen con su formato original; se dividen en bloques según su índice. El texto se divide por sus títulos.</p>
        <div class="acciones">
          <label class="btn">📚 Importar varios archivos<input type="file" id="ap-varios" multiple accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf" hidden></label>
          <button class="btn" id="ap-ejemplo">🧪 Cargar apuntes de ejemplo</button>
        </div>
        <ul class="lista-apuntes">${App.asignaturas.map((a) => {
          const bl = Modelo.bloquesDe(a.id);
          const pdfs = App.pdfs[a.id] || [];
          const pal = U.bloques(App.apuntes[a.id] || '').reduce((s, b) => s + b.palabras, 0);
          const partes = [];
          if (pdfs.length) partes.push(`${pdfs.length} PDF (${pdfs.reduce((s, p) => s + p.paginas, 0)} págs.)`);
          if (pal) partes.push(`texto (${pal} palabras)`);
          return `<li style="--c:${a.color}"><span class="sigla" style="background:${a.color};color:${U.colorTexto(a.color)}">${U.esc(a.id)}</span>
            <span class="nombre">${U.esc(a.nombre)}<br><small class="pista">${bl.length ? `${partes.join(' + ')} · ${bl.length} bloques` : 'Sin apuntes'}</small></span>
            <span class="acciones"><label class="btn mini">Importar<input type="file" data-ap="${U.esc(a.id)}" multiple accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf" hidden></label>
            <button class="btn mini" data-pegar="${U.esc(a.id)}">${bl.length ? 'Ver' : 'Pegar texto'}</button></span></li>`;
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
    U.$$('[data-pegar]').forEach((b) => (b.onclick = () => Apuntes.abrir(b.dataset.pegar, !Modelo.hayApuntes(b.dataset.pegar))));
    U.$('#ap-varios').onchange = (e) => importarVarios([...e.target.files]);
    U.$('#ap-ejemplo').onclick = cargarApuntesEjemplo;

    IA.renderZona(U.$('#gen-zona'));
    IA.renderVistaPrevia();
  }

  async function importarApuntes(sigla, archivos) {
    if (!archivos.length) return;
    try {
      let modo = 'sustituir';
      if (Modelo.hayApuntes(sigla)) {
        modo = await U.modal('Ya hay apuntes', `<p>${U.esc(Modelo.nombreDe(sigla))} ya tiene apuntes. ¿Qué hago con los nuevos?</p><p class="pista">Si antes importaste un PDF y se veía mal, elige «Sustituir».</p>`, [
          { texto: 'Cancelar', valor: null }, { texto: 'Añadir', valor: 'anadir' }, { texto: 'Sustituir', valor: 'sustituir', clase: 'primario' }]);
        if (!modo) return;
      }
      U.tostada('Leyendo los apuntes…', { duracion: 2000 });
      await guardarApuntesLeidos(sigla, await leerApuntes(archivos), modo);
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
      for (const [sigla, fs] of Object.entries(porAsig)) await guardarApuntesLeidos(sigla, await leerApuntes(fs), 'sustituir');
      U.tostada(`Apuntes importados en ${Object.keys(porAsig).length} asignaturas`);
    } catch (err) { console.error(err); U.avisar('No se pudo importar', U.esc(err.message)); }
    render();
  }

  async function cargarApuntesEjemplo() {
    const hay = Modelo.hayAlgunApunte();
    if (hay && !(await U.confirmar('Cargar apuntes de ejemplo', 'Se sustituirán los apuntes de las asignaturas de ejemplo (SI, ED, DWES, BD, PROG y LM). ¿Seguir?', 'Cargar'))) return;
    for (const [sigla, texto] of Object.entries(Ejemplo.apuntes)) if (Modelo.asig(sigla)) { await Modelo.guardarApuntes(sigla, texto); await Modelo.guardarPdfs(sigla, []); }
    U.tostada('Apuntes de ejemplo cargados');
    render();
  }

  return { render, textoDePdf, leerArchivo, analizarPdf, cargarPdfjs };
})();
