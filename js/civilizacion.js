/* La civilización: una escena SVG que crece con cada tarea completada.
   - Cada tarea completada es una pieza con una posición fija (slot) en el mapa.
   - Los exámenes hechos levantan edificios especiales y hacen avanzar de era.
   - La pieza número N (la última) es el monumento final. */
'use strict';

const Civ = (() => {
  const W = 1200, H = 760, CX = 690, CY = 462, HORIZONTE = 262;
  const TINTA = '#3a2f28';
  const ERAS = [
    { n: 'Campamento', i: '⛺' }, { n: 'Aldea de chozas', i: '🛖' }, { n: 'Granjas y río', i: '🌾' },
    { n: 'Pueblo con mercado', i: '🏪' }, { n: 'Ciudad amurallada', i: '🧱' }, { n: 'Castillo', i: '🏰' }, { n: 'Gran ciudad', i: '🏙️' },
  ];
  const costa = (y) => 1110 - (y - HORIZONTE) * 0.2 + 16 * Math.sin(y / 38);
  const ESPECIALES = [
    { tipo: 'torre', nombre: 'Torre del saber', x: 560, y: 345 },
    { tipo: 'puerto', nombre: 'Puerto', x: costa(612) - 12, y: 612 },
    { tipo: 'biblioteca', nombre: 'Gran biblioteca', x: 845, y: 488 },
    { tipo: 'universidad', nombre: 'Universidad', x: 612, y: 552 },
    { tipo: 'observatorio', nombre: 'Observatorio', x: 196, y: 334 },
    { tipo: 'teatro', nombre: 'Teatro', x: 452, y: 452 },
    { tipo: 'catedral', nombre: 'Catedral', x: 792, y: 372 },
    { tipo: 'arco', nombre: 'Arco del triunfo', x: 690, y: 690 },
  ];
  const RIO = [[300, HORIZONTE], [284, 330], [312, 410], [402, 500], [560, 600], [780, 668], [960, 704], [costa(722) + 8, 722]];
  const CAMINOS = [
    [[CX, CY], [CX, H]],
    [[CX, CY], [380, 470], [0, 455]],
    [[CX, CY], [900, 522], [costa(606) - 30, 606]],
    [[CX, CY], [700, HORIZONTE + 4]],
  ];
  const PUENTES = [[366, 467, -48], [690, 641, 18]];
  const MOLINO = [238, 535];
  const CASTILLO = { x: 935, y: 300 };
  const CAMPOS = [[150, 515, 70, 34], [200, 590, 80, 36], [330, 655, 90, 34], [470, 712, 96, 30], [80, 680, 80, 40], [880, 735, 80, 22], [120, 380, 60, 26]];

  /* ---------- geometría ---------- */
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  const distLinea = (x, y, pts) => { let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, distSeg(x, y, ...pts[i - 1], ...pts[i])); return m; };

  function libre(x, y) {
    if (y < HORIZONTE + 18 || y > H - 10 || x < 18) return false;
    if (x > costa(y) - 30) return false;
    if (distLinea(x, y, RIO) < 27) return false;
    if (Math.hypot(x - CX, y - CY) < 64) return false;
    if (CAMINOS.some((c) => distLinea(x, y, c) < 15)) return false;
    if (ESPECIALES.some((e) => Math.hypot(x - e.x, (y - e.y) * 1.3) < (e.tipo === 'puerto' ? 70 : 52))) return false;
    if (((x - CASTILLO.x) / 150) ** 2 + ((y - CASTILLO.y) / 48) ** 2 < 1) return false;
    if (Math.hypot(x - MOLINO[0], y - MOLINO[1]) < 34) return false;
    return true;
  }

  // Slots fijos: el mismo orden siempre, del centro hacia fuera. No dependen de N.
  const SLOTS = (() => {
    const rnd = U.aleatorio(20261109);
    const c = [];
    let fila = 0;
    for (let y = HORIZONTE + 22; y <= H - 12; y += 26, fila++) {
      for (let x = 24; x <= 1110; x += 33) {
        const px = x + (fila % 2 ? 16 : 0) + (rnd() - 0.5) * 12;
        const py = y + (rnd() - 0.5) * 8;
        const ruido = rnd();
        if (!libre(px, py)) continue;
        c.push({ x: Math.round(px), y: Math.round(py), d: Math.hypot(px - CX, (py - CY) * 1.75) + ruido * 36 });
      }
    }
    return c.sort((a, b) => a.d - b.d);
  })();
  function posSlot(i) {
    if (i < SLOTS.length) return SLOTS[i];
    const r = U.aleatorio(i * 7919)(); const r2 = U.aleatorio(i * 104729)();
    return { x: Math.round(40 + r * 980), y: Math.round(HORIZONTE + 30 + r2 * 460) }; // desbordamiento
  }

  const ARBOLES = (() => {
    const rnd = U.aleatorio(777);
    const a = [];
    for (let i = 0; i < 420 && a.length < 190; i++) {
      const y = HORIZONTE + 6 + Math.pow(rnd(), 1.4) * (H - HORIZONTE - 10);
      const x = rnd() * 1120;
      if (x > costa(y) - 16 || distLinea(x, y, RIO) < 20 || Math.hypot(x - CX, y - CY) < 90) continue;
      if (CAMINOS.some((c) => distLinea(x, y, c) < 10)) continue;
      a.push({ x: Math.round(x), y: Math.round(y), t: rnd(), s: 0.7 + rnd() * 0.6 });
    }
    return a;
  })();

  /* ---------- estado ---------- */
  function examenesOrdenados() {
    return App.tareas.filter((t) => t.tipo === 'examen').sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creada - b.creada);
  }
  function estado() {
    const N = Modelo.total(), k = Modelo.hechas();
    const ex = examenesOrdenados();
    const E = ex.length, e = ex.filter((t) => t.hecha).length;
    const P = 6 - Math.min(E, 3);
    const eraDe = (kk, ee) => (N && kk >= N ? 6 : Math.min(6, Math.floor((N ? (P * kk) / N : 0) + 1e-9) + ee));
    const era = eraDe(k, e);
    let faltan = null;
    if (era < 6) for (let j = 1; k + j <= N; j++) if (eraDe(k + j, e) > era) { faltan = j; break; }
    const proximoExamen = ex.find((t) => !t.hecha);
    return { N, k, era, faltan, proximoExamen, completa: N > 0 && k === N, examenes: ex };
  }

  /* ---------- dibujo ---------- */
  const TEJAS = ['#c8553d', '#b5523b', '#d17a3a', '#8c4a3a', '#a65a3b', '#7a5a8c'];
  const PAREDES = ['#f1e4c8', '#ead7b0', '#efe2cc', '#f5ecd9', '#e6d3b3'];
  const sombra = (rx = 15) => `<ellipse cx="0" cy="1" rx="${rx}" ry="${rx * 0.24}" fill="#2b2a1f" opacity=".18"/>`;
  const S = `stroke="${TINTA}" stroke-width="1.2" stroke-linejoin="round"`;

  function edificio(nivel, h) {
    const tej = TEJAS[h % TEJAS.length], par = PAREDES[(h >> 3) % PAREDES.length];
    switch (nivel) {
      case 0: return sombra(13) + `<path d="M-13 0 L0 -22 L13 0 Z" fill="${['#d9a441', '#c97b4a', '#8fa36b', '#b9895a'][h % 4]}" ${S}/>
        <path d="M0 -22 L-4 0 L4 0 Z" fill="${TINTA}" opacity=".45"/><path d="M0 -22 V-28" ${S}/>
        ${h % 3 === 0 ? `<g transform="translate(17,0)"><path d="M-5 0 L5 0" ${S}/><path class="llama" d="M-3 -1 Q0 -11 3 -1 Z" fill="#f2a33a"/></g>` : ''}`;
      case 1: return sombra(14) + `<rect x="-11" y="-12" width="22" height="12" fill="#c49a6c" ${S}/>
        <path d="M-15 -10 Q0 -36 15 -10 Z" fill="#d8b24c" ${S}/><path d="M-10 -16 H10 M-7 -22 H7" stroke="#a8862e" stroke-width="1.2"/>
        <rect x="-3" y="-8" width="6" height="8" fill="#4a3426"/>`;
      case 2: return sombra(18) + `<g transform="translate(14,0)"><rect x="0" y="-6" width="15" height="6" fill="#d9c25a" ${S}/><path d="M3 -6 V0 M7 -6 V0 M11 -6 V0" stroke="#b39a36"/></g>
        <rect x="-12" y="-14" width="24" height="14" fill="#b5523b" ${S}/><path d="M-14.5 -13 L0 -26 L14.5 -13 Z" fill="#6e2b20" ${S}/>
        <rect x="-5" y="-8" width="10" height="8" fill="#f3e3c3" ${S}/><path d="M-5 -8 L5 0 M5 -8 L-5 0" stroke="#b5523b"/>`;
      case 3: return sombra(16) + `<rect x="-12" y="-16" width="24" height="16" fill="${par}" ${S}/>
        <path d="M-14.5 -15 L0 -29 L14.5 -15 Z" fill="${tej}" ${S}/><rect x="-3" y="-9" width="6" height="9" fill="#5b4030"/>
        <rect x="-9.5" y="-13" width="4" height="4" fill="#86b8cc"/><rect x="5.5" y="-13" width="4" height="4" fill="#86b8cc"/>
        ${h % 2 ? `<path d="M12 -9 h9 l-2 4 h-7 z" fill="${['#e4b33d', '#3d8fb0', '#c8553d'][h % 3]}" ${S}/><path d="M13 -5 V0 M19 -5 V0" ${S}/>` : ''}`;
      case 4: return sombra(17) + `<rect x="-13" y="-28" width="26" height="28" fill="#d3cab8" ${S}/>
        <path d="M-13 -19 H13 M-13 -10 H13" stroke="#b5aa94"/><path d="M-15.5 -27 L0 -39 L15.5 -27 Z" fill="${tej}" ${S}/>
        <rect x="-9" y="-24" width="4" height="4" fill="#86b8cc"/><rect x="5" y="-24" width="4" height="4" fill="#86b8cc"/>
        <rect x="-9" y="-15" width="4" height="4" fill="#86b8cc"/><rect x="5" y="-15" width="4" height="4" fill="#86b8cc"/>
        <path d="M-3 0 V-7 Q0 -10 3 -7 V0 Z" fill="#5b4030"/>`;
      case 5: return sombra(19) + `<rect x="-15" y="-24" width="22" height="24" fill="${par}" ${S}/>
        <path d="M-17 -23 L-4 -34 L9 -23 Z" fill="${tej}" ${S}/><rect x="5" y="-40" width="11" height="40" fill="#ddd2bf" ${S}/>
        <path d="M3.5 -40 L10.5 -53 L17.5 -40 Z" fill="#3f6e8c" ${S}/><rect x="8.5" y="-33" width="4" height="6" fill="#86b8cc"/>
        <rect x="-11" y="-17" width="4" height="4" fill="#86b8cc"/><rect x="-3" y="-17" width="4" height="4" fill="#86b8cc"/><rect x="-7" y="-8" width="5" height="8" fill="#5b4030"/>`;
      default: {
        let v = '';
        for (let f = 0; f < 5; f++) for (let c = 0; c < 3; c++) v += `<rect x="${-8 + c * 6}" y="${-46 + f * 8}" width="3.5" height="4.5" fill="${(h >> (f + c)) & 1 ? '#ffd76a' : '#86b8cc'}"/>`;
        const techo = h % 2 ? `<path d="M-9 -50 Q0 -66 9 -50 Z" fill="#4f8a8b" ${S}/><path d="M0 -62 V-68" ${S}/>`
          : `<rect x="-13.5" y="-53" width="27" height="4" fill="${tej}" ${S}/><path d="M8 -53 V-64" ${S}/><path d="M8 -64 l8 2.5 l-8 2.5 z" fill="#c8553d"/>`;
        return sombra(17) + `<rect x="-12" y="-50" width="24" height="50" fill="${par}" ${S}/>${v}<rect x="-3" y="-7" width="6" height="7" fill="#5b4030"/>${techo}`;
      }
    }
  }

  function especial(tipo) {
    switch (tipo) {
      case 'torre': return sombra(20) + `<rect x="-10" y="-70" width="20" height="70" fill="#d8cdb8" ${S}/>
        <rect x="-13" y="-80" width="26" height="11" fill="#cbbfa8" ${S}/>
        ${[-13, -6, 1, 8].map((x) => `<rect x="${x}" y="-85" width="5" height="5" fill="#cbbfa8" ${S}/>`).join('')}
        <rect x="-2" y="-60" width="4" height="9" fill="${TINTA}"/><rect x="-2" y="-38" width="4" height="9" fill="${TINTA}"/>
        <path d="M-4 0 V-12 Q0 -17 4 -12 V0 Z" fill="#5b4030"/><path d="M0 -85 V-104" ${S}/><path class="bandera" d="M0 -104 l15 4 l-15 4 z" fill="#c8553d" ${S}/>`;
      case 'puerto': return `<rect x="-6" y="-4" width="76" height="8" fill="#9c7048" ${S}/>
        ${[4, 20, 36, 52, 66].map((x) => `<rect x="${x}" y="3" width="3" height="9" fill="#6d4c31"/>`).join('')}
        <g transform="translate(-28,0)">${sombra(16)}<rect x="-14" y="-18" width="28" height="18" fill="#cdb48c" ${S}/><path d="M-16 -17 L0 -28 L16 -17 Z" fill="#7b4b33" ${S}/><rect x="-5" y="-11" width="10" height="11" fill="#5b4030"/></g>
        <g class="barca" transform="translate(44,20)"><path d="M-16 0 Q0 9 16 0 Z" fill="#8c4a3a" ${S}/><path d="M0 0 V-24" ${S}/><path d="M1 -23 L13 -4 L1 -4 Z" fill="#f4ede0" ${S}/></g>
        <g transform="translate(76,-2)">${sombra(9)}<rect x="-6" y="-40" width="12" height="40" fill="#f4ede0" ${S}/><rect x="-6" y="-30" width="12" height="6" fill="#c8553d"/><rect x="-6" y="-14" width="12" height="6" fill="#c8553d"/>
        <rect x="-7" y="-48" width="14" height="8" fill="#ffd76a" ${S}/><path d="M-8 -48 L0 -56 L8 -48 Z" fill="#3a2f28"/><circle class="faro" cx="0" cy="-44" r="16" fill="#ffd76a" opacity=".25"/></g>`;
      case 'biblioteca': return sombra(32) + `<rect x="-31" y="-6" width="62" height="6" fill="#e2dccb" ${S}/><rect x="-28" y="-10" width="56" height="4" fill="#ebe5d6" ${S}/>
        ${[-22, -11, 0, 11, 22].map((x) => `<rect x="${x - 2.5}" y="-36" width="5" height="26" fill="#f4efe3" ${S}/>`).join('')}
        <rect x="-29" y="-41" width="58" height="5" fill="#ebe5d6" ${S}/><path d="M-31 -41 L0 -57 L31 -41 Z" fill="#e2dccb" ${S}/><circle cx="0" cy="-47" r="3" fill="#c9a227"/>`;
      case 'universidad': return sombra(40) + `<rect x="-38" y="-30" width="76" height="30" fill="#e8dcc0" ${S}/>
        ${[-30, -20, 14, 24].map((x) => `<rect x="${x}" y="-24" width="5" height="7" fill="#86b8cc"/><rect x="${x}" y="-12" width="5" height="7" fill="#86b8cc"/>`).join('')}
        <path d="M-40 -30 H40 L36 -36 H-36 Z" fill="#a65a3b" ${S}/><rect x="-13" y="-48" width="26" height="48" fill="#efe4cb" ${S}/>
        <path d="M-15 -48 Q0 -74 15 -48 Z" fill="#5d8aa8" ${S}/><path d="M0 -66 V-74" ${S}/><circle cx="0" cy="-38" r="5" fill="#fff" ${S}/><path d="M0 -38 V-41 M0 -38 H2.5" stroke="${TINTA}"/>
        <path d="M-5 0 V-14 Q0 -20 5 -14 V0 Z" fill="#5b4030"/>`;
      case 'observatorio': return sombra(22) + `<rect x="-17" y="-26" width="34" height="26" fill="#e6e0d4" ${S}/>
        <path d="M-19 -26 A19 19 0 0 1 19 -26 Z" fill="#9aa7b5" ${S}/><path d="M-2 -44 L3 -44 L3 -26 L-2 -26 Z" fill="#3b4652"/>
        <path d="M1 -38 L18 -54" stroke="#3b4652" stroke-width="4" stroke-linecap="round"/><rect x="-4" y="-11" width="8" height="11" fill="#5b4030"/>`;
      case 'teatro': return sombra(36) + `<path d="M-36 0 A36 24 0 0 1 36 0 Z" fill="#dcc7a2" ${S}/>
        <path d="M-28 0 A28 18 0 0 1 28 0 Z" fill="#ccb08a" ${S}/><path d="M-20 0 A20 12 0 0 1 20 0 Z" fill="#bb9a73" ${S}/>
        <rect x="-12" y="-5" width="24" height="6" fill="#7a4a3a" ${S}/><circle cx="-5" cy="-11" r="3" fill="#f4ede0" ${S}/><circle cx="5" cy="-11" r="3" fill="#e9c46a" ${S}/>`;
      case 'catedral': return sombra(34) + `<rect x="-20" y="-36" width="40" height="36" fill="#e0d6c2" ${S}/><path d="M-22 -35 L0 -50 L22 -35 Z" fill="#8c4a3a" ${S}/>
        <rect x="-32" y="-60" width="13" height="60" fill="#d9cdb6" ${S}/><rect x="19" y="-60" width="13" height="60" fill="#d9cdb6" ${S}/>
        <path d="M-34 -60 L-25.5 -82 L-17 -60 Z" fill="#5a6e7a" ${S}/><path d="M17 -60 L25.5 -82 L34 -60 Z" fill="#5a6e7a" ${S}/>
        <circle cx="0" cy="-25" r="6.5" fill="#c86f8a" ${S}/><path d="M-6 0 V-10 Q0 -17 6 -10 V0 Z" fill="#5b4030"/>
        <rect x="-27.5" y="-48" width="4" height="8" fill="#86b8cc"/><rect x="23.5" y="-48" width="4" height="8" fill="#86b8cc"/>`;
      default: return sombra(28) + `<path d="M-26 0 V-40 H26 V0 H12 V-18 Q0 -32 -12 -18 V0 Z" fill="#e2d6bd" ${S}/><rect x="-28" y="-46" width="56" height="7" fill="#cbbb9c" ${S}/><path d="M-8 -46 L0 -54 L8 -46" fill="#c9a227" ${S}/>`;
    }
  }

  function monumento() {
    return `<circle class="aura" cx="0" cy="-50" r="70" fill="url(#brillo)"/>${sombra(30)}
      <rect x="-26" y="-10" width="52" height="10" fill="#d8cdb8" ${S}/><rect x="-19" y="-20" width="38" height="10" fill="#e4dac6" ${S}/>
      <path d="M-8 -20 L-4.5 -98 L0 -108 L4.5 -98 L8 -20 Z" fill="#e9c46a" ${S}/><path d="M0 -108 L4.5 -98 L8 -20 L2 -20 Z" fill="#c9a227" opacity=".7"/>
      <circle cx="0" cy="-112" r="5" fill="#fff6c9" ${S}/>
      <path d="M-30 -10 l-8 -14 M30 -10 l8 -14" stroke="#c8553d" stroke-width="2"/><path d="M-38 -24 l8 3 l-8 3 z M38 -24 l-8 3 l8 3 z" fill="#c8553d"/>`;
  }

  function ruina(contenido) {
    return `<g filter="url(#gris)" opacity=".75">${contenido}</g>
      <path d="M-6 -4 l3 -6 l-2 -4 l3 -5 M5 -2 l-2 -7 l3 -4" stroke="#2c2a26" stroke-width="1.3" fill="none"/>
      <circle cx="-9" cy="-1" r="2.5" fill="#8d877c"/><circle cx="8" cy="0" r="2" fill="#8d877c"/><circle cx="12" cy="-1" r="1.6" fill="#a19a8e"/>
      <path class="humo" d="M0 -20 q-6 -8 0 -16 q6 -8 0 -16" stroke="#9a948a" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>`;
  }

  function arbol(a) {
    const s = a.s * (0.75 + ((a.y - HORIZONTE) / (H - HORIZONTE)) * 0.45);
    const color = ['#6f9a52', '#5f8a47', '#7aa65a', '#4f7d42'][Math.floor(a.t * 4)];
    if (a.t > 0.62) return `<g transform="translate(${a.x},${a.y}) scale(${s.toFixed(2)})"><path d="M0 0 V-6" stroke="#6b4a2f" stroke-width="2"/><path d="M-7 -4 L0 -24 L7 -4 Z" fill="#4c7a4a" ${S}/></g>`;
    return `<g transform="translate(${a.x},${a.y}) scale(${s.toFixed(2)})"><path d="M0 0 V-7" stroke="#6b4a2f" stroke-width="2"/><circle cx="0" cy="-12" r="7.5" fill="${color}" ${S}/></g>`;
  }

  function curva(pts) { // Catmull-Rom → Bézier
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)},${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function fondo(era, p) {
    const sx = 140 + p * 900, sy = 120 - Math.sin(p * Math.PI) * 50;
    let costaD = `M${costa(HORIZONTE).toFixed(1)} ${HORIZONTE}`;
    for (let y = HORIZONTE; y <= H; y += 12) costaD += ` L${costa(y).toFixed(1)} ${y}`;
    costaD += ` L${W} ${H} L${W} ${HORIZONTE} Z`;
    const piedra = era >= 3;
    const caminos = era >= 1 ? CAMINOS.map((c) => `<path d="${curva(c)}" fill="none" stroke="${piedra ? '#d8cdb3' : '#cdb07e'}" stroke-width="${piedra ? 15 : 9}" stroke-linecap="round" opacity="${era >= 1 ? 0.95 : 0}"/>`
      + (piedra ? `<path d="${curva(c)}" fill="none" stroke="#c4b796" stroke-width="15" stroke-dasharray="2 9" stroke-linecap="butt" opacity=".6"/>` : '')).join('') : '';
    const campos = era >= 2 ? CAMPOS.map(([x, y, w, h], i) => `<g transform="translate(${x},${y}) skewX(-12)"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${['#d9c25a', '#a7c160', '#c9b04a', '#b8cf6a'][i % 4]}" stroke="#8a7a3a" stroke-width="1" rx="2"/>
      ${Array.from({ length: Math.floor(w / 9) }, (_, k) => `<path d="M${-w / 2 + 5 + k * 9} ${-h / 2 + 3} V${h / 2 - 3}" stroke="#8a7a3a" stroke-width=".8" opacity=".5"/>`).join('')}</g>`).join('') : '';
    return `<defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${era >= 6 ? '#f6c98f' : '#a9d3e6'}"/><stop offset="1" stop-color="#f3ead2"/></linearGradient>
        <linearGradient id="suelo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4cf86"/><stop offset="1" stop-color="#93b768"/></linearGradient>
        <linearGradient id="mar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7dbad4"/><stop offset="1" stop-color="#4f8fb2"/></linearGradient>
        <radialGradient id="brillo"><stop offset="0" stop-color="#ffe9a3" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9a3" stop-opacity="0"/></radialGradient>
        <filter id="gris"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".75"/><feFuncG type="linear" slope=".75"/><feFuncB type="linear" slope=".75"/></feComponentTransfer></filter>
      </defs>
      <rect width="${W}" height="${HORIZONTE + 4}" fill="url(#cielo)"/>
      <circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="34" fill="#fbe39a"/><circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="52" fill="#fbe39a" opacity=".25"/>
      <g class="nubes"><g class="nube n1"><ellipse cx="200" cy="80" rx="46" ry="14" fill="#fff" opacity=".85"/><ellipse cx="226" cy="70" rx="26" ry="14" fill="#fff" opacity=".85"/></g>
        <g class="nube n2"><ellipse cx="760" cy="56" rx="56" ry="13" fill="#fff" opacity=".75"/><ellipse cx="736" cy="47" rx="26" ry="12" fill="#fff" opacity=".75"/></g></g>
      <path d="M0 ${HORIZONTE} L0 196 L70 150 L140 192 L230 120 L320 186 L400 150 L470 200 L560 140 L650 196 L740 158 L830 204 L930 132 L1020 190 L1100 168 L1200 200 L1200 ${HORIZONTE} Z" fill="#9fb0b7" opacity=".85"/>
      <path d="M230 120 L250 134 L238 132 L230 140 L220 130 Z M930 132 L950 146 L938 144 L930 150 L920 142 Z" fill="#f4f1ea"/>
      <path d="M0 ${HORIZONTE} L0 222 L110 206 L210 230 L330 210 L460 236 L600 214 L720 238 L860 216 L1000 236 L1200 220 L1200 ${HORIZONTE} Z" fill="#8aa476"/>
      <rect y="${HORIZONTE}" width="${W}" height="${H - HORIZONTE}" fill="url(#suelo)"/>
      <ellipse cx="${CASTILLO.x}" cy="${CASTILLO.y + 10}" rx="160" ry="44" fill="#a3c178"/><ellipse cx="200" cy="350" rx="110" ry="34" fill="#a8c47c"/>
      <path d="${costaD}" fill="url(#mar)"/><path d="${costaD}" fill="none" stroke="#e9dcb5" stroke-width="7" opacity=".9"/>
      <g class="olas">${[300, 380, 470, 560, 650, 730].map((y, i) => `<path d="M${(costa(y) + 40 + (i % 2) * 30).toFixed(0)} ${y} q8 -5 16 0 q8 5 16 0" stroke="#d6eef6" stroke-width="2" fill="none" opacity=".8"/>`).join('')}</g>
      ${campos}
      <path d="${curva(RIO)}" fill="none" stroke="#e3d7ad" stroke-width="30" stroke-linecap="round"/>
      <path d="${curva(RIO)}" fill="none" stroke="#6fb3cf" stroke-width="22" stroke-linecap="round"/>
      <path d="${curva(RIO)}" fill="none" stroke="#a6d5e6" stroke-width="6" stroke-linecap="round" stroke-dasharray="18 26" class="corriente"/>
      ${caminos}
      ${era >= 2 ? PUENTES.map(([x, y, r]) => `<g transform="translate(${x},${y}) rotate(${r})"><rect x="-10" y="-20" width="20" height="40" fill="${piedra ? '#cfc4ac' : '#a77b52'}" ${S}/><path d="M-10 -14 H10 M-10 -6 H10 M-10 2 H10 M-10 10 H10" stroke="${TINTA}" opacity=".3"/></g>`).join('') : ''}`;
  }

  function plaza(era, completa) {
    let s = '';
    if (era >= 3) s += `<ellipse cx="${CX}" cy="${CY}" rx="56" ry="34" fill="#e2d7bd" stroke="#bfb08e" stroke-width="2"/><ellipse cx="${CX}" cy="${CY}" rx="38" ry="22" fill="none" stroke="#cdbf9f" stroke-dasharray="3 5"/>`;
    else if (era >= 1) s += `<ellipse cx="${CX}" cy="${CY}" rx="46" ry="27" fill="#d6c193" opacity=".9"/>`;
    else s += `<ellipse cx="${CX}" cy="${CY}" rx="34" ry="19" fill="#cdb98c" opacity=".7"/>`;
    if (!completa) {
      if (era >= 3) s += `<g transform="translate(${CX},${CY + 6})">${sombra(14)}<ellipse cx="0" cy="-3" rx="14" ry="6" fill="#bfc9cc" ${S}/><ellipse cx="0" cy="-4" rx="10" ry="3.6" fill="#7dbad4"/><path d="M0 -4 V-16" stroke="#cfe8f1" stroke-width="2"/><circle class="chorro" cx="0" cy="-17" r="3" fill="#cfe8f1"/></g>`;
      else s += `<g transform="translate(${CX},${CY + 4})"><path d="M-8 0 L8 -3 M-8 -3 L8 0" stroke="#6b4a2f" stroke-width="3"/><path class="llama" d="M-6 -2 Q0 -24 6 -2 Z" fill="#f2a33a"/><path class="llama l2" d="M-3 -2 Q0 -14 3 -2 Z" fill="#ffd76a"/><path class="humo" d="M0 -26 q-6 -10 0 -20 q6 -10 0 -20" stroke="#bbb" stroke-width="3" fill="none" opacity=".4"/></g>`;
    }
    if (era >= 3) {
      const colores = ['#c8553d', '#e4b33d', '#3d8fb0', '#2a9d8f', '#8e5cc4', '#d1495b'];
      s += [[-50, -16], [50, -16], [-58, 10], [58, 10], [-30, 28], [30, 28]].map(([dx, dy], i) => `<g transform="translate(${CX + dx},${CY + dy})">${sombra(9)}<rect x="-8" y="-9" width="16" height="9" fill="#f1e4c8" ${S}/><path d="M-10 -9 L-8 -15 H8 L10 -9 Z" fill="${colores[i]}" ${S}/></g>`).join('');
    }
    return s;
  }

  function muralla(era, piezas) {
    if (era < 4) return '';
    let r = 170;
    piezas.forEach((p) => { if (p.slot !== null) { const q = posSlot(p.slot); r = Math.max(r, Math.hypot(q.x - CX, (q.y - CY) * 1.75) + 34); } });
    r = Math.min(r, 520);
    const rx = r, ry = r / 1.75;
    let s = `<ellipse cx="${CX}" cy="${CY}" rx="${rx}" ry="${ry}" fill="none" stroke="#8d8270" stroke-width="10"/><ellipse cx="${CX}" cy="${CY}" rx="${rx}" ry="${ry}" fill="none" stroke="#c2b79f" stroke-width="6" stroke-dasharray="7 4"/>`;
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const x = CX + Math.cos(ang) * rx, y = CY + Math.sin(ang) * ry;
      if (y < HORIZONTE + 4 || x > costa(Math.max(y, HORIZONTE)) - 4) continue;
      s += `<g transform="translate(${x.toFixed(0)},${y.toFixed(0)})"><rect x="-7" y="-20" width="14" height="22" fill="#cfc4ac" ${S}/>${[-7, -2, 3].map((xx) => `<rect x="${xx}" y="-24" width="4" height="4" fill="#cfc4ac" ${S}/>`).join('')}</g>`;
    }
    return s;
  }

  function castillo() {
    return `<g transform="scale(1.25)">${sombra(46)}
      <rect x="-40" y="-26" width="80" height="26" fill="#d3c8b0" ${S}/>${[-40, -28, -16, -4, 8, 20, 32].map((x) => `<rect x="${x}" y="-31" width="7" height="5" fill="#d3c8b0" ${S}/>`).join('')}
      <rect x="-14" y="-52" width="28" height="52" fill="#ddd2bb" ${S}/>${[-14, -6, 2, 10].map((x) => `<rect x="${x}" y="-57" width="5" height="5" fill="#ddd2bb" ${S}/>`).join('')}
      <rect x="-52" y="-40" width="14" height="40" fill="#cfc4ac" ${S}/><path d="M-54 -40 L-45 -56 L-36 -40 Z" fill="#3f6e8c" ${S}/>
      <rect x="38" y="-40" width="14" height="40" fill="#cfc4ac" ${S}/><path d="M36 -40 L45 -56 L54 -40 Z" fill="#3f6e8c" ${S}/>
      <path d="M-7 0 V-14 Q0 -22 7 -14 V0 Z" fill="#5b4030"/><rect x="-3" y="-42" width="6" height="8" fill="#3a2f28"/>
      <path d="M0 -57 V-76" ${S}/><path class="bandera" d="M0 -76 l16 4 l-16 4 z" fill="#c9a227" ${S}/></g>`;
  }

  function extrasGranCiudad() {
    return `<g class="globo"><ellipse cx="0" cy="0" rx="16" ry="19" fill="#d1495b" ${S}/><path d="M-6 -18 Q0 0 -6 18 M6 -18 Q0 0 6 18" stroke="#f4ede0" stroke-width="2" fill="none"/>
      <path d="M-5 18 L-4 26 M5 18 L4 26" stroke="${TINTA}"/><rect x="-5" y="26" width="10" height="7" fill="#9c7048" ${S}/></g>
      <g class="pajaros"><path d="M380 110 q5 -5 10 0 q5 -5 10 0 M420 96 q4 -4 8 0 q4 -4 8 0" stroke="${TINTA}" fill="none" stroke-width="1.5"/></g>`;
  }

  function molino(era) {
    if (era < 2) return '';
    return `<g>${sombra(14)}<path d="M-10 0 L-7 -34 H7 L10 0 Z" fill="#efe2cc" ${S}/><path d="M-9 -34 L0 -44 L9 -34 Z" fill="#8c4a3a" ${S}/>
      <g class="aspas" style="transform-origin:0px -36px"><path d="M0 -36 L0 -62 L5 -60 L3 -36 Z M0 -36 L26 -36 L24 -31 L0 -33 Z M0 -36 L0 -10 L-5 -12 L-3 -36 Z M0 -36 L-26 -36 L-24 -41 L0 -39 Z" fill="#f4ede0" ${S}/></g>
      <circle cx="0" cy="-36" r="2.5" fill="${TINTA}"/></g>`;
  }

  /* ---------- render principal ---------- */
  function render() {
    const est = estado();
    const piezas = App.piezas;
    const tareasPorId = new Map(App.tareas.map((t) => [t.id, t]));
    const ultima = est.completa ? [...piezas].sort((a, b) => b.ts - a.ts)[0] : null;
    const p = est.N ? est.k / est.N : 0;

    const objetos = []; // { x, y, svg, clave }
    ARBOLES.forEach((a) => {
      const tapado = piezas.some((pz) => {
        const q = pz.slot !== null ? posSlot(pz.slot) : null;
        return q && Math.abs(q.x - a.x) < 22 && Math.abs(q.y - a.y) < 16;
      });
      if (!tapado) objetos.push({ x: a.x, y: a.y, svg: arbol(a) });
    });
    if (est.era >= 5) objetos.push({ x: CASTILLO.x, y: CASTILLO.y + 6, svg: castillo() });
    const mol = molino(est.era); if (mol) objetos.push({ x: MOLINO[0], y: MOLINO[1], svg: mol });

    piezas.forEach((pz) => {
      const t = tareasPorId.get(pz.tareaId);
      if (!t) return;
      const nombreTarea = `${t.asignatura} · ${t.titulo}`;
      if (t.tipo === 'examen') {
        const idx = est.examenes.findIndex((x) => x.id === t.id);
        const esp = ESPECIALES[Math.min(idx, ESPECIALES.length - 1)];
        let { x, y } = esp;
        if (idx >= ESPECIALES.length) { const q = posSlot(200 + idx); x = q.x; y = q.y; }
        let svg = especial(esp.tipo);
        if (pz.danada) svg = ruina(svg);
        objetos.push({ x, y, svg, info: `${esp.nombre} — ${nombreTarea}${pz.danada ? ' (dañada)' : ''}`, id: t.id, escala: 1.15 });
        return;
      }
      if (ultima && ultima.tareaId === pz.tareaId) return; // la última pieza es el monumento
      const q = posSlot(pz.slot);
      const h = U.hash('s' + pz.slot);
      const retraso = h % 3 === 0 ? 1 : 0;
      const nivel = Math.max(0, Math.min(6, est.era - retraso));
      let svg = edificio(nivel, h);
      if (pz.danada) svg = ruina(svg);
      objetos.push({ x: q.x, y: q.y, svg, info: `${nombreTarea}${pz.danada ? ' (dañada: repite una sesión limpia de ' + t.asignatura + ')' : ''}`, id: t.id });
    });
    if (ultima) {
      const t = tareasPorId.get(ultima.tareaId);
      objetos.push({ x: CX, y: CY + 2, svg: monumento(), info: `Monumento final — ${t ? t.asignatura + ' · ' + t.titulo : ''}`, id: ultima.tareaId, escala: 1.1 });
    }

    objetos.sort((a, b) => a.y - b.y);
    const persp = (y) => (0.72 + ((y - HORIZONTE) / (H - HORIZONTE)) * 0.5).toFixed(3);
    const cuerpo = objetos.map((o) => {
      const s = (persp(o.y) * (o.escala || 1)).toFixed(3);
      const nueva = o.id && o.id === App.animarPieza;
      const polvo = nueva ? `<g class="polvo">${[-14, -6, 4, 13, 0].map((dx, i) => `<circle cx="${dx}" cy="${-2 - (i % 2) * 3}" r="${4 + (i % 3)}" style="animation-delay:${0.25 + i * 0.05}s"/>`).join('')}</g>` : '';
      const inner = `<g class="${nueva ? 'nueva' : ''}">${o.svg}</g>${polvo}`;
      return `<g transform="translate(${o.x},${o.y}) scale(${s})" ${o.info ? `class="pieza" data-info="${U.esc(o.info)}"` : ''}>${o.info ? `<title>${U.esc(o.info)}</title>` : ''}${inner}</g>`;
    }).join('');

    const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Civilización: ${ERAS[est.era].n}, ${est.k} de ${est.N} piezas">
      ${fondo(est.era, p)}
      ${muralla(est.era, piezas)}
      ${plaza(est.era, est.completa)}
      ${cuerpo}
      ${est.era >= 6 ? extrasGranCiudad() : ''}
    </svg>`;
    const cont = U.$('#escena');
    cont.innerHTML = svg;
    App.animarPieza = null;

    // cabecera de progreso
    U.$('#civ-contador').textContent = `${est.k} de ${est.N} tareas`;
    U.$('#civ-era').textContent = `${ERAS[est.era].i} ${ERAS[est.era].n}`;
    const barra = U.$('#civ-barra');
    barra.firstElementChild.style.width = `${(p * 100).toFixed(1)}%`;
    barra.setAttribute('aria-valuenow', Math.round(p * 100));
    let sub = '';
    if (est.completa) sub = '🏆 ¡Civilización completa! Has construido el monumento final.';
    else if (est.N) {
      const partes = [];
      if (est.faltan) partes.push(`${est.faltan} ${est.faltan === 1 ? 'tarea' : 'tareas'} más`);
      if (est.proximoExamen) partes.push(`al hacer el examen de ${est.proximoExamen.asignatura}`);
      sub = est.era < 6 ? `Siguiente era (${ERAS[est.era + 1].n}): ${partes.join(' o ') || 'al completar todo'}.` : (est.N - est.k === 1 ? 'Solo te queda 1 tarea para el monumento final.' : `Te quedan ${est.N - est.k} tareas para el monumento final.`);
      const danadas = App.piezas.filter((x) => x.danada).length;
      if (danadas) sub += ` · 🏚️ ${danadas} ${danadas === 1 ? 'pieza dañada' : 'piezas dañadas'}`;
    }
    U.$('#civ-sub').textContent = sub;
    U.$('#civ-vacia').hidden = est.N > 0;

    centrarEnMovil();
  }

  let centrado = false;
  function centrarEnMovil() {
    const marco = U.$('#escena');
    if (centrado || marco.scrollWidth <= marco.clientWidth) return;
    centrado = true;
    marco.scrollLeft = (marco.scrollWidth * (CX / W)) - marco.clientWidth / 2;
  }

  function init() {
    U.$('#escena').addEventListener('click', (e) => {
      const g = e.target.closest('.pieza');
      if (g) U.tostada(g.dataset.info, { duracion: 3500 });
    });
  }

  function mostrarCompleta() {
    const est = estado();
    const sesiones = App.sesiones.filter((s) => s.estado === 'completada');
    const minutos = Math.round(sesiones.reduce((s, x) => s + (x.minutos || 0), 0));
    const capa = U.el(`<div class="completa"><div class="completa-caja">
      <div class="fuegos">🎆 🏛️ 🎆</div>
      <h1>Civilización completa</h1>
      <p>Has completado las <strong>${est.N}</strong> tareas y tu pueblo se ha convertido en una gran ciudad con su monumento final.</p>
      <p class="pista">${sesiones.length} sesiones de estudio · ${U.fmtMin(minutos) || '0 min'} dentro del modo estudio · ${est.examenes.filter((t) => t.hecha).length} exámenes hechos</p>
      <button class="btn primario grande">Contemplar mi civilización</button></div></div>`);
    U.$('button', capa).onclick = () => { capa.remove(); location.hash = '#inicio'; };
    document.body.appendChild(capa);
  }

  return { render, init, estado, ERAS, mostrarCompleta };
})();
