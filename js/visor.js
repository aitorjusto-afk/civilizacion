/* Visor de PDF: dibuja las páginas originales tal cual (solo cuando se van a ver). */
'use strict';

const Visor = (() => {
  const documentos = new Map(); // id → Promise<PDFDocumentProxy>
  let observador = null;

  function documento(info) {
    if (!documentos.has(info.id)) {
      documentos.set(info.id, Importar.cargarPdfjs().then((lib) => lib.getDocument({ data: new Uint8Array(info.datos.slice(0)) }).promise));
    }
    return documentos.get(info.id);
  }

  async function pintar(div) {
    const info = Modelo.pdfPorId(div.dataset.pdf);
    if (!info) return;
    try {
      const pdf = await documento(info);
      const pagina = await pdf.getPage(Number(div.dataset.p));
      const base = pagina.getViewport({ scale: 1 });
      const ancho = div.clientWidth || 800;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const vista = pagina.getViewport({ scale: (ancho / base.width) * dpr });
      const lienzo = div.querySelector('canvas');
      lienzo.width = Math.floor(vista.width);
      lienzo.height = Math.floor(vista.height);
      div.style.aspectRatio = `${base.width} / ${base.height}`;
      await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise;
      div.classList.add('lista');
    } catch (e) {
      console.error(e);
      div.dataset.hecho = '';
      div.classList.add('fallo');
    }
  }

  function observar(div) {
    if (!('IntersectionObserver' in window)) { pintar(div); return; }
    if (!observador) {
      observador = new IntersectionObserver((entradas) => entradas.forEach((e) => {
        if (e.isIntersecting && !e.target.dataset.hecho) { e.target.dataset.hecho = '1'; observador.unobserve(e.target); pintar(e.target); }
      }), { rootMargin: '800px 0px' });
    }
    observador.observe(div);
  }

  /* Añade a cont las páginas ini..fin del PDF. */
  function paginas(cont, info, ini = 1, fin = info.paginas) {
    for (let p = Math.max(1, ini); p <= Math.min(fin, info.paginas); p++) {
      const div = document.createElement('div');
      div.className = 'pagina-pdf';
      div.dataset.pdf = info.id;
      div.dataset.p = p;
      div.style.aspectRatio = `1 / ${info.proporcion || 1.414}`;
      div.innerHTML = `<canvas></canvas><span class="num-pag">${p}</span>`;
      cont.appendChild(div);
      observar(div);
    }
  }

  /* Junta los rangos de páginas de varios bloques del mismo PDF, sin repetir páginas. */
  function unirRangos(bloques) {
    const porPdf = new Map();
    bloques.forEach((b) => {
      if (!b.pdf) return;
      if (!porPdf.has(b.pdf.id)) porPdf.set(b.pdf.id, new Set());
      for (let p = b.pdf.pagIni; p <= b.pdf.pagFin; p++) porPdf.get(b.pdf.id).add(p);
    });
    const res = [];
    porPdf.forEach((set, id) => {
      const ps = [...set].sort((a, b) => a - b);
      let ini = ps[0], ant = ps[0];
      ps.slice(1).concat([null]).forEach((p) => {
        if (p !== null && p === ant + 1) { ant = p; return; }
        res.push({ id, ini, fin: ant });
        ini = ant = p;
      });
    });
    return res;
  }

  /* Busca en el texto de los PDF. Devuelve [{ info, p, fragmento }]. */
  function buscar(lista, consulta) {
    const q = U.sinAcentos(consulta.trim());
    if (q.length < 2) return [];
    const res = [];
    lista.forEach((info) => (info.textos || []).forEach((t, i) => {
      const plano = U.sinAcentos(t).replace(/\s+/g, ' ');
      const k = plano.indexOf(q);
      if (k < 0) return;
      const original = t.replace(/\s+/g, ' ');
      res.push({ info, p: i + 1, fragmento: original.slice(Math.max(0, k - 50), k + q.length + 60) });
    }));
    return res;
  }

  function abrirOriginal(info) {
    const url = URL.createObjectURL(new Blob([info.datos], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function olvidar(id) { const d = documentos.get(id); if (d) d.then((x) => x.destroy()).catch(() => {}); documentos.delete(id); }

  return { paginas, unirRangos, buscar, abrirOriginal, olvidar };
})();
