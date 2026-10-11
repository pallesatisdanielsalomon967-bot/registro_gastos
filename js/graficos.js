/*
 * graficos.js — Dibuja los 3 gráficos de indicadores.
 * Sin librerías externas: barras en HTML/CSS y el gráfico de 30 días en SVG.
 *
 * Reglas que se siguen en los tres:
 *  - Cada categoría tiene SIEMPRE el mismo color (el color sigue a la categoría, no a su posición).
 *  - El color nunca es el único dato: cada barra lleva su nombre y su valor escritos.
 *  - Al pasar el mouse o enfocar con el teclado aparece un recuadro con el detalle.
 *  - Los colores salen de variables CSS, así cambian solos en modo oscuro.
 */
"use strict";

const NS_SVG = "http://www.w3.org/2000/svg";

/** Crea un elemento HTML con clase y texto opcionales. */
function el(etiqueta, clase = "", texto = "") {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== "") nodo.textContent = texto;
  return nodo;
}

/** Crea un elemento SVG con atributos. */
function svgEl(etiqueta, atributos = {}) {
  const nodo = document.createElementNS(NS_SVG, etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, String(valor));
  return nodo;
}

// ---------- Recuadro informativo (tooltip) compartido ----------

let tooltip = null;

function obtenerTooltip() {
  if (!tooltip) tooltip = document.getElementById("tooltip");
  return tooltip;
}

/** Muestra el recuadro con 2 líneas junto al punto (x, y) de la pantalla. */
function mostrarTooltip(titulo, detalle, x, y) {
  const caja = obtenerTooltip();
  if (!caja) return;
  caja.replaceChildren(el("strong", "", titulo), el("span", "", detalle));
  caja.hidden = false;
  const ancho = caja.offsetWidth;
  const alto = caja.offsetHeight;
  const izquierda = Math.min(Math.max(8, x - ancho / 2), window.innerWidth - ancho - 8);
  const arriba = y - alto - 12 < 8 ? y + 16 : y - alto - 12;
  caja.style.left = `${izquierda}px`;
  caja.style.top = `${arriba}px`;
}

function ocultarTooltip() {
  const caja = obtenerTooltip();
  if (caja) caja.hidden = true;
}

/** Conecta un elemento para que muestre el recuadro con el mouse, el dedo o el teclado. */
function conectarTooltip(nodo, titulo, detalle) {
  nodo.addEventListener("pointermove", (e) => mostrarTooltip(titulo, detalle, e.clientX, e.clientY));
  nodo.addEventListener("pointerleave", ocultarTooltip);
  nodo.addEventListener("focus", () => {
    const r = nodo.getBoundingClientRect();
    mostrarTooltip(titulo, detalle, r.left + r.width / 2, r.top);
  });
  nodo.addEventListener("blur", ocultarTooltip);
}

// ============================================================
// GRÁFICO 1 — Categoría con más gastos (barras horizontales ordenadas)
// ============================================================

const MAX_FILAS_RANKING = 6;

/**
 * Dibuja el ranking dentro de `contenedor`. Muestra las 6 categorías con más gasto
 * y junta el resto en "Otras categorías" (gris), para que el gráfico no se llene.
 */
function pintarRanking(contenedor, ranking, palabras = { singular: "gasto", plural: "gastos", otras: "Otras categorías" }) {
  contenedor.replaceChildren();
  if (ranking.length === 0) return;

  let filas = ranking;
  if (ranking.length > MAX_FILAS_RANKING) {
    const resto = ranking.slice(MAX_FILAS_RANKING - 1);
    const total = resto.reduce((s, f) => s + f.total, 0);
    const cantidad = resto.reduce((s, f) => s + f.cantidad, 0);
    const porcentaje = resto.reduce((s, f) => s + f.porcentaje, 0);
    filas = [
      ...ranking.slice(0, MAX_FILAS_RANKING - 1),
      { id: "_resto", nombre: `${palabras.otras} (${resto.length})`, emoji: "", color: COLOR_NEUTRO, total, cantidad, porcentaje }
    ];
  }

  const maximo = Math.max(...filas.map((f) => f.total));
  filas.forEach((fila, indice) => {
    const li = el("li", indice === 0 ? "barra-fila barra-lider" : "barra-fila");
    li.tabIndex = 0;
    li.style.setProperty("--c", `var(--cat-${fila.color})`);

    const etiqueta = el("span", "barra-etiqueta");
    if (fila.emoji) etiqueta.append(el("span", "barra-emoji", fila.emoji));
    etiqueta.append(el("span", "barra-nombre", fila.nombre));

    const pista = el("span", "barra-pista");
    const relleno = el("span", "barra-relleno");
    relleno.style.width = `${Math.max(2, (fila.total / maximo) * 100)}%`;
    pista.append(relleno);

    const valor = el("span", "barra-valor", formatearDinero(fila.total));
    li.append(etiqueta, pista, valor);

    const detalle = `${formatearDinero(fila.total)} · ${Math.round(fila.porcentaje)} % del total · ${fila.cantidad} ${fila.cantidad === 1 ? palabras.singular : palabras.plural}`;
    li.setAttribute("aria-label", `${fila.nombre}: ${detalle}`);
    conectarTooltip(li, fila.nombre, detalle);
    contenedor.append(li);
  });
}

