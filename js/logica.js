/*
 * logica.js — Reglas del negocio (sin HTML y sin almacenamiento).
 *
 * Este archivo NO usa document ni localStorage: solo recibe datos y devuelve
 * resultados. Por eso se puede probar solo (con Node) y cambiar sin romper la
 * interfaz. Se llama "separación de responsabilidades".
 *
 * Todas las fechas son texto "AAAA-MM-DD" en hora LOCAL (nunca toISOString, que
 * usa la hora de Londres y en Colombia da el día siguiente después de las 7 p. m.).
 */
"use strict";

// ============================================================
// 1. Categorías (ahora son EDITABLES: el usuario las crea, renombra y borra)
// ============================================================

/** Identificador de la categoría de respaldo. No se puede borrar. */
const ID_OTROS = "otros";

/** Número de colores de categoría (0-7) + el gris neutro (8). Los colores reales viven en el CSS. */
const COLOR_NEUTRO = 8;
const COLORES_CATEGORIA = 8;

/** Categorías con las que empieza cada cuenta nueva. `color` es el número de ranura (0-8). */
const CATEGORIAS_BASE = [
  { id: "comida",          nombre: "Comida",          emoji: "🍔", color: 1 },
  { id: "transporte",      nombre: "Transporte",      emoji: "🚌", color: 0 },
  { id: "estudio",         nombre: "Estudio",         emoji: "📚", color: 6 },
  { id: "entretenimiento", nombre: "Entretenimiento", emoji: "🎮", color: 4 },
  { id: "servicios",       nombre: "Servicios",       emoji: "💡", color: 3 },
  { id: "salud",           nombre: "Salud",           emoji: "💊", color: 2 },
  { id: ID_OTROS,          nombre: "Otros",           emoji: "📦", color: COLOR_NEUTRO }
];

/** Fuentes de ingreso con las que empieza cada cuenta (editables por el usuario). */
const FUENTES_BASE = [
  { id: "salario",       nombre: "Salario",                emoji: "💼", color: 0 },
  { id: "mesada",        nombre: "Mesada",                 emoji: "🏠", color: 1 },
  { id: "independiente", nombre: "Trabajo independiente",  emoji: "🧰", color: 2 },
  { id: "ventas",        nombre: "Ventas",                 emoji: "🛍️", color: 3 },
  { id: "regalos",       nombre: "Regalos y apoyos",       emoji: "🎁", color: 4 },
  { id: ID_OTROS,        nombre: "Otros ingresos",         emoji: "📦", color: COLOR_NEUTRO }
];

/** Destinos de ahorro e inversión con los que empieza cada cuenta (editables). */
const DESTINOS_BASE = [
  { id: "ahorro",     nombre: "Ahorro general",          emoji: "🐷", color: 2 },
  { id: "emergencia", nombre: "Fondo de emergencia",     emoji: "🛟", color: 0 },
  { id: "meta",       nombre: "Meta o proyecto",         emoji: "🎯", color: 3 },
  { id: "cdt",        nombre: "CDT / inversión a plazo", emoji: "🏦", color: 6 },
  { id: "acciones",   nombre: "Acciones y fondos",       emoji: "📈", color: 5 },
  { id: ID_OTROS,     nombre: "Otros ahorros",           emoji: "📦", color: COLOR_NEUTRO }
];

/**
 * Los tres tipos de movimiento. Cada uno tiene su lista de registros y su propio
 * catálogo editable (categorías / fuentes / destinos). Todos los registros tienen la
 * misma forma: { id, categoria, monto, descripcion, fecha }.
 */
const TIPOS = {
  gasto:   { nombre: "Gasto",   plural: "gastos",   catalogo: "categorias", registros: "gastos",   campo: "Categoría",           errorCatalogo: "Elige una categoría." },
  ingreso: { nombre: "Ingreso", plural: "ingresos", catalogo: "fuentes",    registros: "ingresos", campo: "Fuente de ingreso",   errorCatalogo: "Elige una fuente de ingreso." },
  ahorro:  { nombre: "Ahorro",  plural: "ahorros",  catalogo: "destinos",   registros: "ahorros",  campo: "Destino del ahorro",  errorCatalogo: "Elige un destino del ahorro." }
};
const ORDEN_TIPOS = ["gasto", "ingreso", "ahorro"];

const LARGO_MAXIMO_CATEGORIA = 24;
const MAXIMO_CATEGORIAS = 30;
const MONTO_MAXIMO = 100000000; // 100 millones: evita errores de digitación absurdos
const LARGO_MAXIMO_DESCRIPCION = 60;

/** Copia nueva de las categorías base (para no modificar la constante por accidente). */
function categoriasIniciales() {
  return CATEGORIAS_BASE.map((c) => ({ ...c }));
}

/** Catálogos iniciales de las tres clases de movimiento. */
function catalogosIniciales() {
  return {
    categorias: categoriasIniciales(),
    fuentes: FUENTES_BASE.map((c) => ({ ...c })),
    destinos: DESTINOS_BASE.map((c) => ({ ...c }))
  };
}

