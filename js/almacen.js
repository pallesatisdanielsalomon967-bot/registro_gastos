/*
 * almacen.js — Todo lo que se guarda y se lee del navegador (localStorage).
 *
 * Cada cuenta tiene sus propios datos:
 *   rg2:usuarios        -> lista de cuentas (perfil + contraseña cifrada)
 *   rg2:datos:<id>      -> { categorias, gastos } de esa cuenta
 *   rg2:sesion          -> id de la cuenta con la sesión abierta
 *
 * Importante: localStorage vive SOLO en este navegador y este dispositivo. No hay
 * servidor, así que la cuenta no se puede abrir desde otro celular ni computador.
 * Todo acceso va dentro de try/catch porque el navegador puede bloquearlo
 * (modo privado, datos desactivados, cuota llena).
 */
"use strict";

const CLAVE_USUARIOS = "rg2:usuarios";
const CLAVE_SESION = "rg2:sesion";
const CLAVE_LEGADO = "registro-gastos:v1";          // gastos de la versión 1 (sin cuentas)
const CLAVE_LEGADO_RECLAMADO = "rg2:legado-reclamado";
const prefijoDatos = (id) => `rg2:datos:${id}`;

/** Lee y convierte JSON. Si falla o no existe, devuelve `porDefecto`. */
function leerJSON(clave, porDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto === null ? porDefecto : JSON.parse(texto);
  } catch (error) {
    console.warn(`No se pudo leer "${clave}":`, error);
    return porDefecto;
  }
}

/** Guarda como JSON. Devuelve true si se pudo (false si el navegador lo impide). */
function escribirJSON(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    console.error(`No se pudo guardar "${clave}":`, error);
    return false;
  }
}

// ---------- Cuentas ----------

function listarUsuarios() {
  const lista = leerJSON(CLAVE_USUARIOS, []);
  return Array.isArray(lista) ? lista.filter((u) => u && typeof u.id === "string" && typeof u.correo === "string") : [];
}

function buscarUsuarioPorCorreo(correo) {
  const buscado = normalizarCorreo(correo);
  return listarUsuarios().find((u) => u.correo === buscado) ?? null;
}

function buscarUsuarioPorId(id) {
  return listarUsuarios().find((u) => u.id === id) ?? null;
}

/** Crea o reemplaza la cuenta (se identifica por id). */
function guardarUsuario(usuario) {
  const otros = listarUsuarios().filter((u) => u.id !== usuario.id);
  return escribirJSON(CLAVE_USUARIOS, [...otros, usuario]);
}

function eliminarUsuario(id) {
  const ok = escribirJSON(CLAVE_USUARIOS, listarUsuarios().filter((u) => u.id !== id));
  try { localStorage.removeItem(prefijoDatos(id)); } catch { /* nada que hacer */ }
  return ok;
}

// ---------- Sesión ----------
// "Mantener sesión" guarda en localStorage (sigue al cerrar el navegador);
// si no, en sessionStorage (se borra al cerrar la pestaña).

function leerSesion() {
  try {
    return sessionStorage.getItem(CLAVE_SESION) ?? localStorage.getItem(CLAVE_SESION);
  } catch {
    return null;
  }
}

function guardarSesion(id, recordar) {
  borrarSesion();
  try {
    (recordar ? localStorage : sessionStorage).setItem(CLAVE_SESION, id);
  } catch (error) {
    console.warn("No se pudo guardar la sesión:", error);
  }
}

function borrarSesion() {
  try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* nada */ }
  try { localStorage.removeItem(CLAVE_SESION); } catch { /* nada */ }
}

// ---------- Datos de cada cuenta ----------

/** Carga categorías y gastos de una cuenta, ya limpios. Devuelve { categorias, gastos, descartados }. */
function cargarDatos(idUsuario) {
  const crudo = leerJSON(prefijoDatos(idUsuario), null);
  const categorias = crudo && Array.isArray(crudo.categorias) && crudo.categorias.length > 0
    ? limpiarCategorias(crudo.categorias)
    : categoriasIniciales();
  const { gastos, descartados } = limpiarGastos(crudo?.gastos, categorias);
  return { categorias, gastos, descartados };
}

function guardarDatos(idUsuario, { categorias, gastos }) {
  return escribirJSON(prefijoDatos(idUsuario), { categorias, gastos });
}

// ---------- Migración desde la versión 1 ----------

/**
 * Si el navegador tiene gastos de la versión 1 (sin cuentas) y nadie los ha
 * reclamado, devuelve la lista limpia para importarla a la primera cuenta nueva.
 * No borra nada: los datos viejos se quedan intactos.
 */
function gastosPendientesDeImportar() {
  try {
    if (localStorage.getItem(CLAVE_LEGADO_RECLAMADO)) return [];
  } catch {
    return [];
  }
  const { gastos } = limpiarGastos(leerJSON(CLAVE_LEGADO, []), categoriasIniciales());
  return gastos;
}

function marcarLegadoReclamado() {
  try { localStorage.setItem(CLAVE_LEGADO_RECLAMADO, "1"); } catch { /* nada */ }
}