// ============================================================
// GRÁFICO 2 — Historial del último mes (columnas por día, SVG)
// ============================================================

/** Redondea hacia arriba a un número "bonito" (1, 2, 5 × 10ⁿ) para el eje vertical. */
function maximoBonito(valor) {
  if (valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  for (const paso of [1, 2, 5, 10]) {
    if (valor <= paso * potencia) return paso * potencia;
  }
  return 10 * potencia;
}

/** Dibuja una columna con las esquinas de arriba redondeadas y la base recta. */
function rutaColumna(x, y, ancho, alto) {
  const r = Math.min(3, ancho / 2, alto);
  return `M${x},${y + alto} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${y + alto} Z`;
}

/**
 * `dias` es la lista de totalesPorDia(): [{ fecha, total, cantidad }].
 * Se vuelve a llamar cuando cambia el ancho de la ventana.
 */
function pintarHistorial(contenedor, dias) {
  contenedor.replaceChildren();
  const ancho = Math.max(280, Math.floor(contenedor.clientWidth || 600));
  const alto = ancho < 420 ? 190 : 230;
  const margen = { arriba: 10, derecha: 8, abajo: 26, izquierda: 46 };
  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;

  const maxDia = Math.max(...dias.map((d) => d.total));
  const tope = maximoBonito(maxDia);
  const y = (valor) => margen.arriba + altoUtil - (valor / tope) * altoUtil;

  const svg = svgEl("svg", { viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "group", "aria-label": "Gasto diario de los últimos 30 días" });

  // Líneas guía discretas: 0, mitad y tope
  for (const valor of [0, tope / 2, tope]) {
    svg.append(svgEl("line", { class: valor === 0 ? "g-eje" : "g-guia", x1: margen.izquierda, x2: ancho - margen.derecha, y1: y(valor), y2: y(valor) }));
    const texto = svgEl("text", { class: "g-texto", x: margen.izquierda - 8, y: y(valor) + 4, "text-anchor": "end" });
    texto.textContent = formatearDineroCorto(valor);
    svg.append(texto);
  }

  const banda = anchoUtil / dias.length;
  const anchoColumna = Math.max(3, banda - 3);
  dias.forEach((dia, i) => {
    const x = margen.izquierda + i * banda;
    const grupo = svgEl("g", { class: "g-dia", tabindex: 0, role: "img" });
    const detalle = dia.cantidad === 0
      ? "Sin gastos"
      : `${formatearDinero(dia.total)} en ${dia.cantidad} ${dia.cantidad === 1 ? "gasto" : "gastos"}`;
    grupo.setAttribute("aria-label", `${formatearFechaCorta(dia.fecha)}: ${detalle}`);

    // Zona sensible a todo lo alto de la columna (más fácil de tocar que la barra sola)
    grupo.append(svgEl("rect", { class: "g-zona", x, y: margen.arriba, width: banda, height: altoUtil }));
    if (dia.total > 0) {
      const altoBarra = Math.max(2, (dia.total / tope) * altoUtil);
      grupo.append(svgEl("path", { class: "g-barra", d: rutaColumna(x + (banda - anchoColumna) / 2, y(0) - altoBarra, anchoColumna, altoBarra) }));
    }
    conectarTooltip(grupo, formatearFechaCorta(dia.fecha), detalle);
    svg.append(grupo);
  });

  // Etiquetas del eje horizontal: una cada 7 días, terminando en hoy
  for (let i = dias.length - 1; i >= 0; i -= 7) {
    const texto = svgEl("text", { class: "g-texto", x: margen.izquierda + i * banda + banda / 2, y: alto - 6, "text-anchor": i === dias.length - 1 ? "end" : "middle" });
    texto.textContent = i === dias.length - 1 ? "hoy" : formatearFechaCorta(dias[i].fecha);
    svg.append(texto);
  }
  contenedor.append(svg);
}

// ============================================================
// GRÁFICO 3 — Resumen: este mes frente al mes pasado (mismos días)
// ============================================================

/**
 * `resumen` viene de resumenMes(). `etiquetas` = { actual, previo } con el rango
 * de fechas ya escrito, por ejemplo "1–11 oct" y "1–11 sep".
 */
function pintarComparacion(contenedor, resumen, etiquetas) {
  contenedor.replaceChildren();
  const maximo = Math.max(resumen.total, resumen.totalPrevio, 1);
  const filas = [
    { nombre: "Este mes", rango: etiquetas.actual, total: resumen.total, clase: "barra-actual" },
    { nombre: "Mes pasado", rango: etiquetas.previo, total: resumen.totalPrevio, clase: "barra-previa" }
  ];
  for (const fila of filas) {
    const li = el("li", `barra-fila ${fila.clase}`);
    li.tabIndex = 0;
    const etiqueta = el("span", "barra-etiqueta");
    etiqueta.append(el("span", "barra-nombre", fila.nombre), el("small", "barra-rango", fila.rango));
    const pista = el("span", "barra-pista");
    const relleno = el("span", "barra-relleno");
    relleno.style.width = fila.total === 0 ? "0%" : `${Math.max(2, (fila.total / maximo) * 100)}%`;
    pista.append(relleno);
    li.append(etiqueta, pista, el("span", "barra-valor", formatearDinero(fila.total)));
    li.setAttribute("aria-label", `${fila.nombre} (${fila.rango}): ${formatearDinero(fila.total)}`);
    conectarTooltip(li, `${fila.nombre} · ${fila.rango}`, formatearDinero(fila.total));
    contenedor.append(li);
  }
}

/** Texto de la variación con flecha: la dirección no depende solo del color. */
function textoVariacion(resumen) {
  if (resumen.variacion === null) {
    return resumen.total === 0 ? "Aún no hay gastos este mes" : "Sin gastos en esos días del mes pasado para comparar";
  }
  if (resumen.variacion === 0) return "＝ Igual que el mes pasado";
  const flecha = resumen.variacion > 0 ? "▲" : "▼";
  const palabra = resumen.variacion > 0 ? "más" : "menos";
  return `${flecha} ${Math.abs(resumen.variacion)} % ${palabra} que el mes pasado`;
}

// ============================================================
// GRÁFICO 4 — Ingresos de los últimos 6 meses (columnas apiladas por fuente, SVG)
// ============================================================

/**
 * `meses` viene de ingresosPorMes(). Cada columna es un mes; sus tramos son las fuentes.
 * Cada fuente conserva siempre su color; entre tramos hay 2 px de separación.
 */
function pintarIngresos6Meses(contenedor, meses) {
  contenedor.replaceChildren();
  const ancho = Math.max(260, Math.floor(contenedor.clientWidth || 520));
  const alto = ancho < 420 ? 210 : 250;
  const margen = { arriba: 22, derecha: 8, abajo: 26, izquierda: 46 };
  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;
  const tope = maximoBonito(Math.max(...meses.map((m) => m.total)));
  const y = (valor) => margen.arriba + altoUtil - (valor / tope) * altoUtil;

  const svg = svgEl("svg", { viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "group", "aria-label": "Ingresos de los últimos 6 meses, por fuente" });
  for (const valor of [0, tope / 2, tope]) {
    svg.append(svgEl("line", { class: valor === 0 ? "g-eje" : "g-guia", x1: margen.izquierda, x2: ancho - margen.derecha, y1: y(valor), y2: y(valor) }));
    const texto = svgEl("text", { class: "g-texto", x: margen.izquierda - 8, y: y(valor) + 4, "text-anchor": "end" });
    texto.textContent = formatearDineroCorto(valor);
    svg.append(texto);
  }

  const banda = anchoUtil / meses.length;
  const anchoColumna = Math.min(56, Math.max(14, banda - 14));
  meses.forEach((mes, i) => {
    const x0 = margen.izquierda + i * banda;
    const x = x0 + (banda - anchoColumna) / 2;
    const grupo = svgEl("g", { class: "g-mes", tabindex: 0, role: "img" });
    const detalle = mes.total === 0
      ? "Sin ingresos"
      : [formatearDinero(mes.total), ...mes.porFuente.map((f) => `${f.emoji} ${f.nombre}: ${formatearDinero(f.total)}`)].join("\n");
    const nombreMes = mes.nombre.charAt(0).toUpperCase() + mes.nombre.slice(1);
    grupo.setAttribute("aria-label", `${nombreMes}: ${mes.total === 0 ? "sin ingresos" : `${formatearDinero(mes.total)} en ${mes.cantidad} ${mes.cantidad === 1 ? "ingreso" : "ingresos"}`}`);
    grupo.append(svgEl("rect", { class: "g-zona", x: x0, y: margen.arriba - 16, width: banda, height: altoUtil + 16 }));

    let acumulado = 0;
    for (const fuente of mes.porFuente) {
      const yArriba = y(acumulado + fuente.total);
      const yAbajo = y(acumulado);
      grupo.append(svgEl("rect", {
        class: "g-segmento", x, y: yArriba, width: anchoColumna, height: Math.max(1, yAbajo - yArriba),
        style: `fill: var(--cat-${fuente.color})`
      }));
      acumulado += fuente.total;
    }
    if (mes.total > 0) {
      const t = svgEl("text", { class: "g-total-mes", x: x0 + banda / 2, y: y(mes.total) - 5, "text-anchor": "middle" });
      t.textContent = formatearDineroCorto(mes.total);
      grupo.append(t);
    }
    conectarTooltip(grupo, nombreMes, detalle);
    svg.append(grupo);

    const etiqueta = svgEl("text", { class: "g-texto", x: x0 + banda / 2, y: alto - 6, "text-anchor": "middle" });
    etiqueta.textContent = i === meses.length - 1 ? `${mes.etiqueta} (hoy)` : mes.etiqueta;
    svg.append(etiqueta);
  });
  contenedor.append(svg);
}
