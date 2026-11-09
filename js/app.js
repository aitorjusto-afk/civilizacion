/* Arranque, navegación entre pantallas, inicio y ajustes. */
'use strict';

const AppUI = (() => {
  const PANTALLAS = ['inicio', 'checklist', 'apuntes', 'importar', 'asignaturas', 'ajustes'];
  let actual = 'inicio';

  function ir() {
    let p = (location.hash || '#inicio').slice(1);
    if (!PANTALLAS.includes(p)) p = 'inicio';
    actual = p;
    PANTALLAS.forEach((x) => { U.$(`#p-${x}`).hidden = x !== p; });
    U.$$('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.p === p));
    refrescar();
    window.scrollTo(0, 0);
    if (p === 'checklist') setTimeout(() => Checklist.irAHoy(), 60);
  }

  function refrescar() {
    try {
      if (actual === 'inicio') { Civ.render(); renderInicio(); }
      else if (actual === 'checklist') Checklist.render();
      else if (actual === 'apuntes') Apuntes.render();
      else if (actual === 'importar') Importar.render();
      else if (actual === 'asignaturas') Asignaturas.render();
      else if (actual === 'ajustes') renderAjustes();
    } catch (e) { console.error(e); U.tostada('Error al pintar la pantalla: ' + e.message, { tipo: 'error' }); }
  }

  function comprobarCompleta() {
    const N = Modelo.total();
    if (N > 0 && Modelo.hechas() === N) setTimeout(() => Civ.mostrarCompleta(), 400);
  }

  /* ---------- Inicio ---------- */
  function renderInicio() {
    const hoy = U.hoy();
    const pendientes = Modelo.ordenadas().filter((t) => !t.hecha);
    const sig = pendientes.find((t) => t.fecha >= hoy) || pendientes[0];
    const st = U.$('#siguiente-tarea');
    if (!App.tareas.length) st.innerHTML = '<h3>Siguiente tarea</h3><p class="pista">Cuando generes tu checklist, aquí verás lo próximo que toca.</p>';
    else if (!sig) st.innerHTML = '<h3>Siguiente tarea</h3><p>🎉 No te queda ninguna tarea pendiente.</p>';
    else {
      const hoyN = pendientes.filter((t) => t.fecha === hoy).length;
      const atrasadas = pendientes.filter((t) => t.fecha < hoy).length;
      st.innerHTML = `<h3>Siguiente tarea</h3>
        <div class="sig" style="--c:${Modelo.colorDe(sig.asignatura)}"><span class="sigla" style="background:${Modelo.colorDe(sig.asignatura)};color:${U.colorTexto(Modelo.colorDe(sig.asignatura))}">${U.esc(sig.asignatura)}</span>
        <div><strong>${U.esc(sig.titulo)}</strong><br><small class="pista">${sig.fecha === hoy ? 'Hoy' : U.esc(U.fmtDia(sig.fecha))}${sig.minutos ? ' · ' + U.fmtMin(sig.minutos) : ''}</small></div></div>
        <div class="acciones">${sig.tipo === 'estudio' ? '<button class="btn primario" id="ini-estudiar">▶ Empezar a estudiar</button>' : ''}<a class="btn" href="#checklist">Ver checklist</a></div>
        <p class="pista">${hoyN ? `Hoy tienes ${hoyN} ${hoyN === 1 ? 'tarea pendiente' : 'tareas pendientes'}.` : 'Hoy no tienes tareas pendientes.'}${atrasadas ? ` ⌛ ${atrasadas} de días pasados.` : ''}</p>`;
      const b = U.$('#ini-estudiar'); if (b) b.onclick = () => Estudio.empezar(sig.id);
    }
    const ex = App.asignaturas.filter((a) => a.examen && a.examen >= hoy).sort((a, b) => a.examen.localeCompare(b.examen));
    const ses = App.sesiones.filter((s) => !s.prueba);
    U.$('#examenes-proximos').innerHTML = `<h3>Próximos exámenes</h3>${ex.length ? `<ul class="cuenta-atras">${ex.map((a) => {
      const d = U.diasEntre(hoy, a.examen);
      return `<li style="--c:${a.color}"><span class="sigla" style="background:${a.color};color:${U.colorTexto(a.color)}">${U.esc(a.id)}</span><span>${U.esc(U.fmtCorto(a.examen))}${a.hora ? ' · ' + U.esc(a.hora) : ''}</span><strong>${d === 0 ? '¡HOY!' : d === 1 ? 'mañana' : `en ${d} días`}</strong></li>`;
    }).join('')}</ul>` : '<p class="pista">No hay exámenes próximos con fecha. Puedes ponerlas en Asignaturas.</p>'}
      <p class="pista">Sesiones: ${ses.filter((s) => s.estado === 'completada').length} completadas · ${ses.filter((s) => s.estado === 'abandonada').length} abandonadas</p>`;
  }

  /* ---------- Ajustes ---------- */
  function renderAjustes() {
    const a = App.ajustes;
    const cont = U.$('#ajustes-contenido');
    cont.innerHTML = `<div class="barra-herr"><h1>Ajustes</h1></div>
      <section class="tarjeta">
        <h2>Inteligencia artificial</h2>
        <fieldset class="radios"><legend>Cómo generar la checklist</legend>
          <label class="check"><input type="radio" name="modo" value="gemini" ${a.modoIA !== 'claude' ? 'checked' : ''}> <span><strong>A) API gratuita de Google Gemini</strong> (por defecto): la web llama directamente a Gemini con tu clave.</span></label>
          <label class="check"><input type="radio" name="modo" value="claude" ${a.modoIA === 'claude' ? 'checked' : ''}> <span><strong>B) Sin clave, con tu chat de Claude</strong>: copias unas instrucciones, las pegas en claude.ai y pegas la respuesta.</span></label>
        </fieldset>
        <label>Clave de Google AI Studio
          <span class="fila-input"><input type="password" id="aj-clave" value="${U.esc(a.claveGemini)}" placeholder="AIza…" autocomplete="off" spellcheck="false"><button class="btn mini" id="aj-ver" type="button">Mostrar</button></span></label>
        <p class="pista">Se guarda <strong>solo en este navegador</strong> y únicamente se envía a Google al generar. ¿No tienes? Consíguela gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>: entra con tu cuenta de Google → «Create API key» (o «Crear clave de API») → cópiala y pégala aquí. No hace falta tarjeta.</p>
        <label>Modelo
          <span class="fila-input"><input id="aj-modelo" list="modelos" value="${U.esc(a.modelo)}" spellcheck="false"><button class="btn mini" id="aj-modelos" type="button">Ver modelos disponibles</button></span>
          <datalist id="modelos"><option value="gemini-2.5-flash"><option value="gemini-2.5-flash-lite"><option value="gemini-flash-latest"></datalist></label>
        <p class="pista" id="aj-modelos-info">Usa un modelo «flash» de la capa gratuita. Si Google cambia los nombres, pulsa «Ver modelos disponibles».</p>
        <div class="acciones"><button class="btn primario" id="aj-guardar-ia">Guardar</button></div>
      </section>

      <section class="tarjeta">
        <h2>Copia de seguridad</h2>
        <p class="pista">Un archivo .json con asignaturas, tareas, progreso, apuntes y calendario. Sirve para pasar todo del PC al móvil (o al revés).</p>
        <label class="check"><input type="checkbox" id="aj-incluir-clave"> Incluir la clave de la IA en la copia</label>
        <div class="acciones">
          <button class="btn primario" id="aj-exportar">⬇ Exportar copia de seguridad</button>
          <label class="btn">⬆ Importar copia de seguridad<input type="file" id="aj-importar" accept=".json,application/json" hidden></label>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Modo prueba</h2>
        <p class="pista">Abre la web con <code>?prueba</code> al final de la dirección: el temporizador dura 10 segundos. En Importar tienes un calendario y unos apuntes de ejemplo.</p>
        <div class="acciones">${App.prueba ? '<a class="btn" href="./#ajustes">Salir del modo prueba</a>' : '<a class="btn" href="./?prueba#importar">Abrir en modo prueba</a>'}</div>
      </section>

      <section class="tarjeta peligro-zona">
        <h2>Reiniciar</h2>
        <p class="pista">Borra todo lo guardado en este navegador (tareas, progreso, apuntes, calendario y ajustes) y vuelve a las asignaturas iniciales. Haz antes una copia de seguridad.</p>
        <div class="acciones"><button class="btn peligro" id="aj-reiniciar">Reiniciar todo</button></div>
      </section>
      <p class="pista centrado">Civilización de estudio · todo se guarda en tu navegador · ${navigator.onLine ? 'en línea' : 'sin conexión'}</p>`;

    U.$('#aj-ver').onclick = () => { const i = U.$('#aj-clave'); i.type = i.type === 'password' ? 'text' : 'password'; U.$('#aj-ver').textContent = i.type === 'password' ? 'Mostrar' : 'Ocultar'; };
    const guardarIA = () => {
      App.ajustes.modoIA = (U.$('input[name=modo]:checked') || {}).value || 'gemini';
      App.ajustes.claveGemini = U.$('#aj-clave').value.trim();
      App.ajustes.modelo = U.$('#aj-modelo').value.trim().replace(/^models\//, '') || 'gemini-2.5-flash';
      Modelo.guardarAjustes();
    };
    U.$('#aj-guardar-ia').onclick = () => { guardarIA(); U.tostada('Ajustes guardados'); };
    U.$$('input[name=modo]').forEach((r) => (r.onchange = () => { guardarIA(); U.tostada('Método guardado'); }));
    U.$('#aj-modelos').onclick = async () => {
      guardarIA();
      const info = U.$('#aj-modelos-info');
      info.textContent = 'Consultando…';
      try {
        const lista = await IA.listarModelos();
        U.$('#modelos').innerHTML = lista.map((m) => `<option value="${U.esc(m)}">`).join('');
        const flash = lista.filter((m) => /flash/.test(m));
        info.innerHTML = `Tu clave funciona ✅. Modelos «flash»: ${flash.map((m) => `<code>${U.esc(m)}</code>`).join(', ') || 'ninguno'}. Toca el campo para elegir.`;
      } catch (e) { info.textContent = 'No se pudo consultar: ' + e.message; }
    };
    U.$('#aj-exportar').onclick = async () => {
      const datos = await Almacen.exportar(U.$('#aj-incluir-clave').checked);
      U.descargar(`civilizacion-copia-${U.hoy()}.json`, JSON.stringify(datos, null, 1));
      U.tostada('Copia descargada');
    };
    U.$('#aj-importar').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const datos = JSON.parse(await U.leerTexto(f));
        const n = ((datos.localStorage || {}).tareas || []).length;
        if (!(await U.confirmar('Importar copia', `La copia tiene ${n} tareas. Se <strong>sustituirá</strong> todo lo que hay ahora en este navegador. ¿Seguir?`, 'Importar', 'Cancelar', true))) return;
        await Almacen.importar(datos);
        await Modelo.cargar();
        U.tostada('Copia importada');
        location.hash = '#inicio'; refrescar();
      } catch (err) { U.avisar('No se pudo importar', U.esc(err.message)); }
    };
    U.$('#aj-reiniciar').onclick = async () => {
      const form = U.el('<div><p>Escribe <strong>BORRAR</strong> para confirmar.</p><input id="conf-borrar" autocomplete="off"></div>');
      const r = await U.modal('Reiniciar todo', form, [{ texto: 'Cancelar', valor: false }, { texto: 'Reiniciar', clase: 'peligro', valor: () => U.$('#conf-borrar', form).value.trim().toUpperCase() === 'BORRAR' }]);
      if (!r) return;
      await Almacen.reiniciar();
      await Modelo.cargar();
      U.tostada('Todo reiniciado');
      location.hash = '#inicio'; refrescar();
    };
  }

  async function arrancar() {
    if (App.prueba) U.$('#banda-prueba').hidden = false;
    await Modelo.cargar();
    Asignaturas.init(); Checklist.init(); Apuntes.init(); Civ.init(); Estudio.init();
    window.addEventListener('hashchange', ir);
    ir();
    Estudio.comprobarPendiente();
    // Al cambiar de día con la web abierta, refresca «hoy».
    let dia = U.hoy();
    setInterval(() => { if (U.hoy() !== dia) { dia = U.hoy(); if (!Estudio.activa()) refrescar(); } }, 60000);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
    }
  }

  return { arrancar, refrescar, comprobarCompleta, ir };
})();

AppUI.arrancar();
