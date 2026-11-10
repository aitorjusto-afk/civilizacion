/* Test para salir antes del modo estudio.
   - Se desbloquea al llevar un tercio del tiempo estudiado.
   - 5 preguntas sobre los apuntes de la tarea (con Gemini si hay clave; si no, automáticas de completar huecos).
   - Con 4 o más aciertos, la sesión termina y cuenta. Si no, nuevo intento tras 5 min más de estudio. */
'use strict';

const Test = (() => {
  const N = 5, APROBADO = 4, FRACCION_MINIMA = 1 / 3, ESPERA_MS = 5 * 60000;
  let caja = null, ctx = null, estado = 'bloqueado', preguntas = [], origen = '', aviso = '';

  /* ---------- Preguntas automáticas (sin IA): completar el hueco ---------- */
  const VACIAS = new Set(('además ahora antes aquel aquella aquellos bastante cada cierto cierta como contra cuales cualquier cuando desde donde durante entonces entre esta estas este esto estos hacia hasta mientras mismo mucho mucha muchos muchas nuestro nuestra otras otros parte pero poco puede pueden según siempre sobre también tanto tiene tienen todas todos través usted varios hacer cosas forma manera ejemplo ejemplos siguiente siguientes primero primera segundo segunda tercero entre puede deben debe dentro fuera otro otra ellos ellas tambien segun traves')
    .split(/\s+/).map(U.sinAcentos));
  const PALABRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9-]*/g;

  function barajar(lista, rnd = Math.random) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function local(texto, n = N) {
    const limpio = String(texto || '').replace(/^#+\s*/gm, '').replace(/[*_`>|]/g, ' ');
    const frases = (limpio.match(/[^.!?\n]+[.!?]?/g) || []).map((f) => f.replace(/\s+/g, ' ').trim())
      .filter((f) => f.length >= 45 && f.length <= 240 && (f.match(PALABRA) || []).length >= 7);
    // posibles opciones falsas: palabras normales del texto (sin nombres propios ni siglas)
    const todas = [...new Set((limpio.match(PALABRA) || []).filter((w) => w.length >= 5 && /^[a-záéíóúüñ]/.test(w) && !VACIAS.has(U.sinAcentos(w))))];
    const res = [];
    const usadas = new Set();
    for (const f of barajar(frases)) {
      if (res.length >= n) break;
      const enFrase = (f.match(PALABRA) || []).filter((w, i) => i > 0 && w.length >= 6 && !VACIAS.has(U.sinAcentos(w)) && !usadas.has(U.sinAcentos(w)));
      if (!enFrase.length) continue;
      const clave = barajar(enFrase.sort((a, b) => b.length - a.length).slice(0, 3))[0];
      const nc = U.sinAcentos(clave);
      const posibles = todas.filter((w) => U.sinAcentos(w) !== nc && Math.abs(w.length - clave.length) <= 4 && !f.includes(w));
      const distintas = [...new Map(posibles.map((w) => [U.sinAcentos(w), w])).values()];
      if (distintas.length < 3) continue;
      const mayus = clave === clave.toUpperCase();
      const forma = (w) => (mayus ? w : w.toLowerCase());
      const opciones = barajar([forma(clave), ...barajar(distintas).slice(0, 3).map(forma)]);
      usadas.add(nc);
      res.push({
        pregunta: `Completa: «${f.replace(new RegExp(`(^|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ])${clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])`), '$1_____')}»`,
        opciones, correcta: opciones.indexOf(forma(clave)), explicacion: `La frase de tus apuntes es: «${f}»`,
      });
    }
    return res;
  }

  /* ---------- Pantalla ---------- */
  const minimoMs = (s) => s.totalMs * FRACCION_MINIMA;

  function montar(contenedor, opciones) {
    caja = contenedor; ctx = opciones; preguntas = []; aviso = ''; estado = 'bloqueado';
    actualizar(true);
  }

  function textoSuficiente() { return ((ctx.texto() || '').match(/\S+/g) || []).length >= 60; }

  function actualizar(forzar) {
    if (!caja || !ctx) return;
    const s = ctx.sesion();
    if (!s) return;
    if (!textoSuficiente()) {
      if (estado !== 'sintexto') { estado = 'sintexto'; caja.innerHTML = `<div class="test-caja"><h3>🎯 Test para salir antes</h3><p class="pista">Estos apuntes no tienen texto suficiente para hacer preguntas (por ejemplo, un PDF escaneado). Toca estudiar hasta el final del tiempo.</p></div>`; }
      return;
    }
    if (estado === 'bloqueado' || estado === 'listo' || estado === 'espera') {
      const falta = Math.max(minimoMs(s) - s.estudiadoMs, (s.testSiguienteMs || 0) - s.estudiadoMs);
      const nuevo = falta > 0 ? (s.testSiguienteMs ? 'espera' : 'bloqueado') : 'listo';
      if (nuevo !== estado || forzar) { estado = nuevo; pintar(); }
      else if (nuevo !== 'listo') { const r = U.$('.test-reloj', caja); if (r) r.textContent = U.fmtReloj(falta); }
    }
  }

  function pintar() {
    const s = ctx.sesion();
    const falta = Math.max(minimoMs(s) - s.estudiadoMs, (s.testSiguienteMs || 0) - s.estudiadoMs);
    const cab = `<h3>🎯 ¿Ya te lo sabes? Test para salir antes</h3>`;
    if (estado === 'bloqueado') {
      caja.innerHTML = `<div class="test-caja bloqueado">${cab}<p>Cuando lleves un tercio del tiempo estudiando podrás hacer un test de ${N} preguntas sobre estos apuntes. Si aciertas ${APROBADO} o más, terminas ya y la tarea cuenta.</p>
        <p class="pista">Disponible en <strong class="test-reloj">${U.fmtReloj(falta)}</strong> de estudio.</p></div>`;
    } else if (estado === 'espera') {
      caja.innerHTML = `<div class="test-caja bloqueado">${cab}${aviso}<p class="pista">Repasa lo que has fallado. Nuevo intento (con preguntas nuevas) en <strong class="test-reloj">${U.fmtReloj(falta)}</strong> de estudio.</p></div>`;
    } else if (estado === 'listo') {
      caja.innerHTML = `<div class="test-caja">${cab}${aviso}<p>${N} preguntas sobre los apuntes de esta tarea. Con ${APROBADO} aciertos o más, la sesión termina ya y la tarea cuenta. El tiempo sigue corriendo mientras contestas.</p>
        <button class="btn primario" id="test-empezar">Hacer el test</button></div>`;
      U.$('#test-empezar', caja).onclick = empezar;
    } else if (estado === 'cargando') {
      caja.innerHTML = `<div class="test-caja">${cab}<p><span class="girando">⏳</span> Preparando las preguntas…</p></div>`;
    } else if (estado === 'preguntas') {
      caja.innerHTML = `<div class="test-caja">${cab}<p class="pista">${U.esc(origen)}</p>
        <form id="test-form" onsubmit="return false">${preguntas.map((p, i) => `<fieldset class="test-pregunta"><legend>${i + 1}. ${U.esc(p.pregunta)}</legend>
          ${p.opciones.map((o, k) => `<label class="check"><input type="radio" name="p${i}" value="${k}"> <span>${U.esc(o)}</span></label>`).join('')}</fieldset>`).join('')}
        <p class="error" hidden></p><button class="btn primario" id="test-corregir">Corregir</button></form></div>`;
      U.$('#test-corregir', caja).onclick = corregir;
    }
  }

  async function empezar() {
    estado = 'cargando'; pintar();
    const texto = ctx.texto();
    preguntas = []; origen = '';
    const clave = (App.ajustes.claveGemini || '').trim();
    if (clave && navigator.onLine !== false) {
      try {
        preguntas = (await IA.generarPreguntas(texto, N)).map((p) => {
          const orden = barajar(p.opciones.map((_, i) => i));
          return { ...p, opciones: orden.map((i) => p.opciones[i]), correcta: orden.indexOf(p.correcta) };
        });
        origen = 'Preguntas hechas por Gemini a partir de tus apuntes.';
      } catch (e) { console.warn(e); origen = `No se pudo usar Gemini (${e.message}). Son preguntas automáticas de completar huecos.`; }
    } else origen = 'Preguntas automáticas de completar huecos (pon tu clave de Gemini en Ajustes para que sean mejores).';
    if (preguntas.length < N) preguntas = local(texto, N);
    if (preguntas.length < 3) {
      estado = 'sintexto';
      caja.innerHTML = `<div class="test-caja"><h3>🎯 Test para salir antes</h3><p class="pista">No he podido sacar preguntas de estos apuntes. Toca estudiar hasta el final del tiempo.</p></div>`;
      return;
    }
    estado = 'preguntas'; pintar();
  }

  function corregir() {
    const form = U.$('#test-form', caja);
    const resp = preguntas.map((_, i) => { const r = form.querySelector(`input[name=p${i}]:checked`); return r ? Number(r.value) : null; });
    if (resp.some((r) => r === null)) { const e = U.$('.error', form); e.textContent = 'Contesta todas las preguntas.'; e.hidden = false; return; }
    const aciertos = resp.filter((r, i) => r === preguntas[i].correcta).length;
    const necesarias = Math.min(APROBADO, preguntas.length - 1);
    const s = ctx.sesion();
    if (aciertos >= necesarias) { caja.innerHTML = ''; ctx.alAprobar(aciertos, preguntas.length); return; }
    s.testIntentos = (s.testIntentos || 0) + 1;
    s.testSiguienteMs = s.estudiadoMs + (s.prueba ? 2000 : ESPERA_MS);
    aviso = `<div class="test-resultado"><p><strong>${aciertos} de ${preguntas.length}.</strong> Necesitas ${necesarias} para salir antes. Esto es lo que fallaste:</p><ul>${preguntas.map((p, i) => resp[i] === p.correcta ? '' : `<li><strong>${U.esc(p.pregunta)}</strong><br>✅ ${U.esc(p.opciones[p.correcta])}<br><span class="pista">${U.esc(p.explicacion)}</span></li>`).join('')}</ul></div>`;
    estado = 'espera';
    pintar();
    caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function desmontar() { caja = null; ctx = null; }

  return { montar, actualizar, desmontar, local };
})();