/** Minúsculas y sin tildes: "Café" y "cafe" cuentan como el mismo nombre. */
function normalizarTexto(texto) {
  return String(texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Busca una categoría por id. */
function buscarCategoria(categorias, id) {
  return categorias.find((c) => c.id === id);
}

/**
 * Primer color libre (0-7). Si ya se usaron todos, empieza otra vez desde el 0:
 * repetir color no es grave porque cada barra siempre lleva su nombre escrito.
 */
function siguienteColorLibre(categorias) {
  const usados = new Set(categorias.map((c) => c.color));
  for (let i = 0; i < COLORES_CATEGORIA; i++) {
    if (!usados.has(i)) return i;
  }
  return 0;
}

/**
 * Valida los datos de una categoría. `idActual` es el id de la que se está editando
 * (para que no choque consigo misma); es null al crear una nueva.
 * Devuelve "" si todo está bien, o un mensaje de error.
 */
function validarCategoria(datos, categorias, idActual = null) {
  const nombre = String(datos.nombre ?? "").trim();
  if (nombre === "") return "Escribe el nombre de la categoría.";
  if (nombre.length > LARGO_MAXIMO_CATEGORIA) {
    return `El nombre no puede pasar de ${LARGO_MAXIMO_CATEGORIA} caracteres.`;
  }
  const repetida = categorias.some(
    (c) => c.id !== idActual && normalizarTexto(c.nombre) === normalizarTexto(nombre)
  );
  if (repetida) return "Ya existe una categoría con ese nombre.";

  const emoji = String(datos.emoji ?? "").trim();
  if ([...emoji].length > 6) return "El ícono debe ser un solo emoji.";

  // Number("") vale 0: sin esta comprobación un color vacío pasaría como "azul"
  const color = String(datos.color ?? "").trim() === "" ? NaN : Number(datos.color);
  if (!Number.isInteger(color) || color < 0 || color > COLOR_NEUTRO) return "Elige un color.";

  if (idActual === null && categorias.length >= MAXIMO_CATEGORIAS) {
    return `Puedes tener hasta ${MAXIMO_CATEGORIAS} categorías.`;
  }
  return "";
}

/** Crea una categoría nueva (ya validada). */
function crearCategoria(datos) {
  return {
    id: "c" + generarId(),
    nombre: String(datos.nombre).trim(),
    emoji: String(datos.emoji ?? "").trim() || "🏷️",
    color: Number(datos.color)
  };
}

/** Devuelve la lista con la categoría `id` actualizada (sin modificar la original). */
function actualizarCategoria(categorias, id, datos) {
  return categorias.map((c) =>
    c.id === id
      ? { ...c, nombre: String(datos.nombre).trim(), emoji: String(datos.emoji ?? "").trim() || c.emoji, color: Number(datos.color) }
      : c
  );
}

/**
 * Elimina una categoría. Sus gastos NO se pierden: pasan a "Otros".
 * Devuelve { categorias, gastos, movidos } o null si no se puede (ej. "Otros").
 */
function eliminarCategoria(categorias, gastos, id) {
  if (id === ID_OTROS || !buscarCategoria(categorias, id)) return null;
  let movidos = 0;
  const nuevosGastos = gastos.map((g) => {
    if (g.categoria !== id) return g;
    movidos++;
    return { ...g, categoria: ID_OTROS };
  });
  return { categorias: categorias.filter((c) => c.id !== id), gastos: nuevosGastos, movidos };
}

// ============================================================
// 2. Fechas
// ============================================================

/** Date -> "AAAA-MM-DD" con la hora local. */
function aFechaTexto(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0"); // getMonth() va de 0 a 11
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** "AAAA-MM-DD" -> Date local a mediodía (evita saltos por cambio de horario). */
function aFecha(fechaTexto) {
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  return new Date(anio, mes - 1, dia, 12);
}

/** Fecha de hoy en formato texto. */
function fechaDeHoy() {
  return aFechaTexto(new Date());
}

/** ¿Es una fecha real? "2026-02-31" tiene el formato correcto pero NO existe. */
function esFechaReal(fechaTexto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto ?? "")) return false;
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  if (anio < 1900) return false;
  const fecha = new Date(anio, mes - 1, dia, 12);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
}

/** Suma (o resta) días. JavaScript corrige solo los desbordes entre meses. */
function sumarDias(fechaTexto, cantidad) {
  const fecha = aFecha(fechaTexto);
  fecha.setDate(fecha.getDate() + cantidad);
  return aFechaTexto(fecha);
}

/** Mes anterior de "AAAA-MM-DD" -> "AAAA-MM". */
function mesAnterior(fechaTexto) {
  const [anio, mes] = fechaTexto.split("-").map(Number);
  const fecha = new Date(anio, mes - 2, 1, 12);
  return aFechaTexto(fecha).slice(0, 7);
}

/** Saludo según la hora (0-23). */
function saludoSegunHora(hora) {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

const formatoFechaLarga = new Intl.DateTimeFormat("es-CO", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});

/** "domingo, 11 de octubre de 2026" con la primera letra en mayúscula. */
function fechaLarga(fecha = new Date()) {
  const texto = formatoFechaLarga.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Partes sueltas para el panel grande de la ventana inicial. */
function partesDeFecha(fecha = new Date()) {
  return {
    numero: String(fecha.getDate()),
    diaSemana: fecha.toLocaleDateString("es-CO", { weekday: "long" }),
    mesAnio: fecha.toLocaleDateString("es-CO", { month: "long", year: "numeric" })
  };
}

/** "2026-10-10" -> "10 oct 2026". */
function formatearFecha(fechaTexto) {
  // El navegador devuelve "10 de oct de 2026"; se acorta a "10 oct 2026"
  return aFecha(fechaTexto).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(/ de /g, " ");
}

/** "2026-10-10" -> "10 oct" (para los ejes de los gráficos). */
function formatearFechaCorta(fechaTexto) {
  // El navegador devuelve "10 de oct"; para un eje de gráfico basta "10 oct"
  return aFecha(fechaTexto).toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(" de ", " ");
}

// ============================================================
// 3. Gastos
// ============================================================

/** Genera un identificador único y sencillo. */
function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Revisa los datos de un gasto, en el mismo orden del formulario:
 * categoría, monto, descripción y fecha. Devuelve "" si está bien.
 */
function validarGasto(datos, categorias, hoy = fechaDeHoy(), tipo = "gasto") {
  if (!buscarCategoria(categorias, datos.categoria)) {
    return TIPOS[tipo].errorCatalogo;
  }
  const monto = Number(datos.monto);
  if (String(datos.monto ?? "").trim() === "" || !Number.isFinite(monto) || monto <= 0) {
    return "El monto debe ser un número mayor que cero.";
  }
  if (monto > MONTO_MAXIMO) {
    return "El monto es demasiado grande. Revisa si escribiste ceros de más.";
  }
  const descripcion = String(datos.descripcion ?? "").trim();
  if (descripcion === "") {
    return "Escribe una descripción.";
  }
  if (descripcion.length > LARGO_MAXIMO_DESCRIPCION) {
    return `La descripción no puede pasar de ${LARGO_MAXIMO_DESCRIPCION} caracteres.`;
  }
  if (!esFechaReal(datos.fecha)) {
    return "Elige una fecha válida.";
  }
  // Las fechas "AAAA-MM-DD" se comparan como texto: "2026-10-11" > "2026-10-10"
  if (datos.fecha > hoy) {
    return "La fecha no puede ser futura.";
  }
  return "";
}

/** Crea el gasto que se guarda (ya validado). */
function crearGasto(datos) {
  return {
    id: generarId(),
    categoria: datos.categoria,
    monto: Math.round(Number(datos.monto)),
    descripcion: String(datos.descripcion).trim(),
    fecha: datos.fecha
  };
}

/**
 * Limpia gastos leídos del almacenamiento SIN perder datos por detalles menores
 * (la versión anterior descartaba un gasto entero si su categoría ya no existía).
 * Arregla lo arreglable y solo descarta lo que no tiene arreglo (monto o fecha rotos).
 * Devuelve { gastos, descartados }.
 */
function limpiarGastos(lista, categorias) {
  const resultado = [];
  let descartados = 0;
  const idsUsados = new Set();
  for (const g of Array.isArray(lista) ? lista : []) {
    const monto = Math.round(Number(g?.monto));
    if (!g || !Number.isFinite(monto) || monto <= 0 || !esFechaReal(g.fecha)) {
      descartados++;
      continue;
    }
    let id = typeof g.id === "string" && g.id !== "" ? g.id : generarId();
    if (idsUsados.has(id)) id = generarId();
    idsUsados.add(id);
    const descripcion = String(g.descripcion ?? "").trim().slice(0, LARGO_MAXIMO_DESCRIPCION);
    resultado.push({
      id,
      categoria: buscarCategoria(categorias, g.categoria) ? g.categoria : ID_OTROS,
      monto: Math.min(monto, MONTO_MAXIMO),
      descripcion: descripcion || "(sin descripción)",
      fecha: g.fecha
    });
  }
  return { gastos: resultado, descartados };
}

/** Limpia categorías leídas del almacenamiento y garantiza que exista "Otros". */
function limpiarCategorias(lista) {
  const vistos = new Set();
  const resultado = [];
  for (const c of Array.isArray(lista) ? lista : []) {
    if (!c || typeof c.id !== "string" || vistos.has(c.id)) continue;
    const nombre = String(c.nombre ?? "").trim().slice(0, LARGO_MAXIMO_CATEGORIA);
    if (nombre === "") continue;
    const color = Number.isInteger(c.color) && c.color >= 0 && c.color <= COLOR_NEUTRO ? c.color : COLOR_NEUTRO;
    vistos.add(c.id);
    resultado.push({ id: c.id, nombre, emoji: String(c.emoji ?? "").trim() || "🏷️", color });
  }
  if (!vistos.has(ID_OTROS)) {
    resultado.push({ id: ID_OTROS, nombre: "Otros", emoji: "📦", color: COLOR_NEUTRO });
  }
  return resultado;
}

/** Devuelve una COPIA ordenada de la más reciente a la más antigua. */
function ordenarPorFecha(gastos) {
  return [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
}

/** Filtra por categoría. "todas" devuelve la lista completa. */
function filtrarPorCategoria(gastos, categoria) {
  if (categoria === "todas") return gastos;
  return gastos.filter((g) => g.categoria === categoria);
}

// ============================================================
// 4. Cálculos para los indicadores y gráficos
// ============================================================

/** Suma los montos de una lista de gastos. */
function calcularTotal(gastos) {
  return gastos.reduce((suma, g) => suma + g.monto, 0);
}

/** Gastos cuya fecha está entre `desde` y `hasta` (ambas incluidas). */
function gastosEntre(gastos, desde, hasta) {
  return gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta);
}

/** Suma solo los gastos del mismo mes y año que la fecha de referencia. */
function totalDelMes(gastos, fechaReferencia) {
  const mes = fechaReferencia.slice(0, 7);
  return calcularTotal(gastos.filter((g) => g.fecha.slice(0, 7) === mes));
}

/**
 * GRÁFICO 1 — ranking de categorías de mayor a menor gasto.
 * Devuelve [{ id, nombre, emoji, color, total, cantidad, porcentaje }].
 * Solo incluye categorías con gastos.
 */
function rankingCategorias(gastos, categorias) {
  const acumulado = new Map();
  for (const g of gastos) {
    const actual = acumulado.get(g.categoria) ?? { total: 0, cantidad: 0 };
    actual.total += g.monto;
    actual.cantidad += 1;
    acumulado.set(g.categoria, actual);
  }
  const suma = calcularTotal(gastos);
  return [...acumulado.entries()]
    .map(([id, datos]) => {
      const cat = buscarCategoria(categorias, id) ?? buscarCategoria(categorias, ID_OTROS) ??
        { nombre: "Otros", emoji: "📦", color: COLOR_NEUTRO };
      return {
        id,
        nombre: cat.nombre,
        emoji: cat.emoji,
        color: cat.color,
        total: datos.total,
        cantidad: datos.cantidad,
        porcentaje: suma > 0 ? (datos.total / suma) * 100 : 0
      };
    })
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * GRÁFICO 2 — gasto de cada uno de los últimos `dias` días (incluido hoy).
 * Los días sin gastos aparecen con total 0 para que el eje del tiempo sea continuo.
 */
function totalesPorDia(gastos, hoy, dias = 30) {
  const inicio = sumarDias(hoy, -(dias - 1));
  const mapa = new Map();
  for (const g of gastosEntre(gastos, inicio, hoy)) {
    const actual = mapa.get(g.fecha) ?? { total: 0, cantidad: 0 };
    actual.total += g.monto;
    actual.cantidad += 1;
    mapa.set(g.fecha, actual);
  }
  const lista = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(inicio, i);
    const d = mapa.get(fecha) ?? { total: 0, cantidad: 0 };
    lista.push({ fecha, total: d.total, cantidad: d.cantidad });
  }
  return lista;
}

/**
 * GRÁFICO 3 — resumen del mes en curso.
 * Compara "este mes" con "el mes anterior HASTA EL MISMO DÍA" (si hoy es 11, se
 * compara con los primeros 11 días del mes pasado). Comparar un mes a medias con
 * uno completo daría siempre una bajada engañosa.
 */
function resumenMes(gastos, hoy) {
  const mesActual = hoy.slice(0, 7);
  const diaDelMes = Number(hoy.slice(8, 10));
  const mesPrevio = mesAnterior(hoy);

  const delMes = gastos.filter((g) => g.fecha.slice(0, 7) === mesActual && g.fecha <= hoy);
  const delPrevio = gastos.filter((g) => g.fecha.slice(0, 7) === mesPrevio);
  const previoMismosDias = delPrevio.filter((g) => Number(g.fecha.slice(8, 10)) <= diaDelMes);

  const total = calcularTotal(delMes);
  const totalPrevio = calcularTotal(previoMismosDias);
  const mayor = delMes.reduce((m, g) => (m === null || g.monto > m.monto ? g : m), null);

  return {
    total,
    cantidad: delMes.length,
    promedioDiario: Math.round(total / diaDelMes),
    mayor,
    diaDelMes,
    totalPrevio,
    totalPrevioCompleto: calcularTotal(delPrevio),
    variacion: totalPrevio > 0 ? Math.round(((total - totalPrevio) / totalPrevio) * 100) : null
  };
}

// ============================================================
// 5. Formato
// ============================================================

const formatoDinero = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0
});

