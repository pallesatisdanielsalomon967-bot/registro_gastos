/*
 * auth.js — Verificación de usuario (crear cuenta e ingresar).
 *
 * La contraseña NUNCA se guarda: se guarda un "hash" (resultado de una función
 * matemática de un solo sentido) calculado con PBKDF2-SHA-256 y una "sal"
 * aleatoria distinta por cuenta.
 *
 * LÍMITE HONESTO: esto verifica al usuario dentro de ESTE navegador, pero no es
 * seguridad real. Sin servidor, cualquiera con acceso al dispositivo puede abrir las
 * herramientas del navegador y leer o borrar los datos guardados. Para seguridad
 * de verdad se necesitaría un servidor/base de datos (se vería en semestres siguientes).
 */
"use strict";

const ITERACIONES_HASH = 150000;
const MAX_INTENTOS = 5;
const ESPERA_BLOQUEO_MS = 30000;

let intentosFallidos = 0;
let bloqueadoHasta = 0;

function aBase64(bytes) {
  let texto = "";
  for (const b of bytes) texto += String.fromCharCode(b);
  return btoa(texto);
}

function deBase64(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** ¿Puede este navegador cifrar? (exige https o localhost). */
function cifradoDisponible() {
  return Boolean(globalThis.crypto?.subtle);
}

async function derivarHash(contrasena, sal, iteraciones) {
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" }, llave, 256
  );
  return new Uint8Array(bits);
}

/** Crea { sal, hash, iter } a partir de una contraseña. */
async function crearCredenciales(contrasena) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivarHash(contrasena, sal, ITERACIONES_HASH);
  return { sal: aBase64(sal), hash: aBase64(hash), iter: ITERACIONES_HASH };
}

/** Comparación que no se detiene en la primera diferencia. */
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
  return diferencia === 0;
}

async function contrasenaCorrecta(contrasena, usuario) {
  const calculado = await derivarHash(contrasena, deBase64(usuario.sal), usuario.iter);
  return iguales(calculado, deBase64(usuario.hash));
}

/**
 * Intenta ingresar. Devuelve { usuario } si salió bien o { error } con el mensaje.
 * Tras 5 fallos seguidos espera 30 s (frena adivinar contraseñas desde la pantalla).
 */
async function iniciarSesion(correo, contrasena) {
  if (!cifradoDisponible()) {
    return { error: "Este navegador no permite verificar contraseñas aquí. Abre la página desde su enlace https." };
  }
  const ahora = Date.now();
  if (ahora < bloqueadoHasta) {
    const segundos = Math.ceil((bloqueadoHasta - ahora) / 1000);
    return { error: `Demasiados intentos. Espera ${segundos} s e inténtalo de nuevo.` };
  }
  const usuario = buscarUsuarioPorCorreo(correo);
  // Mismo mensaje si el correo no existe o la clave falla: no revela qué correos están registrados
  const correcto = usuario ? await contrasenaCorrecta(contrasena, usuario) : false;
  if (!correcto) {
    intentosFallidos++;
    if (intentosFallidos >= MAX_INTENTOS) {
      intentosFallidos = 0;
      bloqueadoHasta = Date.now() + ESPERA_BLOQUEO_MS;
      return { error: "Demasiados intentos. Espera 30 s e inténtalo de nuevo." };
    }
    return { error: "Correo o contraseña incorrectos." };
  }
  intentosFallidos = 0;
  return { usuario };
}

/** Crea la cuenta (ya validada con validarRegistro). Devuelve { usuario } o { error }. */
async function registrarUsuario(datos) {
  if (!cifradoDisponible()) {
    return { error: "Este navegador no permite crear cuentas aquí. Abre la página desde su enlace https." };
  }
  const credenciales = await crearCredenciales(datos.contrasena);
  const usuario = {
    id: generarId(),
    correo: normalizarCorreo(datos.correo),
    ...credenciales,
    creado: fechaDeHoy(),
    perfil: {
      nombres: datos.nombres.trim(),
      apellidos: datos.apellidos.trim(),
      telefono: "",
      nacimiento: "",
      ciudad: "",
      ocupacion: "",
      foto: ""
    }
  };
  if (!guardarUsuario(usuario)) {
    return { error: "No se pudo guardar la cuenta. Revisa que tu navegador permita guardar datos." };
  }
  return { usuario };
}

/** Cambia la contraseña tras comprobar la actual. Devuelve { usuario } o { error }. */
async function cambiarContrasena(usuario, actual, nueva) {
  if (!(await contrasenaCorrecta(actual, usuario))) return { error: "La contraseña actual no es correcta." };
  const errorClave = validarContrasena(nueva);
  if (errorClave) return { error: errorClave };
  const actualizado = { ...usuario, ...(await crearCredenciales(nueva)) };
  if (!guardarUsuario(actualizado)) return { error: "No se pudo guardar el cambio." };
  return { usuario: actualizado };
}
