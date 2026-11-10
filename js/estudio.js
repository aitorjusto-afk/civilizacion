/* Modo estudio: pantalla completa + Wake Lock, cuenta atrás que solo avanza mientras estás dentro,
   descansos de 10 min cada 50, distracciones, salida de emergencia y recuperación tras cerrar. */
'use strict';

const Estudio = (() => {
  const BLOQUE_MIN = 50, DESCANSO_MIN = 10, MAX_DISTR = 3, EMERGENCIA_MS = 10000;
  let ses = null;         // sesión activa (se guarda en localStorage como 'sesionActiva')
  let intervalo = null, wakeLock = null, ignorarHasta = 0, ultimoGuardado = 0;

  const fsSoportado = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const enFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function pedirFs() {
    const d = document.documentElement;
    try {
      const r = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* no disponible */ }
  }
  function salirFs() {
    try { if (enFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* nada */ }
  }
  async function pedirWakeLock() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
    catch (e) { wakeLock = null; }
  }
  function soltarWakeLock() { try { wakeLock && wakeLock.release(); } catch (e) { /* nada */ } wakeLock = null; }

  /* Duraciones (en modo prueba, la sesión dura 10 segundos y los descansos se escalan). */
  function duraciones(minutos) {
    const totalReal = minutos * 60000;
    if (!App.prueba) return { totalMs: totalReal, bloqueMs: BLOQUE_MIN * 60000, descansoMs: DESCANSO_MIN * 60000 };
    const f = 10000 / totalReal;
    return { totalMs: 10000, bloqueMs: BLOQUE_MIN * 60000 * f, descansoMs: Math.max(3000, DESCANSO_MIN * 60000 * f) };
  }

  function guardar(forzar) {
    const ahora = Date.now();
    if (!forzar && ahora - ultimoGuardado < 1000) return;
    ultimoGuardado = ahora;
    Almacen.guardar('sesionActiva', ses);
  }

  /* ---------- Empezar (siempre desde un clic, para poder pedir pantalla completa) ---------- */
  function empezar(tareaId, { reparar = false } = {}) {
    const t = App.tareas.find((x) => x.id === tareaId);
    if (!t) return;
    if (ses) return U.avisar('Ya hay una sesión', 'Termina primero la sesión de estudio que tienes abierta.');
    const minutos = t.minutos > 0 ? t.minutos : 30;
    const d = duraciones(minutos);
    ses = {
      tareaId, asignatura: t.asignatura, titulo: t.titulo, minutos, reparar: reparar || t.hecha,
      inicio: Date.now(), ...d, estudiadoMs: 0, descansosHechos: 0, fase: 'estudio', descansoRestanteMs: 0,
      pausado: false, distracciones: 0, prueba: App.prueba,
    };
    pedirFs();
    abrir();
    guardar(true);
  }

  /* Reanudar una sesión que quedó a medias (al volver a abrir la web). */
  async function comprobarPendiente() {
    const guardada = Almacen.leer('sesionActiva', null);
    if (!guardada || !guardada.tareaId) return;
    const t = App.tareas.find((x) => x.id === guardada.tareaId);
    if (!t) { Almacen.borrar('sesionActiva'); return; }
    const queda = Math.max(0, guardada.totalMs - guardada.estudiadoMs);
    const r = await U.modal('Tienes una sesión a medias', `<p><strong>${U.esc(t.asignatura)} · ${U.esc(t.titulo)}</strong></p>
      <p>Quedaban <strong>${U.fmtReloj(queda)}</strong> de estudio${guardada.distracciones ? ` y llevabas ${guardada.distracciones} ${guardada.distracciones === 1 ? 'distracción' : 'distracciones'}` : ''}.</p>
      <p class="pista">Si la abandonas, la tarea no contará.</p>`,
    [{ texto: 'Abandonar', valor: 'abandonar', clase: 'peligro-txt' }, { texto: 'Seguir estudiando', valor: 'seguir', clase: 'primario' }], { obligatorio: true });
    if (r === 'seguir') {
      ses = { ...guardada, pausado: false };
      if (ses.fase === 'pausa') ses.fase = 'estudio';
      pedirFs(); // el clic del botón cuenta como gesto del usuario
      abrir();
    } else {
      registrar(guardada, 'abandonada');
      Almacen.borrar('sesionActiva');
      U.tostada('Sesión abandonada: la tarea no cuenta.');
    }
  }

  /* ---------- Pantalla ---------- */
  function abrir() {
    const cont = U.$('#estudio');
    cont.hidden = false;
    document.body.classList.add('estudiando');
    const a = Modelo.asig(ses.asignatura);
    const color = a ? a.color : '#888';
    cont.style.setProperty('--c', color);
    U.$('#es-asig').innerHTML = `<span class="sigla" style="background:${color};color:${U.colorTexto(color)}">${U.esc(ses.asignatura)}</span> ${U.esc(a ? a.nombre : '')}${ses.prueba ? ' <span class="insignia-prueba">PRUEBA</span>' : ''}`;
    U.$('#es-titulo').textContent = ses.titulo;
    pintarApuntes();
    U.$('#es-aviso').hidden = true;
    ignorarHasta = Date.now() + 1500;
    ses.ultimoTick = Date.now();
    pedirWakeLock();
    escuchar(true);
    clearInterval(intervalo);
    intervalo = setInterval(tick, 250);
    tick();
  }

  function pintarApuntes() {
    const t = App.tareas.find((x) => x.id === ses.tareaId);
    const bl = Modelo.bloquesDe(ses.asignatura);
    const elegidos = t && t.bloques.length ? bl.filter((b) => t.bloques.includes(b.n)) : bl;
    const cont = U.$('#es-apuntes');
    if (!bl.length) {
      cont.innerHTML = `<div class="vacio"><h3>Sin apuntes de ${U.esc(ses.asignatura)}</h3><p>Añádelos en Apuntes o Importar para leerlos aquí la próxima vez. Mientras, usa tus apuntes en papel 📓.</p></div>`;
      return;
    }
    const resto = bl.length - elegidos.length;
    const titulos = elegidos.length < bl.length ? elegidos.map((b) => b.titulo).join(' · ') : 'Todos los apuntes';
    cont.innerHTML = `<div class="es-ap-cab"><strong title="${U.esc(titulos)}">${U.esc(titulos.length > 90 ? titulos.slice(0, 90) + '…' : titulos)}</strong>
      <input type="search" id="es-buscar" placeholder="Buscar…">${resto > 0 ? `<button class="btn mini" id="es-todos">Ver todos los apuntes</button>` : ''}</div>
      <div id="es-resultados"></div>
      <div class="lectura" id="es-lectura"></div>`;
    Apuntes.pintarBloques(U.$('#es-lectura'), elegidos, ses.asignatura);
    const bt = U.$('#es-todos');
    const verTodo = () => { if (!U.$('#es-todos')) return; Apuntes.pintarBloques(U.$('#es-lectura'), bl, ses.asignatura); U.$('#es-todos').remove(); };
    if (bt) bt.onclick = verTodo;
    let espera;
    U.$('#es-buscar').addEventListener('input', (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const m = Apuntes.resaltar(U.$('#es-lectura'), e.target.value);
        Apuntes.pintarResultadosPdf(U.$('#es-resultados'), U.$('#es-lectura'), App.pdfs[ses.asignatura] || [], e.target.value, verTodo);
        if (m[0]) m[0].scrollIntoView({ block: 'center' });
      }, 220);
    });
  }

  function tick() {
    if (!ses) return;
    const ahora = Date.now();
    const dt = Math.min(2000, Math.max(0, ahora - (ses.ultimoTick || ahora)));
    ses.ultimoTick = ahora;
    if (ses.fase === 'estudio' && !ses.pausado) {
      ses.estudiadoMs += dt;
      const siguienteDescanso = (ses.descansosHechos + 1) * ses.bloqueMs;
      if (ses.estudiadoMs >= ses.totalMs) { ses.estudiadoMs = ses.totalMs; pintar(); return terminar(); }
      if (ses.estudiadoMs >= siguienteDescanso && siguienteDescanso < ses.totalMs) {
        ses.estudiadoMs = siguienteDescanso;
        ses.fase = 'descanso'; ses.descansoRestanteMs = ses.descansoMs;
        aviso('☕ ¡Descanso de 10 minutos! Estírate, bebe agua. Sigue dentro de la web.');
        guardar(true);
      }
    } else if (ses.fase === 'descanso') {
      ses.descansoRestanteMs -= ahora - (ses._ultDesc || ahora);
      if (ses.descansoRestanteMs <= 0) {
        ses.descansoRestanteMs = 0; ses.descansosHechos++;
        ses.fase = 'listo'; // espera a que pulses «Volver a estudiar»
        aviso('⏰ Se acabó el descanso.');
        guardar(true);
      }
    }
    ses._ultDesc = ahora;
    pintar();
    guardar(false);
  }

  function pintar() {
    const queda = ses.totalMs - ses.estudiadoMs;
    const anillo = U.$('#es-anillo');
    const L = 2 * Math.PI * 52;
    let frac, texto, fase;
    if (ses.fase === 'descanso') {
      frac = 1 - ses.descansoRestanteMs / ses.descansoMs; texto = U.fmtReloj(ses.descansoRestanteMs); fase = '☕ Descanso';
    } else {
      frac = ses.estudiadoMs / ses.totalMs; texto = U.fmtReloj(queda);
      fase = ses.fase === 'listo' ? 'Descanso terminado' : ses.pausado ? '⏸ En pausa' : 'Estudiando';
    }
    anillo.style.strokeDasharray = `${L}`;
    anillo.style.strokeDashoffset = `${L * (1 - Math.min(1, Math.max(0, frac)))}`;
    U.$('#estudio').classList.toggle('en-descanso', ses.fase === 'descanso');
    U.$('#es-tiempo').textContent = texto;
    U.$('#es-fase').textContent = fase;
    const nDesc = Math.ceil(ses.totalMs / ses.bloqueMs) - 1;
    const info = [];
    info.push(`Total: ${U.fmtMin(ses.minutos)}${ses.prueba ? ' (10 s en prueba)' : ''}`);
    if (nDesc > 0) info.push(`Descansos: ${ses.descansosHechos}/${nDesc}`);
    if (ses.fase === 'estudio' && nDesc > ses.descansosHechos) info.push(`Próximo descanso en ${U.fmtReloj((ses.descansosHechos + 1) * ses.bloqueMs - ses.estudiadoMs)}`);
    if (!fsSoportado()) info.push('Este navegador no tiene pantalla completa (en iPhone, instala la web como app).');
    U.$('#es-info').innerHTML = info.map((x) => `<span>${U.esc(x)}</span>`).join('');
    U.$('#es-distr').innerHTML = Array.from({ length: MAX_DISTR }, (_, i) => `<span class="punto ${i < ses.distracciones ? 'gastado' : ''}"></span>`).join('')
      + `<small>${ses.distracciones >= MAX_DISTR ? 'Pieza dañada 🏚️' : `${ses.distracciones}/${MAX_DISTR} distracciones`}</small>`;
    U.$('#es-seguir').hidden = ses.fase !== 'listo';
    document.title = `${texto} · ${ses.fase === 'descanso' ? 'Descanso' : 'Estudiando'}`;
  }

  function aviso(texto) {
    U.$('#es-aviso-texto').textContent = texto;
    const descanso = ses.fase === 'descanso';
    U.$('#es-aviso').hidden = descanso; // en el descanso se ve el reloj del descanso
    if (descanso) U.tostada(texto, { duracion: 6000 });
    U.$('#es-volver').hidden = false;
  }

  /* ---------- Distracciones ---------- */
  function distraccion(motivo) {
    if (!ses || ses.fase !== 'estudio' || ses.pausado || Date.now() < ignorarHasta) return;
    tick(); // contabiliza lo estudiado hasta ahora
    if (!ses || ses.fase !== 'estudio') return;
    ses.pausado = true;
    ses.distracciones++;
    guardar(true);
    const n = ses.distracciones;
    U.$('.aviso-icono').textContent = n >= MAX_DISTR ? '🏚️' : '⏸️';
    U.$('#es-aviso-texto').innerHTML = `Has salido (${U.esc(motivo)}). El tiempo está en pausa y solo cuenta mientras estás dentro.<br>
      <strong>Distracción ${n} de ${MAX_DISTR}.</strong> ${n >= MAX_DISTR ? 'La pieza de esta tarea saldrá dañada hasta que repitas una sesión limpia de ' + U.esc(ses.asignatura) + '.' : `A la ${MAX_DISTR}.ª, la pieza saldrá dañada.`}`;
    U.$('#es-aviso').hidden = false;
    pintar();
  }
  function volver() {
    if (!ses) return;
    if (fsSoportado() && !enFs()) pedirFs();
    pedirWakeLock();
    ignorarHasta = Date.now() + 1500;
    if (ses.fase === 'listo') ses.fase = 'estudio';
    ses.pausado = false;
    ses.ultimoTick = Date.now();
    U.$('#es-aviso').hidden = true;
    guardar(true);
    pintar();
  }

  const alVisibilidad = () => { if (document.visibilityState === 'hidden') distraccion('cambiaste de pestaña o de app'); else if (ses) pedirWakeLock(); };
  const alBlur = () => setTimeout(() => { if (!document.hasFocus()) distraccion('cambiaste de ventana'); }, 200);
  const alFs = () => { if (fsSoportado() && !enFs()) distraccion('quitaste la pantalla completa'); };
  const alSalir = (e) => { if (ses) { guardar(true); e.preventDefault(); e.returnValue = ''; return ''; } };
  const alPagehide = () => { if (ses) guardar(true); };

  function escuchar(si) {
    const f = si ? 'addEventListener' : 'removeEventListener';
    document[f]('visibilitychange', alVisibilidad);
    window[f]('blur', alBlur);
    document[f]('fullscreenchange', alFs);
    document[f]('webkitfullscreenchange', alFs);
    window[f]('beforeunload', alSalir);
    window[f]('pagehide', alPagehide);
  }

  /* ---------- Fin ---------- */
  function cerrar() {
    clearInterval(intervalo); intervalo = null;
    escuchar(false);
    soltarWakeLock();
    salirFs();
    U.$('#estudio').hidden = true;
    document.body.classList.remove('estudiando');
    document.title = 'Civilización de estudio';
    Almacen.borrar('sesionActiva');
  }

  function registrar(s, estado) {
    Modelo.registrarSesion({
      tareaId: s.tareaId, asignatura: s.asignatura, titulo: s.titulo, estado,
      inicio: s.inicio, fin: Date.now(), minutos: Math.round((s.estudiadoMs / s.totalMs) * s.minutos), distracciones: s.distracciones, prueba: !!s.prueba,
    });
  }

  async function terminar() {
    const s = ses;
    ses = null;
    cerrar();
    const limpia = s.distracciones < MAX_DISTR;
    registrar(s, 'completada');
    const t = App.tareas.find((x) => x.id === s.tareaId);
    const yaHecha = t && t.hecha;
    let reparadas = 0;
    if (yaHecha) {
      if (limpia) reparadas = Modelo.reparar(s.asignatura);
    } else {
      Modelo.completar(s.tareaId, { danada: !limpia });
      if (limpia) reparadas = Modelo.reparar(s.asignatura);
    }
    const msg = limpia
      ? `<p>✅ Sesión limpia${s.distracciones ? ` (${s.distracciones} ${s.distracciones === 1 ? 'distracción' : 'distracciones'})` : ' sin distracciones'}.</p>${yaHecha ? '' : '<p>🏗️ Se ha construido una nueva pieza de tu civilización.</p>'}${reparadas ? `<p>🔧 Has reparado ${reparadas} ${reparadas === 1 ? 'pieza dañada' : 'piezas dañadas'} de ${U.esc(s.asignatura)}.</p>` : ''}`
      : `<p>Con ${s.distracciones} distracciones ${yaHecha ? 'la pieza sigue dañada' : 'la pieza sale <strong>dañada</strong>'} 🏚️.</p><p>Repite una sesión limpia de ${U.esc(s.asignatura)} para repararla.</p>`;
    await U.modal('¡Tiempo cumplido!', msg, [{ texto: 'Ver mi civilización', valor: true, clase: 'primario' }], { obligatorio: true });
    location.hash = '#inicio';
    AppUI.refrescar();
    AppUI.comprobarCompleta();
  }

  function abandonar() {
    if (!ses) return;
    const s = ses;
    ses = null;
    registrar(s, 'abandonada');
    cerrar();
    U.avisar('Sesión abandonada', 'Has usado la salida de emergencia. La tarea <strong>no cuenta</strong> y la sesión queda registrada como abandonada.');
    AppUI.refrescar();
  }

  /* ---------- Salida de emergencia: mantener pulsado 10 s ---------- */
  function initEmergencia() {
    const b = U.$('#es-emergencia');
    const prog = U.$('#es-em-prog');
    const L = 2 * Math.PI * 15;
    prog.style.strokeDasharray = `${L}`; prog.style.strokeDashoffset = `${L}`;
    let inicio = 0, reloj = 0;
    const parar = () => {
      clearInterval(reloj); inicio = 0;
      prog.style.strokeDashoffset = `${L}`; b.classList.remove('pulsando');
      U.$('#es-em-texto').textContent = 'Salida de emergencia (mantén 10 s)';
    };
    const paso = () => {
      const t = Date.now() - inicio;
      prog.style.strokeDashoffset = `${L * (1 - Math.min(1, t / EMERGENCIA_MS))}`;
      U.$('#es-em-texto').textContent = `Sigue pulsando… ${Math.ceil((EMERGENCIA_MS - t) / 1000)} s (la tarea no contará)`;
      if (t >= EMERGENCIA_MS) { parar(); abandonar(); }
    };
    const empezarPulsar = () => { if (inicio) return; inicio = Date.now(); b.classList.add('pulsando'); clearInterval(reloj); reloj = setInterval(paso, 100); paso(); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } empezarPulsar(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, parar));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) empezarPulsar(); });
    b.addEventListener('keyup', parar);
  }

  function init() {
    initEmergencia();
    U.$('#es-volver').onclick = volver;
    U.$('#es-seguir').onclick = volver;
  }

  const activa = () => !!ses;

  return { init, empezar, comprobarPendiente, activa };
})();