/** 15000 -> "$ 15.000" (formato colombiano). */
function formatearDinero(valor) {
  return formatoDinero.format(valor);
}

/** Para ejes de gráficos: 1500000 -> "1,5 M", 50000 -> "50 mil", 800 -> "800". */
function formatearDineroCorto(valor) {
  const redondear = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  if (valor >= 1000000) return `${redondear(valor / 1000000)} M`;
  if (valor >= 1000) return `${redondear(valor / 1000)} mil`;
  return String(Math.round(valor));
}

// ============================================================
// 5b. Leer recibos (texto del OCR -> datos del gasto) y compartir por WhatsApp
// ============================================================

const MESES_ABREVIADOS = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 };

/** Palabras que delatan la categoría de un recibo. Solo se usan si esa categoría existe. */
const PALABRAS_CATEGORIA = {
  comida: ["restaurante", "almuerzo", "desayuno", "cena", "exito", "carulla", "jumbo", "olimpica", "ara ", "d1", "panaderia", "cafe", "pizza", "hamburguesa", "supermercado", "mercado", "frisby", "kfc", "mcdonald", "crepes", "heladeria"],
  transporte: ["taxi", "uber", "didi", "cabify", "gasolina", "terpel", "primax", "peaje", "transmilenio", "metro", "bus ", "parqueadero"],
  salud: ["drogueria", "farmacia", "cruz verde", "farmatodo", "locatel", "clinica", "laboratorio", "consulta medica", "eps"],
  estudio: ["papeleria", "libreria", "universidad", "colegio", "fotocopia", "copias", "matricula", "panamericana"],
  entretenimiento: ["cine", "cinemark", "cinecolombia", "netflix", "spotify", "disney", "concierto", "boleta", "videojuego", "steam"],
  servicios: ["energia", "acueducto", "alcantarillado", "gas natural", "internet", "claro", "movistar", "tigo", "etb", "recibo", "factura de servicios"]
};

