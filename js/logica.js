/*
 * logica.js — Reglas del negocio del registro de gastos.
 *
 * Este archivo NO toca el HTML (no usa document). Solo recibe datos y devuelve
 * resultados. Separarlo así se llama "separación de responsabilidades": la lógica
 * se puede probar y cambiar sin romper la interfaz, y viceversa.
 */
"use strict";

// Única fuente de verdad de las categorías. Si quieres agregar una, solo la
// añades aquí y aparece sola en el formulario, el filtro y el gráfico.
const CATEGORIAS = {
  comida:          { nombre: "Comida",          emoji: "🍔", color: "#f97316" },
  transporte:      { nombre: "Transporte",      emoji: "🚌", color: "#3b82f6" },
  estudio:         { nombre: "Estudio",         emoji: "📚", color: "#8b5cf6" },
  entretenimiento: { nombre: "Entretenimiento", emoji: "🎮", color: "#ec4899" },
  servicios:       { nombre: "Servicios",       emoji: "💡", color: "#ca8a04" },
  salud:           { nombre: "Salud",           emoji: "💊", color: "#10b981" },
  otros:           { nombre: "Otros",           emoji: "📦", color: "#64748b" }
};

const MONTO_MAXIMO = 100000000; // 100 millones: evita errores de digitación absurdos
const LARGO_MAXIMO_DESCRIPCION = 60;

/**
 * Devuelve la fecha de HOY en formato "AAAA-MM-DD" usando la hora LOCAL.
 * Ojo: new Date().toISOString() usa la hora de Londres (UTC). En Colombia
 * (UTC-5), después de las 7:00 p. m. ya daría el día siguiente. Por eso
 * armamos la fecha a mano con getFullYear, getMonth y getDate.
 */
function fechaDeHoy() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0"); // getMonth() va de 0 a 11
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * Revisa que los datos de un gasto sean correctos.
 * Devuelve "" si todo está bien, o un mensaje explicando el error.
 */
function validarGasto(datos) {
  const descripcion = String(datos.descripcion ?? "").trim();
  const monto = Number(datos.monto);

  if (descripcion === "") {
    return "Escribe una descripción.";
  }
  if (descripcion.length > LARGO_MAXIMO_DESCRIPCION) {
    return `La descripción no puede pasar de ${LARGO_MAXIMO_DESCRIPCION} caracteres.`;
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return "El monto debe ser un número mayor que cero.";
  }
  if (monto > MONTO_MAXIMO) {
    return "El monto es demasiado grande. Revisa si escribiste ceros de más.";
  }
  if (!Object.hasOwn(CATEGORIAS, datos.categoria)) {
    return "Elige una categoría.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha ?? "")) {
    return "Elige una fecha válida.";
  }
  // Las fechas "AAAA-MM-DD" se pueden comparar como texto: "2026-10-11" > "2026-10-10"
  if (datos.fecha > fechaDeHoy()) {
    return "La fecha no puede ser futura.";
  }
  return "";
}

/** Genera un identificador único y sencillo para cada gasto. */
function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Crea el objeto gasto que se guarda. Se asume que ya fue validado. */
function crearGasto(datos) {
  return {
    id: generarId(),
    descripcion: String(datos.descripcion).trim(),
    monto: Math.round(Number(datos.monto)),
    categoria: datos.categoria,
    fecha: datos.fecha
  };
}

/** Suma los montos de una lista de gastos. */
function calcularTotal(gastos) {
  return gastos.reduce((suma, gasto) => suma + gasto.monto, 0);
}

/** Suma solo los gastos del mismo mes y año que la fecha de referencia. */
function totalDelMes(gastos, fechaReferencia) {
  const mesBuscado = fechaReferencia.slice(0, 7); // "2026-10-10" -> "2026-10"
  return calcularTotal(gastos.filter((gasto) => gasto.fecha.slice(0, 7) === mesBuscado));
}

/** Devuelve un objeto { categoria: total } solo con las categorías que tienen gastos. */
function totalesPorCategoria(gastos) {
  const totales = {};
  for (const gasto of gastos) {
    totales[gasto.categoria] = (totales[gasto.categoria] ?? 0) + gasto.monto;
  }
  return totales;
}

/** Devuelve una COPIA ordenada de la más reciente a la más antigua (no modifica la original). */
function ordenarPorFecha(gastos) {
  return [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Filtra por categoría. "todas" devuelve la lista completa. */
function filtrarPorCategoria(gastos, categoria) {
  if (categoria === "todas") return gastos;
  return gastos.filter((gasto) => gasto.categoria === categoria);
}

const formatoDinero = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

/** 15000 -> "$ 15.000" (formato colombiano). */
function formatearDinero(valor) {
  return formatoDinero.format(valor);
}

/**
 * "2026-10-10" -> "10 oct 2026".
 * No usamos new Date("2026-10-10") porque JavaScript la interpreta como medianoche
 * UTC, y en Colombia se mostraría como el 9 de octubre. new Date(año, mes, día)
 * usa la hora local.
 */
function formatearFecha(fechaTexto) {
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}
