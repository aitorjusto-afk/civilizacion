/* Pantalla de checklist / calendario: tareas agrupadas por día. */
'use strict';

const Checklist = (() => {
  const filtro = { asignaturas: new Set(), ocultarHechas: false };
  const ICONO = { estudio: '📚', entrega: '📤', examen: '📝' };

  function render() {
    renderFiltros();
    const cont = U.$('#lista-dias');
    if (!App.tareas.length) {
      cont.innerHTML = `<div class="tarjeta vacio"><p>Todavía no hay tareas.</p>
        <p><a class="btn primario" href="#importar">Generar la checklist</a> o <button class="btn" id="vacio-anadir">añadir una a mano</button></p></div>`;
      U.$('#vacio-anadir').onclick = () => editarTarea(null);
      return;
    }
    const hoy = U.hoy();
    let lista = Modelo.ordenadas();
    if (filtro.asignaturas.size) lista = lista.filter((t) => filtro.asignaturas.has(t.asignatura));
    if (filtro.ocultarHechas) lista = lista.filter((t) => !t.hecha);

    const porDia = new Map();
    lista.forEach((t) => { if (!porDia.has(t.fecha)) porDia.set(t.fecha, []); porDia.get(t.fecha).push(t); });
    // exámenes de asignaturas que no aparecen como tarea ese día
    App.asignaturas.forEach((a) => {
      if (!a.examen || (filtro.asignaturas.size && !filtro.asignaturas.has(a.id))) return;
      const yaEsta = App.tareas.some((t) => t.tipo === 'examen' && t.asignatura === a.id && t.fecha === a.examen);
      if (!yaEsta) { if (!porDia.has(a.examen)) porDia.set(a.examen, []); }
    });
    if (!porDia.has(hoy)) porDia.set(hoy, []);
    const dias = [...porDia.keys()].sort();

    cont.innerHTML = dias.map((d) => {
      const tareas = porDia.get(d);
      const examenesAsig = App.asignaturas.filter((a) => a.examen === d && !App.tareas.some((t) => t.tipo === 'examen' && t.asignatura === a.id && t.fecha === d));
      const min = tareas.reduce((s, t) => s + (t.tipo === 'estudio' ? t.minutos : 0), 0);
      const hechasDia = tareas.filter((t) => t.hecha).length;
      const clase = d === hoy ? 'hoy' : d < hoy ? 'pasado' : '';
      const conExamen = tareas.some((t) => t.tipo === 'examen') || examenesAsig.length;
      return `<section class="dia ${clase} ${conExamen ? 'con-examen' : ''}" data-dia="${d}" id="dia-${d}">
        <header class="dia-cab">
          <h2>${d === hoy ? '<span class="insignia-hoy">HOY</span>' : ''}${U.esc(U.fmtDia(d).replace(/^./, (c) => c.toUpperCase()))}</h2>
          <span class="pista">${tareas.length ? `${hechasDia}/${tareas.length} hechas${min ? ' · ' + U.fmtMin(min) : ''}` : 'Sin tareas'}</span>
        </header>
        ${examenesAsig.map((a) => `<div class="aviso-examen" style="--c:${a.color}">📝 Examen de ${U.esc(a.nombre)}${a.hora ? ' a las ' + U.esc(a.hora) : ''} <span class="pista">(fecha de la asignatura)</span></div>`).join('')}
        <ul class="tareas">${tareas.map(itemTarea).join('')}</ul>
      </section>`;
    }).join('');

    U.$$('.tarea', cont).forEach((li) => {
      const id = li.dataset.id;
      U.$('input[type=checkbox]', li).onchange = (e) => alternar(id, e.target);
      const be = U.$('[data-estudiar]', li); if (be) be.onclick = () => Estudio.empezar(id);
      const br = U.$('[data-reparar]', li); if (br) br.onclick = () => Estudio.empezar(id, { reparar: true });
      U.$('[data-editar]', li).onclick = () => editarTarea(id);
    });
  }

  function itemTarea(t) {
    const a = Modelo.asig(t.asignatura);
    const color = a ? a.color : '#9a9a9a';
    const pieza = Modelo.piezaDe(t.id);
    const pasada = Modelo.pasada(t);
    const etiquetas = [];
    if (t.tipo === 'estudio' && t.minutos) etiquetas.push(`⏱ ${U.fmtMin(t.minutos)}`);
    if (t.tipo !== 'estudio') etiquetas.push(t.tipo === 'examen' ? 'Examen' : 'Entrega');
    if (t.bloques.length) etiquetas.push(`bloques ${t.bloques.join(', ')}`);
    if (t.sugerida) etiquetas.push('✨ sugerida');
    if (pasada) etiquetas.push('⌛ pasada');
    if (pieza && pieza.danada) etiquetas.push('🏚️ pieza dañada');
    let boton = '';
    if (t.tipo === 'estudio' && !t.hecha) boton = `<button class="btn mini primario" data-estudiar>▶ Empezar a estudiar</button>`;
    if (pieza && pieza.danada) boton = `<button class="btn mini" data-reparar title="Repite una sesión limpia para reparar la pieza">🔧 Repetir sesión</button>`;
    return `<li class="tarea tipo-${t.tipo} ${t.hecha ? 'hecha' : ''} ${pasada ? 'pasada' : ''}" data-id="${t.id}" style="--c:${color}">
      <label class="casilla" title="${t.hecha ? 'Desmarcar' : 'Marcar como hecha'}"><input type="checkbox" ${t.hecha ? 'checked' : ''} aria-label="Hecha"><span></span></label>
      <div class="tarea-info">
        <div class="tarea-linea"><span class="sigla" style="background:${color};color:${U.colorTexto(color)}">${U.esc(t.asignatura || '¿?')}</span>
        <span class="tarea-titulo">${ICONO[t.tipo]} ${U.esc(t.titulo)}</span></div>
        <div class="tarea-meta">${etiquetas.map((e) => `<span>${U.esc(e)}</span>`).join('')}</div>
      </div>
      <div class="tarea-acc">${boton}<button class="btn mini icono" data-editar title="Editar">✎</button></div>
    </li>`;
  }

  async function alternar(id, casilla) {
    const t = App.tareas.find((x) => x.id === id);
    if (!t) return;
    if (t.hecha) {
      Modelo.descompletar(id);
      U.tostada('Tarea desmarcada: su pieza ha desaparecido.', { accion: 'Deshacer', alPulsar: () => { Modelo.completar(id); AppUI.refrescar(); } });
    } else {
      if (t.tipo === 'estudio') {
        const ok = await U.confirmar('¿Marcar sin modo estudio?', 'Esta es una tarea de estudio. Lo normal es completarla con «Empezar a estudiar». ¿La marcas como hecha igualmente (por ejemplo, si ya la hiciste)?', 'Marcar como hecha');
        if (!ok) { casilla.checked = false; return; }
      }
      Modelo.completar(id);
      U.tostada('🏗️ ¡Pieza construida!', { accion: 'Ver', alPulsar: () => (location.hash = '#inicio') });
      AppUI.comprobarCompleta();
    }
    AppUI.refrescar();
  }

  function renderFiltros() {
    const cont = U.$('#filtros');
    cont.innerHTML = App.asignaturas.map((a) => `<button class="chip ${filtro.asignaturas.has(a.id) ? 'activo' : ''}" data-f="${U.esc(a.id)}" style="--c:${a.color}">${U.esc(a.id)}</button>`).join('')
      + `<label class="chip-check"><input type="checkbox" id="f-hechas" ${filtro.ocultarHechas ? 'checked' : ''}> Ocultar hechas</label>`;
    U.$$('[data-f]', cont).forEach((b) => (b.onclick = () => {
      const id = b.dataset.f;
      filtro.asignaturas.has(id) ? filtro.asignaturas.delete(id) : filtro.asignaturas.add(id);
      render();
    }));
    U.$('#f-hechas').onchange = (e) => { filtro.ocultarHechas = e.target.checked; render(); };
  }

  function irAHoy() {
    const d = U.$(`#dia-${U.hoy()}`) || U.$$('.dia').find((x) => x.dataset.dia >= U.hoy());
    if (d) { d.scrollIntoView({ behavior: 'smooth', block: 'start' }); d.classList.add('destello'); setTimeout(() => d.classList.remove('destello'), 1500); }
  }

  /* Formulario para añadir/editar una tarea a mano. */
  async function editarTarea(id) {
    const t = id ? App.tareas.find((x) => x.id === id) : { fecha: U.hoy(), asignatura: (App.asignaturas[0] || {}).id || '', titulo: '', minutos: 60, tipo: 'estudio', bloques: [] };
    const opcionesAsig = App.asignaturas.map((a) => `<option value="${U.esc(a.id)}" ${a.id === t.asignatura ? 'selected' : ''}>${U.esc(a.id)} · ${U.esc(a.nombre)}</option>`).join('')
      + (t.asignatura && !Modelo.asig(t.asignatura) ? `<option selected value="${U.esc(t.asignatura)}">${U.esc(t.asignatura)} (sin asignatura)</option>` : '');
    const form = U.el(`<form class="form" onsubmit="return false">
      <div class="fila2">
        <label>Día<input type="date" name="fecha" required value="${U.esc(t.fecha)}"></label>
        <label>Asignatura<select name="asignatura">${opcionesAsig}</select></label>
      </div>
      <label>Qué hacer<input name="titulo" required value="${U.esc(t.titulo)}" placeholder="p. ej. Bloque 2: Von Neumann"></label>
      <div class="fila2">
        <label>Tipo<select name="tipo">${Modelo.TIPOS.map((x) => `<option ${x === t.tipo ? 'selected' : ''} value="${x}">${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></label>
        <label class="campo-min">Minutos<input type="number" name="minutos" min="1" max="720" step="5" value="${t.minutos || 60}"></label>
      </div>
      <fieldset class="campo-bloques"><legend>Bloques de apuntes para el modo estudio</legend><div class="lista-bloques"></div></fieldset>
      <p class="error" hidden></p>
    </form>`);
    const pintarBloques = () => {
      const sigla = form.asignatura.value;
      const bl = Modelo.bloquesDe(sigla);
      const sel = new Set(sigla === t.asignatura ? t.bloques : []);
      U.$('.lista-bloques', form).innerHTML = bl.length
        ? bl.map((b) => `<label class="check"><input type="checkbox" name="b" value="${b.n}" ${sel.has(b.n) ? 'checked' : ''}> ${b.n}. ${U.esc(b.titulo)}</label>`).join('')
        : `<p class="pista">Esta asignatura no tiene apuntes todavía. Sin bloques marcados se abren todos sus apuntes.</p>`;
    };
    const pintarTipo = () => {
      const est = form.tipo.value === 'estudio';
      U.$('.campo-min', form).hidden = !est; U.$('.campo-bloques', form).hidden = !est;
    };
    form.asignatura.onchange = pintarBloques; form.tipo.onchange = pintarTipo;
    pintarBloques(); pintarTipo();

    const botones = [{ texto: 'Cancelar', valor: null }];
    if (id) botones.unshift({ texto: 'Borrar', valor: 'borrar', clase: 'peligro-txt' });
    botones.push({
      texto: 'Guardar', clase: 'primario',
      antes: () => {
        const err = U.$('.error', form);
        if (!form.fecha.value || !form.titulo.value.trim()) { err.textContent = 'Pon el día y qué hay que hacer.'; err.hidden = false; return false; }
        if (form.tipo.value === 'estudio' && !(Number(form.minutos.value) > 0)) { err.textContent = 'Las tareas de estudio necesitan minutos.'; err.hidden = false; return false; }
        return true;
      },
      valor: () => ({
        fecha: form.fecha.value, asignatura: form.asignatura.value, titulo: form.titulo.value.trim(), tipo: form.tipo.value,
        minutos: Number(form.minutos.value), bloques: U.$$('input[name=b]:checked', form).map((c) => Number(c.value)),
      }),
    });
    const r = await U.modal(id ? 'Editar tarea' : 'Añadir tarea', form, botones);
    if (!r) return;
    if (r === 'borrar') {
      const msg = t.hecha ? 'Esta tarea está completada: si la borras, su pieza desaparecerá de la civilización.' : '¿Borrar esta tarea?';
      if (!(await U.confirmar('Borrar tarea', msg, 'Borrar', 'Cancelar', true))) return;
      Modelo.borrarTarea(id);
    } else {
      Modelo.guardarTarea({ ...t, ...r, id: t.id, sugerida: id ? t.sugerida : false });
      U.tostada(id ? 'Tarea guardada' : 'Tarea añadida');
    }
    AppUI.refrescar();
  }

  function init() {
    U.$('#btn-ir-hoy').onclick = irAHoy;
    U.$('#btn-anadir-tarea').onclick = () => editarTarea(null);
  }

  return { render, init, irAHoy, editarTarea };
})();