/**
 * Convierte "15.000", "15.000,00", "1,234.50" o "$ 15000" en número.
 * En Colombia el punto separa miles y la coma los decimales, pero los recibos mezclan formatos.
 * Devuelve null si no es un número.
 */
function interpretarNumero(texto) {
  let t = String(texto ?? "").replace(/[^\d.,]/g, "");
  if (!/\d/.test(t)) return null;
  const punto = t.lastIndexOf("."), coma = t.lastIndexOf(",");
  if (punto !== -1 && coma !== -1) {
    // Los dos símbolos: el que aparece de último es el decimal
    const decimal = punto > coma ? "." : ",";
    const miles = decimal === "." ? "," : ".";
    t = t.split(miles).join("").replace(decimal, ".");
  } else if (punto !== -1 || coma !== -1) {
    const sep = punto !== -1 ? "." : ",";
    const partes = t.split(sep);
    // "15.000" o "1.234.567" son miles; "15,5" o "15.50" son decimales
    const esMiles = partes.length > 2 || partes[1].length === 3;
    t = esMiles ? partes.join("") : `${partes[0]}.${partes[1]}`;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Montos plausibles de una línea de texto (entre 100 y el máximo permitido). */
function montosDeLinea(lineaOriginal) {
  // Se quitan las fechas ("11/10/2026") para que sus números no se lean como dinero
  const linea = lineaOriginal.replace(/\b\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g, " ");
  const montos = [];
  for (const m of linea.matchAll(/\d[\d.,]*\d|\d/g)) {
    const ficha = m[0];
    if (ficha.replace(/\D/g, "").length > 9) continue; // NIT, teléfonos, códigos de barras
    const valor = interpretarNumero(ficha);
    if (valor !== null && valor >= 100 && valor <= MONTO_MAXIMO) {
      montos.push({ valor: Math.round(valor), conSeparador: /[.,]/.test(ficha), conSimbolo: /\$/.test(linea.slice(Math.max(0, m.index - 2), m.index)) });
    }
  }
  return montos;
}

/** Busca el monto total del recibo. Devuelve { valor, origen } o null. */
function buscarMontoTotal(texto) {
  const lineas = String(texto ?? "").split(/\r?\n/);
  const esTotal = /\b(total|a pagar|neto)\b/i;
  const noEsTotal = /sub\s*-?\s*total|iva|impuesto|descuento|cambio|propina|items|articulos|cantidad/i;

  const candidatos = [];
  for (const linea of lineas) {
    if (esTotal.test(linea) && !noEsTotal.test(linea)) candidatos.push(...montosDeLinea(linea));
  }
  if (candidatos.length > 0) {
    return { valor: Math.max(...candidatos.map((c) => c.valor)), origen: "total" };
  }
  // Sin línea de "total": el monto mayor que parezca dinero (con separador de miles o con $)
  const ruido = /\b(nit|tel|cel|nro|factura|resoluci|autoriz|tarjeta|fecha|hora|caja|ref|cufe)\b/i;
  const todos = [];
  for (const linea of lineas) {
    if (ruido.test(linea)) continue;
    todos.push(...montosDeLinea(linea).filter((c) => c.conSeparador || c.conSimbolo));
  }
  return todos.length > 0 ? { valor: Math.max(...todos.map((c) => c.valor)), origen: "mayor" } : null;
}

/** Busca la primera fecha válida y no futura. Devuelve "AAAA-MM-DD" o null. */
function buscarFecha(texto, hoy = fechaDeHoy()) {
  const t = String(texto ?? "");
  const candidatas = [];
  for (const m of t.matchAll(/\b(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/g)) candidatas.push([+m[1], +m[2], +m[3]]);
  for (const m of t.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/g)) {
    candidatas.push([m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]]); // en Colombia: día/mes/año
  }
  for (const m of t.matchAll(/\b(\d{1,2})\s*(?:de\s*)?([A-Za-záéíóúÁÉÍÓÚ]{3,10})\.?\s*(?:de\s*)?(\d{4})\b/g)) {
    const mes = MESES_ABREVIADOS[normalizarTexto(m[2]).slice(0, 4) === "sept" ? "sept" : normalizarTexto(m[2]).slice(0, 3)];
    if (mes) candidatas.push([+m[3], mes, +m[1]]);
  }
  for (const [anio, mes, dia] of candidatas) {
    const f = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (anio >= 2000 && esFechaReal(f) && f <= hoy) return f;
  }
  return null;
}

/** Nombre del comercio: la primera línea que parezca un nombre (no NIT, teléfono ni dirección). */
function buscarComercio(texto) {
  const ruido = /\b(nit|tel|cel|factura|resoluci|regimen|direccion|cra|calle|carrera|www|http|fecha|hora|caja|cliente|vendedor)\b|@|\d{4,}/i;
  const lineas = String(texto ?? "").split(/\r?\n/).slice(0, 10);
  for (const original of lineas) {
    const limpia = original.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 &.'-]/g, " ").replace(/\s+/g, " ").trim();
    if ((limpia.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) ?? []).length < 3) continue;
    if (ruido.test(normalizarTexto(original)) || ruido.test(original)) continue;
    const nombre = limpia === limpia.toUpperCase()
      ? limpia.toLowerCase().replace(/(^|[\s.])\S/g, (c) => c.toUpperCase())
      : limpia;
    return nombre.slice(0, LARGO_MAXIMO_DESCRIPCION);
  }
  return "";
}

