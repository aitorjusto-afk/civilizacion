/* Utilidades generales: fechas, HTML, markdown seguro, bloques de apuntes, modales y avisos. */
'use strict';

const U = (() => {
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = () => iso(new Date());
  const aFecha = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(aFecha(s));
  const sumarDias = (s, n) => { const d = aFecha(s); d.setDate(d.getDate() + n); return iso(d); };
  const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);

  function fmtDia(s) {
    if (!esFecha(s)) return 'Sin fecha';
    const d = aFecha(s);
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }
  function fmtCorto(s) {
    if (!esFecha(s)) return '—';
    const d = aFecha(s);
    return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
  }
  function fmtMin(m) {
    m = Math.round(m || 0);
    if (m <= 0) return '';
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return `${r} min`;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  function fmtReloj(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function hash(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function aleatorio(semilla) { // mulberry32
    let a = semilla >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function colorTexto(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#1f1d1a' : '#ffffff';
  }

  /* ---------- Markdown seguro ---------- */
  function md(texto) {
    let html = '';
    try { html = window.marked ? marked.parse(String(texto || ''), { gfm: true, breaks: true }) : `<pre>${esc(texto)}</pre>`; }
    catch (e) { html = `<pre>${esc(texto)}</pre>`; }
    try {
      const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
      doc.querySelectorAll('script,iframe,object,embed,style,link,meta,form,base').forEach((n) => n.remove());
      doc.querySelectorAll('*').forEach((el) => {
        [...el.attributes].forEach((a) => {
          if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action)$/i.test(a.name) && /^\s*(javascript|data:text\/html)/i.test(a.value))) el.removeAttribute(a.name);
        });
        if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
      });
      return doc.body.firstChild.innerHTML;
    } catch (e) { return `<pre>${esc(texto)}</pre>`; }
  }

  /* ---------- Bloques de apuntes ----------
     Se divide el texto por sus títulos (#, ##, ###). Cada título empieza un bloque numerado desde 1.
     Si no hay títulos, se trocea por párrafos en partes de ~1500 caracteres. */
  function bloques(texto) {
    texto = String(texto || '').replace(/\r\n?/g, '\n');
    if (!texto.trim()) return [];
    const lineas = texto.split('\n');
    const res = [];
    let actual = null, enCodigo = false, previo = [];
    for (const l of lineas) {
      if (/^\s*(```|~~~)/.test(l)) enCodigo = !enCodigo;
      const t = !enCodigo && /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(l);
      if (t) {
        if (actual) res.push(actual);
        actual = { titulo: t[2].trim(), nivel: t[1].length, lineas: [l] };
      } else if (actual) actual.lineas.push(l);
      else previo.push(l);
    }
    if (actual) res.push(actual);
    const intro = previo.join('\n').trim();
    if (!res.length) {
      // sin títulos: trocear por párrafos
      const parrafos = intro.split(/\n\s*\n/);
      let buf = '';
      const partes = [];
      for (const p of parrafos) {
        if (buf && (buf.length + p.length) > 1500) { partes.push(buf); buf = ''; }
        buf += (buf ? '\n\n' : '') + p;
      }
      if (buf) partes.push(buf);
      return partes.map((p, i) => mkBloque(i + 1, `Parte ${i + 1}`, p));
    }
    const lista = [];
    if (intro.length > 20) lista.push({ titulo: 'Introducción', lineas: [intro] });
    lista.push(...res);
    return lista.map((b, i) => mkBloque(i + 1, b.titulo, b.lineas.join('\n').trim(), b.nivel || 1));
  }
  function mkBloque(n, titulo, texto, nivel = 1) {
    const palabras = (texto.match(/\S+/g) || []).length;
    return { n, titulo: titulo.replace(/[*_`]/g, ''), texto, palabras, nivel };
  }

  /* ---------- DOM ---------- */
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  function tostada(msg, opciones = {}) {
    const cont = $('#tostadas');
    const t = el(`<div class="tostada ${opciones.tipo || ''}"><span>${esc(msg)}</span></div>`);
    if (opciones.accion) {
      const b = el(`<button class="btn mini">${esc(opciones.accion)}</button>`);
      b.onclick = () => { t.remove(); opciones.alPulsar && opciones.alPulsar(); };
      t.appendChild(b);
    }
    cont.appendChild(t);
    setTimeout(() => t.classList.add('fuera'), opciones.duracion || 4200);
    setTimeout(() => t.remove(), (opciones.duracion || 4200) + 400);
  }

  /* Modal genérico. botones: [{texto, valor, clase}] → Promise(valor). contenido: html o Node. */
  function modal(titulo, contenido, botones = [{ texto: 'Aceptar', valor: true, clase: 'primario' }], opciones = {}) {
    return new Promise((resolver) => {
      const capa = $('#capa-modal');
      const fondo = el(`<div class="modal-fondo"><div class="modal ${opciones.ancho ? 'ancho' : ''}" role="dialog" aria-modal="true">
        <h2>${esc(titulo)}</h2><div class="modal-cuerpo"></div><div class="modal-botones"></div></div></div>`);
      const cuerpo = $('.modal-cuerpo', fondo);
      if (typeof contenido === 'string') cuerpo.innerHTML = contenido; else if (contenido) cuerpo.appendChild(contenido);
      const cerrar = (v) => { fondo.remove(); document.removeEventListener('keydown', tecla); resolver(v); };
      const tecla = (e) => { if (e.key === 'Escape' && !opciones.obligatorio) cerrar(null); };
      botones.forEach((b) => {
        const btn = el(`<button class="btn ${b.clase || ''}">${esc(b.texto)}</button>`);
        btn.onclick = () => {
          if (b.antes) { const r = b.antes(cuerpo); if (r === false) return; }
          cerrar(typeof b.valor === 'function' ? b.valor(cuerpo) : b.valor);
        };
        $('.modal-botones', fondo).appendChild(btn);
      });
      if (!opciones.obligatorio) fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(null); });
      document.addEventListener('keydown', tecla);
      capa.appendChild(fondo);
      const primero = $('input,select,textarea', cuerpo) || $('.modal-botones .primario', fondo);
      if (primero && !opciones.sinFoco) setTimeout(() => primero.focus(), 30);
    });
  }
  const confirmar = (titulo, texto, si = 'Sí', no = 'Cancelar', peligro = false) =>
    modal(titulo, `<p>${texto}</p>`, [{ texto: no, valor: false }, { texto: si, valor: true, clase: peligro ? 'peligro' : 'primario' }]).then(Boolean);
  const avisar = (titulo, texto) => modal(titulo, `<p>${texto}</p>`);

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* sigue */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }
  function descargar(nombre, contenido, tipo = 'application/json') {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function leerTexto(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(file); });
  }
  function cargarScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[data-src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src; s.dataset.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  return { iso, hoy, aFecha, esFecha, sumarDias, diasEntre, fmtDia, fmtCorto, fmtMin, fmtReloj, esc, uid, sinAcentos, hash, aleatorio, colorTexto, md, bloques, $, $$, el, tostada, modal, confirmar, avisar, copiar, descargar, leerTexto, cargarScript, MESES };
})();
