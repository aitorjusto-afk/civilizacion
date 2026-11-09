/* Pantalla de apuntes: pestañas por asignatura, lectura renderizada, buscador y editor. */
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
    U.$('#pestanas-apuntes').innerHTML = App.asignaturas.map((a) => `<button role="tab" class="pestana ${a.id === actual ? 'activa' : ''}" aria-selected="${a.id === actual}" data-a="${U.esc(a.id)}" style="--c:${a.color}">${U.esc(a.id)}${App.apuntes[a.id] ? '' : ' <span class="pista">·</span>'}</button>`).join('');
    U.$$('#pestanas-apuntes [data-a]').forEach((b) => (b.onclick = () => { actual = b.dataset.a; editando = false; render(); }));
    pintar();
  }

  function pintar() {
    const cont = U.$('#apuntes-contenido');
    const a = Modelo.asig(actual);
    const texto = App.apuntes[actual] || '';
    U.$('.buscador').hidden = editando || !texto;
    if (editando) {
      cont.innerHTML = `<div class="tarjeta editor">
        <div class="barra-herr"><h2>${U.esc(a.nombre)} · editar</h2>
        <div class="acciones"><button class="btn" id="ap-cancelar">Cancelar</button><button class="btn primario" id="ap-guardar">Guardar</button></div></div>
        <p class="pista">Escribe en Markdown. Cada título (<code>#</code>, <code>##</code> o <code>###</code>) empieza un bloque numerado; el modo estudio abre los bloques de cada tarea.</p>
        <textarea id="ap-texto" spellcheck="true" placeholder="# Tema 1\nTus apuntes…">${U.esc(texto)}</textarea></div>`;
      U.$('#ap-cancelar').onclick = () => { editando = false; pintar(); };
      U.$('#ap-guardar').onclick = async () => {
        await Modelo.guardarApuntes(actual, U.$('#ap-texto').value);
        editando = false; U.tostada('Apuntes guardados'); render();
      };
      return;
    }
    const bl = Modelo.bloquesDe(actual);
    if (!texto) {
      cont.innerHTML = `<div class="tarjeta vacio"><h2>${U.esc(a.nombre)}</h2><p>Aún no hay apuntes de esta asignatura.</p>
        <p><button class="btn primario" id="ap-editar">✎ Pegar o escribir apuntes</button> <a class="btn" href="#importar">Importar .md, .txt o .pdf</a></p></div>`;
      U.$('#ap-editar').onclick = () => { editando = true; pintar(); };
      return;
    }
    cont.innerHTML = `<div class="apuntes-disposicion">
      <nav class="indice tarjeta"><strong>Bloques</strong><ol>${bl.map((b) => `<li><a href="#" data-b="${b.n}">${U.esc(b.titulo)}</a></li>`).join('')}</ol></nav>
      <article class="tarjeta lectura">
        <div class="barra-herr"><h2>${U.esc(a.nombre)}</h2><div class="acciones"><button class="btn mini" id="ap-editar">✎ Editar</button></div></div>
        <div id="ap-render">${bl.map((b) => `<section class="bloque" id="bloque-${U.esc(actual)}-${b.n}"><span class="num-bloque">Bloque ${b.n}</span>${U.md(b.texto)}</section>`).join('')}</div>
      </article></div>`;
    U.$('#ap-editar').onclick = () => { editando = true; pintar(); };
    U.$$('[data-b]', cont).forEach((l) => (l.onclick = (e) => { e.preventDefault(); U.$(`#bloque-${CSS.escape(actual)}-${l.dataset.b}`).scrollIntoView({ behavior: 'smooth' }); }));
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
      const plano = U.sinAcentos(original); // misma longitud en casi todos los casos
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

  function buscar(q) {
    const raiz = U.$('#ap-render');
    if (!raiz) return;
    marcas = resaltar(raiz, q || '');
    indice = marcas.length ? 0 : -1;
    U.$('#buscar-info').textContent = q && q.trim().length >= 2 ? (marcas.length ? `${marcas.length} resultados` : 'Sin resultados') : '';
    mover(0);
  }
  function mover(d) {
    if (!marcas.length) return;
    indice = (indice + d + marcas.length) % marcas.length;
    marcas.forEach((m) => m.classList.remove('actual'));
    marcas[indice].classList.add('actual');
    marcas[indice].scrollIntoView({ behavior: 'smooth', block: 'center' });
    U.$('#buscar-info').textContent = `${indice + 1} de ${marcas.length}`;
  }

  function abrir(sigla, editar) { actual = sigla; editando = !!editar; location.hash = '#apuntes'; render(); }

  function init() {
    let t;
    U.$('#buscar-apuntes').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => buscar(e.target.value), 180); });
    U.$('#buscar-apuntes').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); mover(e.shiftKey ? -1 : 1); } });
    U.$('#buscar-sig').onclick = () => mover(1);
    U.$('#buscar-ant').onclick = () => mover(-1);
  }

  return { render, init, abrir, resaltar };
})();