const PALABRAS_INGRESO = {
  salario: ["salario", "sueldo", "nomina", "quincena"],
  mesada: ["mesada", "mis papas", "mi mama", "mi papa"],
  independiente: ["freelance", "honorarios", "proyecto", "cliente", "trabajo independiente"],
  ventas: ["vendi", "venta", "ventas"],
  regalos: ["regalo", "cumpleanos", "apoyo", "subsidio", "prima", "bono"]
};

const PALABRAS_AHORRO = {
  emergencia: ["emergencia", "imprevistos"],
  meta: ["meta", "viaje", "proyecto"],
  cdt: ["cdt", "a plazo", "plazo fijo"],
  acciones: ["accion", "acciones", "bolsa", "etf", "cripto", "bitcoin", "fondo de inversion"],
  ahorro: ["alcancia", "ahorro general"]
};

const PALABRAS_POR_TIPO = { gasto: PALABRAS_CATEGORIA, ingreso: PALABRAS_INGRESO, ahorro: PALABRAS_AHORRO };

/**
 * Sugiere una opción del catálogo (id) según las palabras del texto. Solo devuelve opciones que existen.
 * Primero busca el NOMBRE de una opción (incluidas las que creó el usuario) y luego palabras clave.
 */
function sugerirCategoria(texto, categorias, tipo = "gasto") {
  const t = ` ${normalizarTexto(texto)} `;
  const idsBase = new Set([...CATEGORIAS_BASE, ...FUENTES_BASE, ...DESTINOS_BASE].map((c) => c.id));
  // Las opciones creadas por el usuario van primero: son más específicas ("comida para mascotas" -> Mascotas)
  const ordenadas = [...categorias.filter((c) => !idsBase.has(c.id)), ...categorias.filter((c) => idsBase.has(c.id))];
  for (const c of ordenadas) {
    const nombre = normalizarTexto(c.nombre);
    if (c.id !== ID_OTROS && nombre.length >= 4 && t.includes(` ${nombre} `)) return c.id;
  }
  for (const c of ordenadas) {
    const nombre = normalizarTexto(c.nombre);
    if (c.id !== ID_OTROS && nombre.length >= 4 && t.includes(nombre)) return c.id;
  }
  for (const [id, palabras] of Object.entries(PALABRAS_POR_TIPO[tipo] ?? {})) {
    if (!buscarCategoria(categorias, id)) continue;
    if (palabras.some((p) => t.includes(p.length <= 3 ? ` ${p} ` : p))) return id;
  }
  return null;
}

/** Del texto crudo del OCR a los datos que se proponen en el formulario (el usuario siempre los revisa). */
function parsearRecibo(texto, categorias, hoy = fechaDeHoy(), tipo = "gasto") {
  const total = buscarMontoTotal(texto);
  return {
    monto: total ? total.valor : null,
    origenMonto: total ? total.origen : null,
    fecha: buscarFecha(texto, hoy),
    descripcion: buscarComercio(texto),
    categoria: sugerirCategoria(texto, categorias, tipo)
  };
}

