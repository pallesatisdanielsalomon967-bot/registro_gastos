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

const LARGO_MAXIMO_CATEGORIA = 24;
const MAXIMO_CATEGORIAS = 30;
const MONTO_MAXIMO = 100000000; // 100 millones: evita errores de digitación absurdos
const LARGO_MAXIMO_DESCRIPCION = 60;

/** Copia nueva de las categorías base (para no modificar la constante por accidente). */
function categoriasIniciales() {
  return CATEGORIAS_BASE.map((c) => ({ ...c }));
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
  return aFecha(fechaTexto).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
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
function validarGasto(datos, categorias, hoy = fechaDeHoy()) {
  if (!buscarCategoria(categorias, datos.categoria)) {
    return "Elige una categoría.";
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
    normalizarCorreo, validarContrasena, validarRegistro, validarPerfil, iniciales
  };
}
