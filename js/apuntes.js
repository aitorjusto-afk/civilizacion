/* Pantalla de apuntes: pestañas por asignatura, lectura (texto y PDF originales), buscador y editor. */
'use strict';

const Apuntes = (() => {
  let actual = null;
  let editando = false;
  let marcas = [], indice = -1;

  function render() {
    if (!App.asignaturas.length) {
      U.$('#pestanas-apuntes').innerHTML = '';
      U.$('#apuntes-contenido').innerHTML = '<div class="tarjeta vacio">Crea primero tus asignaturas.</div>';
      return;
    }
    if (!actual || !Modelo.asig(actual)) actual = App.asignaturas[0].id;
    U.$('#pestanas-apuntes').innerHTML = App.asignaturas.map((a) => `<button role="tab" class="pestana ${a.id === actual ? 'activa' : ''}" aria-selected="${a.id === actual}" data-a="${U.esc(a.id)}" style="--c:${a.color}">${U.esc(a.id)}${Modelo.hayApuntes(a.id) ? '' : ' <span class="pista">·</span>'}</button>`).join('');
    U.$$('#pestanas-apuntes [data-a]').forEach((b) => (b.onclick = () => { actual = b.dataset.a; editando = false; render(); }));
    pintar();
  }

  /* Pinta en cont los bloques indicados: texto con su formato y PDF con sus páginas originales. */
  function pintarBloques(cont, bloques, sigla) {
    const textos = bloques.filter((b) => !b.pdf);
    let html = textos.map((b) => `<section class="bloque" id="bloque-${U.esc(sigla)}-${b.n}">${U.md(b.texto)}</section>`).join('');
    cont.innerHTML = html;
    Visor.unirRangos(bloques).forEach((r) => {
      const info = Modelo.pdfPorId(r.id);
      if (!info) return;
      const sec = U.el(`<section class="pdf-doc"><div class="pdf-cab">📄 <strong>${U.esc(info.nombre)}</strong> <span class="pista">${r.ini === 1 && r.fin === info.paginas ? `${info.paginas} páginas` : r.ini === r.fin ? `página ${r.ini}` : `páginas ${r.ini}–${r.fin}`}</span></div><div class="pdf-paginas"></div></section>`);
      cont.appendChild(sec);
      Visor.paginas(U.$('.pdf-paginas', sec), info, r.ini, r.fin);
    });
  }

  function irABloque(raiz, sigla, b) {
    const destino = b.pdf ? U.$(`.pagina-pdf[data-pdf="${b.pdf.id}"][data-p="${b.pdf.pagIni}"]`, raiz) : U.$(`#bloque-${CSS.escape(sigla)}-${b.n}`, raiz);
    if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pintar() {
    const cont = U.$('#apuntes-contenido');
    const a = Modelo.asig(actual);
    const texto = App.apuntes[actual] || '';
    const pdfs = App.pdfs[actual] || [];
    U.$('.buscador').hidden = editando || !Modelo.hayApuntes(actual);
    if (editando) {
      cont.innerHTML = `<div class="tarjeta editor">
        <div class="barra-herr"><h2>${U.esc(a.nombre)} · texto</h2>
        <div class="acciones"><button class="btn" id="ap-cancelar">Cancelar</button><button class="btn primario" id="ap-guardar">Guardar</button></div></div>
        <p class="pista">Escribe o pega tus apuntes. Se muestran tal cual, con los saltos de línea. Si usas títulos de Markdown (<code>#</code>, <code>##</code>, <code>###</code>), cada uno empieza un bloque para el modo estudio.${pdfs.length ? ' Los PDF de esta asignatura no se tocan.' : ''}</p>
        <textarea id="ap-texto" spellcheck="true" placeholder="# Tema 1\nTus apuntes…">${U.esc(texto)}</textarea></div>`;
      U.$('#ap-cancelar').onclick = () => { editando = false; pintar(); };
      U.$('#ap-guardar').onclick = async () => {
        await Modelo.guardarApuntes(actual, U.$('#ap-texto').value);
        editando = false; U.tostada('Apuntes guardados'); render();
      };
      return;
    }
    if (!Modelo.hayApuntes(actual)) {
      cont.innerHTML = `<div class="tarjeta vacio"><h2>${U.esc(a.nombre)}</h2><p>Aún no hay apuntes de esta asignatura.</p>
        <p><button class="btn primario" id="ap-editar">✎ Pegar o escribir apuntes</button> <a class="btn" href="#importar">Importar .md, .txt o .pdf</a></p></div>`;
      U.$('#ap-editar').onclick = () => { editando = true; pintar(); };
      return;
    }
    const bl = Modelo.bloquesDe(actual);
    cont.innerHTML = `<div class="apuntes-disposicion">
      <nav class="indice tarjeta"><strong>Bloques</strong><ol>${bl.map((b) => `<li class="nivel-${Math.min(3, b.nivel || 1)}"><a href="#" data-b="${b.n}">${U.esc(b.titulo)}${b.pdf ? ` <span class="pista">p. ${b.pdf.pagIni}</span>` : ''}</a></li>`).join('')}</ol></nav>
      <article class="tarjeta lectura">
        <div class="barra-herr"><h2>${U.esc(a.nombre)}</h2><div class="acciones"><button class="btn mini" id="ap-editar">${texto ? '✎ Editar texto' : '＋ Añadir texto'}</button></div></div>
        ${pdfs.length ? `<ul class="lista-pdfs">${pdfs.map((p) => `<li>📄 ${U.esc(p.nombre)} <span class="pista">${p.paginas} págs.</span>
          <button class="btn mini" data-abrir="${p.id}">Abrir el PDF original</button><button class="btn mini peligro-txt" data-quitar="${p.id}">Quitar</button></li>`).join('')}</ul>` : ''}
        <div id="resultados-pdf"></div>
        <div id="ap-render"></div>
      </article></div>`;
    pintarBloques(U.$('#ap-render'), bl, actual);
    U.$('#ap-editar').onclick = () => { editando = true; pintar(); };
    U.$$('[data-b]', cont).forEach((l) => (l.onclick = (e) => { e.preventDefault(); irABloque(U.$('#ap-render'), actual, bl[Number(l.dataset.b) - 1]); }));
    U.$$('[data-abrir]', cont).forEach((b) => (b.onclick = () => Visor.abrirOriginal(Modelo.pdfPorId(b.dataset.abrir))));
    U.$$('[data-quitar]', cont).forEach((b) => (b.onclick = async () => {
      const info = Modelo.pdfPorId(b.dataset.quitar);
      if (!(await U.confirmar('Quitar PDF', `¿Quitar <strong>${U.esc(info.nombre)}</strong> de los apuntes de ${U.esc(actual)}? Los bloques de las tareas pueden dejar de coincidir.`, 'Quitar', 'Cancelar', true))) return;
      Visor.olvidar(info.id);
      await Modelo.guardarPdfs(actual, (App.pdfs[actual] || []).filter((p) => p.id !== info.id));
      render();
    }));
    buscar(U.$('#buscar-apuntes').value);
  }

  /* Resalta coincidencias dentro de un contenedor. Devuelve las marcas creadas. */
  function resaltar(raiz, consulta) {
    U.$$('mark.coincide', raiz).forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
    raiz.normalize();
    const q = U.sinAcentos(consulta.trim());
    if (q.length < 2) return [];
    const res = [];
    const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null);
    const nodos = [];
    while (recorrido.nextNode()) nodos.push(recorrido.currentNode);
    nodos.forEach((n) => {
      const original = n.nodeValue;
      const plano = U.sinAcentos(original);
      if (plano.length !== original.length) return;
      let i = plano.indexOf(q), ultimo = 0;
      if (i < 0) return;
      const frag = document.createDocumentFragment();
      while (i >= 0) {
        frag.appendChild(document.createTextNode(original.slice(ultimo, i)));
        const m = document.createElement('mark'); m.className = 'coincide'; m.textContent = original.slice(i, i + q.length);
        frag.appendChild(m); res.push(m);
        ultimo = i + q.length; i = plano.indexOf(q, ultimo);
      }
      frag.appendChild(document.createTextNode(original.slice(ultimo)));
      n.replaceWith(frag);
    });
    return res;
  }

  /* Lista de páginas de PDF donde aparece la búsqueda; al pulsar, salta a esa página. */
  function pintarResultadosPdf(caja, raiz, pdfs, q, mostrarTodo) {
    const r = Visor.buscar(pdfs, q || '');
    if (!r.length) { caja.innerHTML = ''; return 0; }
    caja.innerHTML = `<div class="resultados-pdf"><strong>En los PDF (${r.length} ${r.length === 1 ? 'página' : 'páginas'}):</strong><ul>${r.slice(0, 40).map((x, i) => `<li><a href="#" data-r="${i}">Pág. ${x.p}</a> <span class="pista">…${U.esc(x.fragmento)}…</span></li>`).join('')}</ul></div>`;
    U.$$('[data-r]', caja).forEach((l) => (l.onclick = (e) => {
      e.preventDefault();
      const x = r[Number(l.dataset.r)];
      let pag = U.$(`.pagina-pdf[data-pdf="${x.info.id}"][data-p="${x.p}"]`, raiz);
      if (!pag && mostrarTodo) { mostrarTodo(); pag = U.$(`.pagina-pdf[data-pdf="${x.info.id}"][data-p="${x.p}"]`, raiz); }
      if (pag) { pag.scrollIntoView({ behavior: 'smooth', block: 'start' }); pag.classList.add('destello'); setTimeout(() => pag.classList.remove('destello'), 1500); }
      else U.tostada(`Está en la página ${x.p} de ${x.info.nombre} (fuera de los bloques mostrados).`);
    }));
    return r.length;
  }

  function buscar(q) {
    const raiz = U.$('#ap-render');
    if (!raiz) return;
    marcas = resaltar(raiz, q || '');
    indice = marcas.length ? 0 : -1;
    const enPdf = pintarResultadosPdf(U.$('#resultados-pdf'), raiz, App.pdfs[actual] || [], q);
    const activa = q && q.trim().length >= 2;
    U.$('#buscar-info').textContent = activa ? (marcas.length || enPdf ? `${marcas.length} en el texto${enPdf ? ` · ${enPdf} págs. de PDF` : ''}` : 'Sin resultados') : '';
    if (marcas.length) mover(0);
  }
  function mover(d) {
    if (!marcas.length) return;
    indice = (indice + d + marcas.length) % marcas.length;
    marcas.forEach((m) => m.classList.remove('actual'));
    marcas[indice].classList.add('actual');
    marcas[indice].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function abrir(sigla, editar) { actual = sigla; editando = !!editar; location.hash = '#apuntes'; render(); }

  function init() {
    let t;
    U.$('#buscar-apuntes').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => buscar(e.target.value), 220); });
    U.$('#buscar-apuntes').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); mover(e.shiftKey ? -1 : 1); } });
    U.$('#buscar-sig').onclick = () => mover(1);
    U.$('#buscar-ant').onclick = () => mover(-1);
  }

  return { render, init, abrir, resaltar, pintarBloques, pintarResultadosPdf };
})();