/** Texto del resumen mensual para enviar por WhatsApp (el usuario lo ve y lo puede editar antes). */
function textoResumenWhatsApp({ nombre, hoy, resumen, ranking, formatoDinero, finanzas = null }) {
  const mes = aFecha(hoy).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const lineas = [`📊 Mi resumen de ${mes} (1–${resumen.diaDelMes})`];
  if (finanzas) {
    lineas.push(`Ingresos: ${formatoDinero(finanzas.ingresos)}`);
    lineas.push(`Gastos: ${formatoDinero(finanzas.gastos)} en ${resumen.cantidad} ${resumen.cantidad === 1 ? "gasto" : "gastos"}`);
    lineas.push(`Ahorro e inversión: ${formatoDinero(finanzas.ahorros)}`);
    lineas.push(`Balance del mes: ${finanzas.balance < 0 ? "−" : ""}${formatoDinero(Math.abs(finanzas.balance))}${finanzas.balance < 0 ? " (gasté más de lo que entró)" : ""}`);
  } else {
    lineas.push(`Total del mes: ${formatoDinero(resumen.total)} en ${resumen.cantidad} ${resumen.cantidad === 1 ? "gasto" : "gastos"}`);
  }
  if (resumen.cantidad > 0) {
    lineas.push("", `Promedio de gasto por día: ${formatoDinero(resumen.promedioDiario)}`);
    if (ranking.length > 0) lineas.push(`Donde más gasto: ${ranking[0].nombre} (${formatoDinero(ranking[0].total)})`);
    if (resumen.mayor) lineas.push(`Gasto más grande: ${formatoDinero(resumen.mayor.monto)} (${resumen.mayor.descripcion})`);
  }
  if (resumen.variacion !== null && resumen.variacion !== 0) {
    lineas.push(`${resumen.variacion > 0 ? "▲" : "▼"} ${Math.abs(resumen.variacion)} % ${resumen.variacion > 0 ? "más" : "menos"} gasto que el mes pasado (mismos días)`);
  }
  lineas.push("", `— ${nombre}, con Registro de Gastos`);
  return lineas.join("\n");
}

// ============================================================
// 5c. Ingresos, ahorros y balance
// ============================================================

/** Totales del mes en curso de los tres tipos y el balance (ingresos − gastos − ahorro). */
function totalesFinancieros(estado, hoy) {
  const inicio = `${hoy.slice(0, 7)}-01`;
  const sumar = (lista) => calcularTotal(gastosEntre(lista ?? [], inicio, hoy));
  const ingresos = sumar(estado.ingresos);
  const gastos = sumar(estado.gastos);
  const ahorros = sumar(estado.ahorros);
  return { ingresos, gastos, ahorros, balance: ingresos - gastos - ahorros, ahorradoTotal: calcularTotal(estado.ahorros ?? []) };
}

/** Lista de los últimos `n` meses ("AAAA-MM"), del más antiguo al actual. */
function listaDeMeses(hoy, n = 6) {
  const [anio, mes] = hoy.split("-").map(Number);
  const meses = [];
  for (let i = n - 1; i >= 0; i--) {
    meses.push(aFechaTexto(new Date(anio, mes - 1 - i, 1, 12)).slice(0, 7));
  }
  return meses;
}

/** "2026-10" -> "octubre de 2026". */
function nombreDelMes(mes) {
  return aFecha(`${mes}-01`).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

/**
 * GRÁFICO DE INGRESOS — total de cada uno de los últimos `n` meses, separado por fuente.
 * Devuelve [{ mes, etiqueta, nombre, total, cantidad, porFuente: [{ id, nombre, emoji, color, total }] }].
 */
function ingresosPorMes(ingresos, fuentes, hoy, n = 6) {
  return listaDeMeses(hoy, n).map((mes) => {
    const delMes = ingresos.filter((g) => g.fecha.slice(0, 7) === mes && g.fecha <= hoy);
    const porFuente = fuentes
      .map((f) => ({ id: f.id, nombre: f.nombre, emoji: f.emoji, color: f.color, total: calcularTotal(delMes.filter((g) => g.categoria === f.id)) }))
      .filter((f) => f.total > 0);
    return {
      mes,
      etiqueta: aFecha(`${mes}-01`).toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
      nombre: nombreDelMes(mes),
      total: calcularTotal(delMes),
      cantidad: delMes.length,
      porFuente
    };
  });
}

// ============================================================
// 5d. Dictado: de una frase ("gasté quince mil en almuerzo ayer") a los datos del movimiento
// ============================================================
// Sirve igual para lo que se dicta con el micrófono, lo que se escribe o lo que se pega
// (por ejemplo, un mensaje copiado de WhatsApp). Solo PROPONE datos: la persona revisa.

const NUMEROS_UNIDAD = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29
};
const NUMEROS_DECENA = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const NUMEROS_CENTENA = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400,
  cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700,
  setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900
};
const MULTIPLICADORES_MIL = ["mil", "luca", "lucas"];          // "veinte lucas" = 20.000 (jerga colombiana)
const MULTIPLICADORES_MILLON = ["millon", "millones", "palo", "palos"]; // "un palo" = 1.000.000

const MESES_NOMBRES = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6,
  julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12
};

const PALABRAS_SUELTAS = new Set([
  "en", "por", "de", "del", "para", "a", "al", "el", "la", "los", "las", "un", "una", "mi", "mis", "con", "que", "y",
  "pesos", "peso", "cop", "plata", "dinero", "hoy", "ayer", "anteayer", "antier", "anoche", "esta", "este", "mas",
  "me", "se", "lo", "fue", "fueron", "es", "son", "como", "ya"
]);
const VERBOS_MOVIMIENTO = new Set([
  "gaste", "gasto", "pague", "pagar", "compre", "comprar", "recibi", "recibo", "cobre", "gane", "pagaron", "pago",
  "consignaron", "depositaron", "transfirieron", "dieron", "vendi", "ahorre", "ahorro", "inverti", "invierto",
  "separe", "meti", "puse", "registra", "registrar", "anota", "anotar", "agrega", "agregar", "quiero", "necesito"
]);

