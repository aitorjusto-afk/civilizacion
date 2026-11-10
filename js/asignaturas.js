/* Pantalla de asignaturas: crear, editar y borrar (sigla, nombre, color y fecha de examen). */
'use strict';

const Asignaturas = (() => {
  function render() {
    const cont = U.$('#lista-asignaturas');
    if (!App.asignaturas.length) {
      cont.innerHTML = '<div class="tarjeta vacio">No hay asignaturas. Crea la primera con «Nueva asignatura».</div>';
      return;
    }
    cont.innerHTML = `<div class="rejilla-asig">${App.asignaturas.map((a) => {
      const nTareas = App.tareas.filter((t) => t.asignatura === a.id).length;
      const nBloques = Modelo.bloquesDe(a.id).length;
      const falta = a.examen ? U.diasEntre(U.hoy(), a.examen) : null;
      const examen = a.examen
        ? `${U.fmtDia(a.examen)}${a.hora ? ', ' + U.esc(a.hora) : ''} <span class="pista">(${falta > 0 ? 'faltan ' + falta + ' días' : falta === 0 ? '¡hoy!' : 'ya pasó'})</span>`
        : '<span class="pista">Sin fecha de examen</span>';
      return `<article class="tarjeta asig" style="--c:${a.color}">
        <div class="asig-cab"><span class="sigla" style="background:${a.color};color:${U.colorTexto(a.color)}">${U.esc(a.id)}</span><h3>${U.esc(a.nombre)}</h3></div>
        <p>📝 ${examen}</p>
        <p class="pista">${nTareas} tareas · ${nBloques ? nBloques + ' bloques de apuntes' : 'sin apuntes'}</p>
        <div class="acciones"><button class="btn mini" data-editar="${U.esc(a.id)}">Editar</button><button class="btn mini peligro-txt" data-borrar="${U.esc(a.id)}">Borrar</button></div>
      </article>`;
    }).join('')}</div>`;
    U.$$('[data-editar]', cont).forEach((b) => (b.onclick = () => editar(b.dataset.editar)));
    U.$$('[data-borrar]', cont).forEach((b) => (b.onclick = () => borrar(b.dataset.borrar)));
  }

  async function editar(id) {
    const a = id ? Modelo.asig(id) : { id: '', nombre: '', color: '#6c8ead', examen: '', hora: '' };
    const form = U.el(`<form class="form" onsubmit="return false">
      <label>Sigla (corta, sin espacios)<input name="id" required maxlength="10" value="${U.esc(a.id)}" placeholder="p. ej. SI"></label>
      <label>Nombre<input name="nombre" required value="${U.esc(a.nombre)}" placeholder="Sistemas Informáticos"></label>
      <label>Color<input name="color" type="color" value="${U.esc(a.color)}"></label>
      <div class="fila2">
        <label>Fecha de examen<input name="examen" type="date" value="${U.esc(a.examen || '')}"></label>
        <label>Hora (opcional)<input name="hora" type="time" value="${U.esc(a.hora || '')}"></label>
      </div>
      <p class="error" hidden></p>
    </form>`);
    const r = await U.modal(id ? 'Editar asignatura' : 'Nueva asignatura', form, [
      { texto: 'Cancelar', valor: null },
      {
        texto: 'Guardar', clase: 'primario',
        antes: () => {
          const f = new FormData(form);
          const sigla = String(f.get('id')).trim().toUpperCase().replace(/\s+/g, '');
          const err = U.$('.error', form);
          const mal = (m) => { err.textContent = m; err.hidden = false; return false; };
          if (!sigla) return mal('Pon una sigla.');
          if (!/^[A-Z0-9ÁÉÍÓÚÑ_-]+$/i.test(sigla)) return mal('La sigla solo puede tener letras, números, guiones y _.');
          if (sigla !== a.id && Modelo.asig(sigla)) return mal('Ya existe una asignatura con esa sigla.');
          if (!String(f.get('nombre')).trim()) return mal('Pon un nombre.');
          return true;
        },
        valor: () => Object.fromEntries(new FormData(form)),
      },
    ]);
    if (!r) return;
    const nueva = { id: r.id.trim().toUpperCase().replace(/\s+/g, ''), nombre: r.nombre.trim(), color: r.color, examen: r.examen || '', hora: r.hora || '' };
    if (id) {
      const i = App.asignaturas.findIndex((x) => x.id === id);
      App.asignaturas[i] = nueva;
      if (nueva.id !== id) { // cambio de sigla: se arrastran tareas, piezas y apuntes
        App.tareas.forEach((t) => { if (t.asignatura === id) t.asignatura = nueva.id; });
        App.piezas.forEach((p) => { if (p.asignatura === id) p.asignatura = nueva.id; });
        if (App.apuntes[id]) { await Modelo.guardarApuntes(nueva.id, App.apuntes[id]); await Modelo.guardarApuntes(id, ''); }
        if (App.pdfs[id]) { await Modelo.guardarPdfs(nueva.id, App.pdfs[id]); await Modelo.guardarPdfs(id, []); }
        Modelo.guardarTareas(); Modelo.guardarPiezas();
      }
    } else App.asignaturas.push(nueva);
    Modelo.guardarAsignaturas();
    U.tostada('Asignatura guardada');
    AppUI.refrescar();
  }

  async function borrar(id) {
    const a = Modelo.asig(id);
    const n = App.tareas.filter((t) => t.asignatura === id).length;
    const ok = await U.confirmar('Borrar asignatura', `¿Borrar <strong>${U.esc(a.nombre)}</strong>? ${n ? `Sus ${n} tareas se quedan en la checklist (en gris) y ` : ''}sus apuntes se borrarán.`, 'Borrar', 'Cancelar', true);
    if (!ok) return;
    App.asignaturas = App.asignaturas.filter((x) => x.id !== id);
    Modelo.guardarAsignaturas();
    await Modelo.guardarApuntes(id, '');
    await Modelo.guardarPdfs(id, []);
    AppUI.refrescar();
  }

  function init() { U.$('#btn-nueva-asig').onclick = () => editar(null); }

  return { render, editar, init };
})();