function sinTildes(texto) {
  return String(texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function esFichaNumerica(n, siguiente) {
  if (/^\$?\d[\d.,]*k?$/.test(n)) return true;
  if (Object.hasOwn(NUMEROS_UNIDAD, n) || Object.hasOwn(NUMEROS_DECENA, n) || Object.hasOwn(NUMEROS_CENTENA, n)) return true;
  if (MULTIPLICADORES_MIL.includes(n) || MULTIPLICADORES_MILLON.includes(n)) return true;
  return n === "medio" && siguiente === "millon";
}

/** Valor de una tanda de palabras de número: "quince mil quinientos" -> 15500, "2 millones" -> 2000000. */
function valorDeNumeros(fichas) {
  let total = 0, actual = 0;
  for (const f of fichas) {
    if (f === "y") continue;
    if (/^\$?\d/.test(f)) {
      const limpia = f.replace(/^\$/, "");
      if (limpia.endsWith("k")) actual += (interpretarNumero(limpia.slice(0, -1)) ?? 0) * 1000;
      else actual += interpretarNumero(limpia) ?? 0;
    } else if (Object.hasOwn(NUMEROS_UNIDAD, f)) actual += NUMEROS_UNIDAD[f];
    else if (Object.hasOwn(NUMEROS_DECENA, f)) actual += NUMEROS_DECENA[f];
    else if (Object.hasOwn(NUMEROS_CENTENA, f)) actual += NUMEROS_CENTENA[f];
    else if (f === "medio") actual += 0.5;
    else if (MULTIPLICADORES_MIL.includes(f)) { total += (actual || 1) * 1000; actual = 0; }
    else if (MULTIPLICADORES_MILLON.includes(f)) { total += (actual || 1) * 1000000; actual = 0; }
  }
  return Math.round(total + actual);
}

/** Qué clase de movimiento es: gana el verbo que aparece primero ("gasté lo que había ahorrado" es un gasto). */
function detectarTipo(textoNormalizado, porDefecto = "gasto") {
  const reglas = {
    gasto: /\b(gast\w*|pague|pagar|compre|comprar|me cobraron|costo|cuesta)\b/,
    ingreso: /\b(recibi|cobre|gane|ingreso\w*|me pagaron|me pago|me consignaron|me depositaron|me transfirieron|me dieron|vendi|sueldo|salario|mesada|quincena|honorarios)\b/,
    ahorro: /\b(ahorr\w*|invert\w*|inversion\w*|alcancia|cdt|separe)\b/
  };
  let mejor = porDefecto, posicion = Infinity;
  for (const [tipo, regla] of Object.entries(reglas)) {
    const m = regla.exec(textoNormalizado);
    if (m && m.index < posicion) { mejor = tipo; posicion = m.index; }
  }
  return mejor;
}

/**
 * De una frase a { tipo, monto, fecha, categoria, descripcion }. `estado` trae los catálogos del usuario.
 * Cada dato que no se entiende queda en null o "": nunca se inventa.
 */
function parsearDictado(texto, estado, hoy = fechaDeHoy(), tipoPorDefecto = "gasto") {
  const original = String(texto ?? "").trim();
  const fichas = original.split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
  const norm = fichas.map((t) => sinTildes(t).replace(/^\$(?=\D)/, ""));
  const usada = new Array(fichas.length).fill(false);
  const tipo = detectarTipo(norm.join(" "), tipoPorDefecto);

  // ----- Fecha -----
  let fecha = null;
  for (let i = 0; i < norm.length && fecha === null; i++) {
    const n = norm[i];
    if (n === "hoy") { fecha = hoy; usada[i] = true; }
    else if (n === "ayer" || n === "anoche") { fecha = sumarDias(hoy, -1); usada[i] = true; }
    else if (n === "anteayer" || n === "antier") { fecha = sumarDias(hoy, -2); usada[i] = true; }
    else if (n === "hace" && i + 2 < norm.length + 0 && /^(dia|dias|semana|semanas)$/.test(norm[i + 2] ?? "")) {
      const cuantos = /^\d+$/.test(norm[i + 1]) ? Number(norm[i + 1]) : NUMEROS_UNIDAD[norm[i + 1]];
      if (cuantos !== undefined) {
        fecha = sumarDias(hoy, -cuantos * (norm[i + 2].startsWith("semana") ? 7 : 1));
        usada[i] = usada[i + 1] = usada[i + 2] = true;
      }
    } else if (/^\d{1,2}$/.test(n)) {
      // "5 de octubre" o "5 de octubre de 2026"
      let k = i + 1;
      if (norm[k] === "de") k++;
      const mes = MESES_NOMBRES[norm[k]];
      if (mes) {
        let anio = Number(hoy.slice(0, 4)), fin = k;
        if (norm[k + 1] === "de" && /^\d{4}$/.test(norm[k + 2] ?? "")) { anio = Number(norm[k + 2]); fin = k + 2; }
        else if (/^\d{4}$/.test(norm[k + 1] ?? "")) { anio = Number(norm[k + 1]); fin = k + 1; }
        let candidata = `${anio}-${String(mes).padStart(2, "0")}-${String(Number(n)).padStart(2, "0")}`;
        if (fin === k && candidata > hoy) candidata = `${anio - 1}${candidata.slice(4)}`; // sin año y en el futuro: fue el año pasado
        if (esFechaReal(candidata) && candidata <= hoy) {
          fecha = candidata;
          for (let u = i; u <= fin; u++) usada[u] = true;
        }
      }
    } else if (/^\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(n)) {
      const f = buscarFecha(n, hoy);
      if (f) { fecha = f; usada[i] = true; }
    }
  }

  // ----- Monto: la tanda de números más grande -----
  let mejor = null;
  for (let i = 0; i < norm.length; i++) {
    if (usada[i] || !esFichaNumerica(norm[i], norm[i + 1])) continue;
    let fin = i;
    while (fin + 1 < norm.length && !usada[fin + 1] &&
      (esFichaNumerica(norm[fin + 1], norm[fin + 2]) ||
        (norm[fin + 1] === "y" && fin + 2 < norm.length && esFichaNumerica(norm[fin + 2], norm[fin + 3])))) fin++;
    const valor = valorDeNumeros(norm.slice(i, fin + 1));
    if (valor >= 100 && valor <= MONTO_MAXIMO && (mejor === null || valor > mejor.valor)) mejor = { valor, inicio: i, fin };
    i = fin;
  }

  // ----- Descripción: lo que va después del monto ("en almuerzo"); si no hay, lo que va antes -----
  const limpiar = (lista) => {
    const palabras = lista.filter(([i]) => !usada[i]).map(([, t, n]) => [t, n]);
    while (palabras.length > 0 && (PALABRAS_SUELTAS.has(palabras[0][1]) || VERBOS_MOVIMIENTO.has(palabras[0][1]))) palabras.shift();
    return palabras.filter(([, n]) => !PALABRAS_SUELTAS.has(n) || n === "y").map(([t]) => t);
  };
  let descripcion = "";
  if (mejor) {
    const despues = limpiar(fichas.map((t, i) => [i, t, norm[i]]).slice(mejor.fin + 1));
    const antes = limpiar(fichas.map((t, i) => [i, t, norm[i]]).slice(0, mejor.inicio).filter(([, , n]) => !VERBOS_MOVIMIENTO.has(n)));
    descripcion = (despues.length > 0 ? despues : antes).slice(0, 8).join(" ");
  }
  descripcion = descripcion.charAt(0).toUpperCase() + descripcion.slice(1);

  const catalogo = estado[TIPOS[tipo].catalogo] ?? [];
  return {
    tipo,
    monto: mejor ? mejor.valor : null,
    fecha,
    descripcion: descripcion.slice(0, LARGO_MAXIMO_DESCRIPCION),
    categoria: sugerirCategoria(original, catalogo, tipo)
  };
}

// ============================================================
// 6. Usuario y perfil
// ============================================================

const LARGO_MINIMO_CONTRASENA = 8;
const REGLA_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Correo en minúsculas y sin espacios: así "Ana@x.com " y "ana@x.com" son la misma cuenta. */
function normalizarCorreo(correo) {
  return String(correo ?? "").trim().toLowerCase();
}

/** "" si la contraseña sirve, o el mensaje de qué le falta. */
function validarContrasena(contrasena) {
  const texto = String(contrasena ?? "");
  if (texto.length < LARGO_MINIMO_CONTRASENA) {
    return `La contraseña debe tener mínimo ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(texto) || !/\d/.test(texto)) {
    return "La contraseña debe combinar letras y números.";
  }
  return "";
}

/** Valida el formulario de "Crear cuenta". Devuelve "" si todo está bien. */
function validarRegistro(datos, usuarios) {
  if (String(datos.nombres ?? "").trim() === "") return "Escribe tu nombre.";
  if (String(datos.apellidos ?? "").trim() === "") return "Escribe tus apellidos.";
  const correo = normalizarCorreo(datos.correo);
  if (!REGLA_CORREO.test(correo)) return "Escribe un correo válido, por ejemplo nombre@correo.com.";
  if (usuarios.some((u) => u.correo === correo)) return "Ya existe una cuenta con ese correo. Prueba ingresando.";
  const errorClave = validarContrasena(datos.contrasena);
  if (errorClave) return errorClave;
  if (datos.contrasena !== datos.confirmar) return "Las contraseñas no coinciden.";
  return "";
}

/** Valida los datos personales del perfil. Los campos opcionales pueden ir vacíos. */
function validarPerfil(datos, hoy = fechaDeHoy()) {
  if (String(datos.nombres ?? "").trim() === "") return "El nombre no puede quedar vacío.";
  if (String(datos.nombres).trim().length > 60) return "El nombre es demasiado largo.";
  if (String(datos.apellidos ?? "").trim() === "") return "Los apellidos no pueden quedar vacíos.";
  if (String(datos.apellidos).trim().length > 60) return "Los apellidos son demasiado largos.";

  const telefono = String(datos.telefono ?? "").trim();
  if (telefono !== "") {
    const digitos = telefono.replace(/\D/g, "");
    if (!/^[+\d\s()-]+$/.test(telefono) || digitos.length < 7 || digitos.length > 15) {
      return "El teléfono debe tener entre 7 y 15 dígitos.";
    }
  }
  const nacimiento = String(datos.nacimiento ?? "").trim();
  if (nacimiento !== "") {
    if (!esFechaReal(nacimiento)) return "La fecha de nacimiento no es válida.";
    if (nacimiento >= hoy) return "La fecha de nacimiento debe ser anterior a hoy.";
  }
  if (String(datos.ciudad ?? "").trim().length > 60) return "La ciudad es demasiado larga.";
  if (String(datos.ocupacion ?? "").trim().length > 60) return "La ocupación es demasiado larga.";
  return "";
}

/** Letras para el avatar cuando no hay foto: "Daniel Palles" -> "DP". */
function iniciales(nombres, apellidos) {
  const a = [...String(nombres ?? "").trim()][0] ?? "";
  const b = [...String(apellidos ?? "").trim()][0] ?? "";
  return (a + b).toUpperCase() || "?";
}

// Permite probar este archivo con Node (npm test) sin afectar al navegador.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ID_OTROS, COLOR_NEUTRO, CATEGORIAS_BASE, categoriasIniciales, normalizarTexto, buscarCategoria,
    siguienteColorLibre, validarCategoria, crearCategoria, actualizarCategoria, eliminarCategoria,
    aFechaTexto, aFecha, fechaDeHoy, esFechaReal, sumarDias, mesAnterior, saludoSegunHora, fechaLarga,
    partesDeFecha, formatearFecha, formatearFechaCorta, validarGasto, crearGasto, limpiarGastos,
    limpiarCategorias, ordenarPorFecha, filtrarPorCategoria, calcularTotal, gastosEntre, totalDelMes,
    rankingCategorias, totalesPorDia, resumenMes, formatearDinero, formatearDineroCorto,
    FUENTES_BASE, DESTINOS_BASE, TIPOS, ORDEN_TIPOS, catalogosIniciales, totalesFinancieros, listaDeMeses, nombreDelMes,
    ingresosPorMes, valorDeNumeros, detectarTipo, parsearDictado, interpretarNumero, buscarMontoTotal, buscarFecha, buscarComercio, sugerirCategoria, parsearRecibo,
    textoResumenWhatsApp, normalizarCorreo, validarContrasena, validarRegistro, validarPerfil, iniciales
  };
}
