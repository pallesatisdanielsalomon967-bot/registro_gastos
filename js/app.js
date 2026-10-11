/*
 * app.js — Conecta la lógica y los datos con la página.
 *
 * Flujo general:
 *   1. Al abrir: ¿hay una sesión guardada? Sí -> entra a la aplicación. No -> pantalla de acceso.
 *   2. El usuario hace algo (agregar, borrar, editar) -> se escucha con eventos.
 *   3. Se actualizan los datos, se guardan y se vuelve a "pintar" (render).
 */
"use strict";

const NOMBRES_COLOR = ["azul", "naranja", "verde agua", "amarillo", "rosa", "verde", "violeta", "rojo", "gris"];
const EMOJIS_SUGERIDOS = ["🍔", "🚌", "📚", "🎮", "💡", "💊", "🏠", "👕", "🎁", "☕", "🛒", "✈️", "💻", "🐶", "🎓", "💸"];
const VISTAS = ["inicio", "gastos", "perfil"];
const TAMANO_FOTO = 256;
const PESO_MAXIMO_FOTO = 10 * 1024 * 1024;
const CLAVE_SALUDO = "rg2:saludo"; // marca de "ya saludé en esta pestaña"

const $ = (id) => document.getElementById(id);

// ---------- Estado de la aplicación ----------
let usuario = null;                                   // cuenta con la sesión abierta
let estado = { categorias: [], gastos: [] };          // datos de esa cuenta
let descartadosAlCargar = 0;
let periodoRanking = "mes";                           // "mes" | "todo"
let ultimaCategoria = "";
let idCategoriaEditando = null;                       // null = se está creando una nueva
let confirmandoGasto = null;                          // id del gasto con el botón en "¿Borrar?"
let temporizadorGasto = null;
let temporizadorTodos = null;
let temporizadorCuenta = null;
let temporizadorCategoria = null;
let confirmandoCategoria = null;
let temporizadorAviso = null;
let diasHistorial = [];
let categoriaRecienCreada = null;                     // para dejarla elegida en "Nuevo gasto"

// ---------- Avisos breves ----------
function mostrarAviso(texto) {
  const aviso = $("aviso");
  aviso.textContent = texto;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 3500);
}

// ---------- Guardado seguro ----------
/**
 * Guarda `nuevo` y SOLO si se pudo lo adopta como estado actual. Así, si el
 * navegador no deja guardar, la pantalla no muestra algo que se perdería al recargar.
 */
function confirmarCambio(nuevo, zonaError) {
  if (!guardarDatos(usuario.id, nuevo)) {
    zonaError.textContent = "No se pudo guardar. Revisa que tu navegador permita guardar datos.";
    return false;
  }
  estado = nuevo;
  return true;
}

// ============================================================
// 1. ACCESO (verificación de usuario)
// ============================================================

function pintarFechaDeAcceso() {
  const partes = partesDeFecha();
  $("acceso-numero").textContent = partes.numero;
  // Solo la primera letra en mayúscula: "Octubre de 2026" (text-transform: capitalize pondría "De")
  const primeraMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  $("acceso-semana").textContent = primeraMayuscula(partes.diaSemana);
  $("acceso-mes").textContent = primeraMayuscula(partes.mesAnio);
}

function seleccionarPestana(cual) {
  const ingresar = cual === "ingresar";
  $("pestana-ingresar").setAttribute("aria-selected", String(ingresar));
  $("pestana-ingresar").tabIndex = ingresar ? 0 : -1;
  $("pestana-crear").setAttribute("aria-selected", String(!ingresar));
  $("pestana-crear").tabIndex = ingresar ? -1 : 0;
  $("form-ingresar").hidden = !ingresar;
  $("form-crear").hidden = ingresar;
}

function mostrarAcceso() {
  $("aplicacion").hidden = true;
  $("pantalla-acceso").hidden = false;
  pintarFechaDeAcceso();
  for (const id of ["form-ingresar", "form-crear"]) $(id).reset();
  for (const id of ["in-error", "cr-error"]) $(id).textContent = "";
  if (!cifradoDisponible()) {
    $("in-error").textContent = "Este navegador no permite verificar contraseñas aquí. Abre la página desde su enlace https.";
  }
  seleccionarPestana("ingresar");
}

$("pestana-ingresar").addEventListener("click", () => seleccionarPestana("ingresar"));
$("pestana-crear").addEventListener("click", () => seleccionarPestana("crear"));
// Flechas ← → entre pestañas (patrón de accesibilidad para pestañas)
for (const pestana of [$("pestana-ingresar"), $("pestana-crear")]) {
  pestana.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const destino = pestana === $("pestana-ingresar") ? "crear" : "ingresar";
    seleccionarPestana(destino);
    $(destino === "crear" ? "pestana-crear" : "pestana-ingresar").focus();
  });
}

// Botones "Mostrar / Ocultar" de las contraseñas
document.addEventListener("click", (e) => {
  const boton = e.target.closest(".ver-clave");
  if (!boton) return;
  const campo = $(boton.dataset.ver);
  const mostrar = campo.type === "password";
  campo.type = mostrar ? "text" : "password";
  boton.textContent = mostrar ? "Ocultar" : "Mostrar";
  boton.setAttribute("aria-pressed", String(mostrar));
});

$("form-ingresar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = $("in-error");
  const correo = $("in-correo").value;
  const clave = $("in-clave").value;
  if (correo.trim() === "" || clave === "") {
    error.textContent = "Escribe tu correo y tu contraseña.";
    return;
  }
  const boton = $("in-enviar");
  boton.disabled = true;
  boton.textContent = "Verificando…";
  const resultado = await iniciarSesion(correo, clave);
  boton.disabled = false;
  boton.textContent = "Ingresar";
  if (resultado.error) {
    error.textContent = resultado.error;
    $("in-clave").select();
    return;
  }
  error.textContent = "";
  guardarSesion(resultado.usuario.id, $("in-recordar").checked);
  entrarEnAplicacion(resultado.usuario, { bienvenida: true });
});

$("form-crear").addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = $("cr-error");
  const entrada = {
    nombres: $("cr-nombres").value,
    apellidos: $("cr-apellidos").value,
    correo: $("cr-correo").value,
    contrasena: $("cr-clave").value,
    confirmar: $("cr-confirmar").value
  };
  const problema = validarRegistro(entrada, listarUsuarios());
  if (problema) {
    error.textContent = problema;
    return;
  }
  const boton = $("cr-enviar");
  boton.disabled = true;
  boton.textContent = "Creando cuenta…";
  const resultado = await registrarUsuario(entrada);
  boton.disabled = false;
  boton.textContent = "Crear mi cuenta";
  if (resultado.error) {
    error.textContent = resultado.error;
    return;
  }

  // Si el navegador tenía gastos de la versión 1 (sin cuentas), pasan a esta primera cuenta
  const pendientes = gastosPendientesDeImportar();
  if (pendientes.length > 0 && guardarDatos(resultado.usuario.id, { categorias: categoriasIniciales(), gastos: pendientes })) {
    marcarLegadoReclamado();
  }
  guardarSesion(resultado.usuario.id, false);
  entrarEnAplicacion(resultado.usuario, { bienvenida: true, importados: pendientes.length });
});

// ============================================================
// 2. ENTRAR, SALIR Y BIENVENIDA
// ============================================================

function entrarEnAplicacion(cuenta, { bienvenida = false, importados = 0 } = {}) {
  usuario = cuenta;
  const cargado = cargarDatos(cuenta.id);
  estado = { categorias: cargado.categorias, gastos: cargado.gastos };
  descartadosAlCargar = cargado.descartados;
  periodoRanking = "mes";
  ultimaCategoria = "";

  $("pantalla-acceso").hidden = true;
  $("aplicacion").hidden = false;
  pintarUsuario();
  rellenarCategorias();
  mostrarVista();
  if (bienvenida) abrirBienvenida(importados);
}

function haySaludoHecho() {
  try { return sessionStorage.getItem(CLAVE_SALUDO) === "1"; } catch { return true; }
}

function abrirBienvenida(importados = 0) {
  try { sessionStorage.setItem(CLAVE_SALUDO, "1"); } catch { /* nada */ }
  const ahora = new Date();
  $("bienvenida-titulo").textContent = `${saludoSegunHora(ahora.getHours())}, ${primerNombre()}`;
  $("bienvenida-fecha").textContent = fechaLarga(ahora);

  const hoy = fechaDeHoy();
  const delMes = estado.gastos.filter((g) => g.fecha.slice(0, 7) === hoy.slice(0, 7));
  let resumen;
  if (estado.gastos.length === 0) {
    resumen = "Aún no tienes gastos registrados. Empieza con el primero cuando quieras.";
  } else if (delMes.length === 0) {
    resumen = "Todavía no has registrado gastos este mes.";
  } else {
    resumen = `Este mes llevas ${formatearDinero(calcularTotal(delMes))} en ${delMes.length} ${delMes.length === 1 ? "gasto" : "gastos"}.`;
  }
  if (importados > 0) {
    resumen += ` Importé los ${importados} gastos que tenías guardados en este navegador.`;
  }
  $("bienvenida-resumen").textContent = resumen;
  $("dlg-bienvenida").showModal();
}

$("bienvenida-continuar").addEventListener("click", () => $("dlg-bienvenida").close());
$("dlg-bienvenida").addEventListener("close", () => {
  if (!usuario) return;
  location.hash = "#/inicio";
  $("contenido").focus({ preventScroll: true });
});

function salir() {
  for (const dialogo of document.querySelectorAll("dialog[open]")) dialogo.close();
  borrarSesion();
  try { sessionStorage.removeItem(CLAVE_SALUDO); } catch { /* nada */ }
  usuario = null;
  estado = { categorias: [], gastos: [] };
  history.replaceState(null, "", location.pathname + location.search); // quita el "#/..." de la dirección
  mostrarAcceso();
  window.scrollTo(0, 0);
}

// ============================================================
// 3. NAVEGACIÓN ENTRE VISTAS (una sola página, rutas con #)
// ============================================================

function vistaActual() {
  const nombre = location.hash.replace(/^#\/?/, "");
  return VISTAS.includes(nombre) ? nombre : "inicio";
}

function mostrarVista() {
  if (!usuario) return;
  const actual = vistaActual();
  for (const seccion of document.querySelectorAll("[data-vista]")) {
    seccion.hidden = seccion.dataset.vista !== actual;
  }
  for (const enlace of document.querySelectorAll("[data-ir]")) {
    if (enlace.dataset.ir === actual) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  }
  const titulos = { inicio: "Inicio", gastos: "Mis gastos", perfil: "Mi perfil" };
  document.title = `${titulos[actual]} · Registro de Gastos`;
  renderVista(actual);
}

function renderVista(nombre = vistaActual()) {
  if (nombre === "inicio") renderInicio();
  else if (nombre === "gastos") renderGastos();
  else renderPerfil();
}

window.addEventListener("hashchange", () => {
  if (!usuario) return;
  mostrarVista();
  window.scrollTo(0, 0);
});

// El enlace "Saltar al contenido" no debe cambiar la ruta de la página
document.querySelector(".saltar").addEventListener("click", (e) => {
  e.preventDefault();
  $("contenido").focus();
});

// Acciones del menú (botones que no son enlaces)
document.addEventListener("click", (e) => {
  const boton = e.target.closest("[data-accion]");
  if (!boton) return;
  const accion = boton.dataset.accion;
  if (accion === "nuevo-gasto") abrirNuevoGasto();
  else if (accion === "categorias") abrirCategorias();
  else if (accion === "salir") salir();
});

// Botones que cierran su ventana (X y Cancelar)
document.addEventListener("click", (e) => {
  const boton = e.target.closest("[data-cerrar]");
  if (boton) boton.closest("dialog").close();
});

// ============================================================
// 4. DATOS DEL USUARIO EN PANTALLA (nombre, avatar)
// ============================================================

function primerNombre() {
  return usuario.perfil.nombres.trim().split(/\s+/)[0];
}

function pintarUsuario() {
  const { nombres, apellidos, foto } = usuario.perfil;
  const fotoValida = typeof foto === "string" && foto.startsWith("data:image/jpeg;base64,");
  for (const avatar of document.querySelectorAll("[data-avatar]")) {
    if (fotoValida) {
      avatar.style.backgroundImage = `url("${foto}")`;
      avatar.textContent = "";
    } else {
      avatar.style.backgroundImage = "";
      avatar.textContent = iniciales(nombres, apellidos);
    }
  }
  for (const nodo of document.querySelectorAll("[data-nombre-usuario]")) nodo.textContent = primerNombre();
  for (const nodo of document.querySelectorAll("[data-nombre-completo]")) nodo.textContent = `${nombres} ${apellidos}`.trim();
}

// ============================================================
// 5. CATEGORÍAS: listas desplegables y editor
// ============================================================

/** Llena una lista desplegable con las categorías actuales. */
function llenarSelect(select, { primera, valor, conNueva = false }) {
  select.replaceChildren(new Option(primera.texto, primera.valor));
  for (const c of estado.categorias) select.append(new Option(`${c.emoji} ${c.nombre}`, c.id));
  if (conNueva) select.append(new Option("＋ Nueva categoría…", "__nueva"));
  select.value = estado.categorias.some((c) => c.id === valor) || valor === "todas" ? valor : primera.valor;
}

function rellenarCategorias() {
  llenarSelect($("g-categoria"), {
    primera: { texto: "Elige una…", valor: "" }, valor: $("g-categoria").value, conNueva: true
  });
  llenarSelect($("filtro-categoria"), {
    primera: { texto: "Todas las categorías", valor: "todas" }, valor: $("filtro-categoria").value || "todas"
  });
}

function crearOpcionesDeColor() {
  const lista = $("cat-colores");
  for (let i = 0; i <= COLOR_NEUTRO; i++) {
    const etiqueta = el("label", "color-opcion");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "cat-color";
    radio.value = String(i);
    radio.setAttribute("aria-label", NOMBRES_COLOR[i]);
    const muestra = el("span");
    muestra.style.setProperty("--c", `var(--cat-${i})`);
    etiqueta.append(radio, muestra);
    lista.append(etiqueta);
  }
  for (const emoji of EMOJIS_SUGERIDOS) {
    const boton = el("button", "", emoji);
    boton.type = "button";
    boton.setAttribute("aria-label", `Usar el ícono ${emoji}`);
    boton.addEventListener("click", () => { $("cat-emoji").value = emoji; });
    $("cat-emojis").append(boton);
  }
}

function abrirCategorias({ nueva = false } = {}) {
  $("cat-estado").textContent = "";
  ocultarFormCategoria();
  renderCategorias();
  if (!$("dlg-categorias").open) $("dlg-categorias").showModal();
  if (nueva) mostrarFormCategoria(null);
}

function renderCategorias() {
  const conteo = new Map();
  for (const g of estado.gastos) conteo.set(g.categoria, (conteo.get(g.categoria) ?? 0) + 1);

  const filas = estado.categorias.map((c) => {
    const li = el("li", "cat-fila");
    li.style.setProperty("--c", `var(--cat-${c.color})`);
    const cantidad = conteo.get(c.id) ?? 0;
    const nombre = el("span", "cat-nombre", c.nombre);
    nombre.append(el("small", "", `${cantidad} ${cantidad === 1 ? "gasto" : "gastos"}`));
    li.append(el("span", "cat-marca"), el("span", "cat-emoji", c.emoji), nombre);

    const editar = el("button", "cat-editar", "Editar");
    editar.type = "button";
    editar.dataset.editar = c.id;
    editar.setAttribute("aria-label", `Editar ${c.nombre}`);
    li.append(editar);

    if (c.id !== ID_OTROS) {
      const borrar = el("button", "boton-eliminar", confirmandoCategoria === c.id ? "¿Borrar?" : "Eliminar");
      borrar.type = "button";
      borrar.dataset.eliminar = c.id;
      borrar.setAttribute("aria-label", `Eliminar ${c.nombre}`);
      if (confirmandoCategoria === c.id) borrar.classList.add("boton-confirmar");
      li.append(borrar);
    }
    return li;
  });
  $("cat-lista").replaceChildren(...filas);
}

function mostrarFormCategoria(categoria) {
  idCategoriaEditando = categoria ? categoria.id : null;
  $("cat-form-titulo").textContent = categoria ? `Editar “${categoria.nombre}”` : "Nueva categoría";
  $("cat-nombre").value = categoria ? categoria.nombre : "";
  $("cat-emoji").value = categoria ? categoria.emoji : "";
  const color = categoria ? categoria.color : siguienteColorLibre(estado.categorias);
  const radio = document.querySelector(`input[name="cat-color"][value="${color}"]`);
  if (radio) radio.checked = true;
  $("cat-error").textContent = "";
  $("cat-form").hidden = false;
  $("cat-nombre").focus();
  $("cat-form").scrollIntoView({ block: "nearest" });
}

function ocultarFormCategoria() {
  $("cat-form").hidden = true;
  idCategoriaEditando = null;
}

$("cat-nueva").addEventListener("click", () => {
  $("cat-estado").textContent = "";
  mostrarFormCategoria(null);
});
$("cat-cancelar").addEventListener("click", ocultarFormCategoria);

$("cat-lista").addEventListener("click", (e) => {
  const editar = e.target.closest("[data-editar]");
  if (editar) {
    $("cat-estado").textContent = "";
    mostrarFormCategoria(buscarCategoria(estado.categorias, editar.dataset.editar));
    return;
  }
  const borrar = e.target.closest("[data-eliminar]");
  if (!borrar) return;
  const id = borrar.dataset.eliminar;

  // Confirmación de doble toque (confirm() se bloquea en algunos navegadores incrustados)
  if (confirmandoCategoria !== id) {
    confirmandoCategoria = id;
    clearTimeout(temporizadorCategoria);
    temporizadorCategoria = setTimeout(() => { confirmandoCategoria = null; renderCategorias(); }, 4000);
    renderCategorias();
    const conGastos = estado.gastos.filter((g) => g.categoria === id).length;
    $("cat-estado").textContent = conGastos > 0
      ? `Toca otra vez para borrarla. Sus ${conGastos} ${conGastos === 1 ? "gasto pasará" : "gastos pasarán"} a “Otros”.`
      : "Toca otra vez para borrarla.";
    return;
  }
  clearTimeout(temporizadorCategoria);
  confirmandoCategoria = null;
  const resultado = eliminarCategoria(estado.categorias, estado.gastos, id);
  if (!resultado) return;
  if (!confirmarCambio({ categorias: resultado.categorias, gastos: resultado.gastos }, $("cat-estado"))) return;
  if (idCategoriaEditando === id) ocultarFormCategoria();
  $("cat-estado").textContent = resultado.movidos > 0
    ? `Categoría eliminada. ${resultado.movidos} ${resultado.movidos === 1 ? "gasto pasó" : "gastos pasaron"} a “Otros”.`
    : "Categoría eliminada.";
  renderCategorias();
  rellenarCategorias();
  renderVista();
});

$("cat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const seleccionado = document.querySelector('input[name="cat-color"]:checked');
  const entrada = { nombre: $("cat-nombre").value, emoji: $("cat-emoji").value, color: seleccionado ? seleccionado.value : "" };
  const problema = validarCategoria(entrada, estado.categorias, idCategoriaEditando);
  if (problema) {
    $("cat-error").textContent = problema;
    return;
  }
  const nueva = idCategoriaEditando === null ? crearCategoria(entrada) : null;
  const categorias = nueva
    ? [...estado.categorias, nueva]
    : actualizarCategoria(estado.categorias, idCategoriaEditando, entrada);
  if (!confirmarCambio({ categorias, gastos: estado.gastos }, $("cat-error"))) return;

  const eraNueva = nueva !== null;
  if (nueva) categoriaRecienCreada = nueva.id;
  ocultarFormCategoria();
  $("cat-estado").textContent = eraNueva ? "Categoría creada y guardada." : "Cambios guardados.";
  renderCategorias();
  rellenarCategorias();
  renderVista();
});

$("cat-form").addEventListener("input", () => { $("cat-error").textContent = ""; });

// Al cerrar el editor, la lista del formulario "Nuevo gasto" ya está al día (se rellenó al guardar)
$("dlg-categorias").addEventListener("close", () => {
  confirmandoCategoria = null;
  clearTimeout(temporizadorCategoria);
  rellenarCategorias();
  // Si se creó una categoría desde "Nuevo gasto", queda elegida para ahorrar un paso
  if (categoriaRecienCreada && $("dlg-gasto").open) $("g-categoria").value = categoriaRecienCreada;
  categoriaRecienCreada = null;
});

// ============================================================
// 6. FORMULARIO "NUEVO GASTO": categoría, monto, descripción, fecha
// ============================================================

function abrirNuevoGasto() {
  if (!usuario) return;
  $("form-gasto").reset();
  rellenarCategorias();
  $("g-categoria").value = estado.categorias.some((c) => c.id === ultimaCategoria) ? ultimaCategoria : "";
  const hoy = fechaDeHoy();
  $("g-fecha").value = hoy;
  $("g-fecha").max = hoy; // el calendario no deja elegir fechas futuras
  $("g-error").textContent = "";
  if (!$("dlg-gasto").open) $("dlg-gasto").showModal();
  $("g-categoria").focus();
}

// "＋ Nueva categoría…" dentro de la lista abre el editor ya listo para crear una
let categoriaPrevia = "";
$("g-categoria").addEventListener("focus", () => { categoriaPrevia = $("g-categoria").value; });
$("g-categoria").addEventListener("change", () => {
  if ($("g-categoria").value === "__nueva") {
    $("g-categoria").value = categoriaPrevia === "__nueva" ? "" : categoriaPrevia;
    abrirCategorias({ nueva: true });
  }
  categoriaPrevia = $("g-categoria").value;
});
$("g-editar-categorias").addEventListener("click", () => abrirCategorias());

$("form-gasto").addEventListener("input", () => { $("g-error").textContent = ""; });

$("form-gasto").addEventListener("submit", (e) => {
  e.preventDefault();
  const entrada = {
    categoria: $("g-categoria").value,
    monto: $("g-monto").value,
    descripcion: $("g-descripcion").value,
    fecha: $("g-fecha").value
  };
  const problema = validarGasto(entrada, estado.categorias);
  if (problema) {
    $("g-error").textContent = problema;
    return;
  }
  const gasto = crearGasto(entrada);
  if (!confirmarCambio({ categorias: estado.categorias, gastos: [...estado.gastos, gasto] }, $("g-error"))) return;

  ultimaCategoria = gasto.categoria;
  const categoria = buscarCategoria(estado.categorias, gasto.categoria);
  $("dlg-gasto").close();
  mostrarAviso(`Gasto guardado: ${formatearDinero(gasto.monto)} en ${categoria.nombre}`);
  renderVista();
});

// ============================================================
// 7. VISTA INICIO: saludo y los 3 gráficos
// ============================================================

function renderInicio() {
  const ahora = new Date();
  $("inicio-titulo").textContent = `${saludoSegunHora(ahora.getHours())}, ${primerNombre()}`;
  $("inicio-fecha").textContent = fechaLarga(ahora);

  const aviso = $("aviso-datos");
  aviso.hidden = descartadosAlCargar === 0;
  if (descartadosAlCargar > 0) {
    aviso.textContent = `${descartadosAlCargar} ${descartadosAlCargar === 1 ? "registro guardado estaba dañado y no se pudo recuperar" : "registros guardados estaban dañados y no se pudieron recuperar"}.`;
  }

  const hoy = fechaDeHoy();
  renderGraficoCategorias(hoy);
  renderGraficoHistorial(hoy);
  renderGraficoResumen(hoy);
}

/** Muestra u oculta el mensaje de "sin datos" de un gráfico. */
function alternarVacio(idVacio, idContenido, mensaje) {
  $(idVacio).hidden = mensaje === "";
  $(idVacio).textContent = mensaje;
  $(idContenido).hidden = mensaje !== "";
}

/** Llena una tabla de datos (la alternativa accesible al gráfico). */
function llenarTabla(idCuerpo, filas) {
  const cuerpo = $(idCuerpo);
  cuerpo.replaceChildren(...filas.map((celdas) => {
    const tr = document.createElement("tr");
    celdas.forEach((texto, i) => {
      const td = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) td.scope = "row";
      else td.className = "num";
      td.textContent = texto;
      tr.append(td);
    });
    return tr;
  }));
}

// ----- Gráfico 1: categoría con más gastos -----
function renderGraficoCategorias(hoy) {
  for (const boton of document.querySelectorAll("[data-periodo]")) {
    boton.setAttribute("aria-pressed", String(boton.dataset.periodo === periodoRanking));
  }
  const enMes = periodoRanking === "mes";
  const lista = enMes ? gastosEntre(estado.gastos, `${hoy.slice(0, 7)}-01`, hoy) : estado.gastos;
  const ranking = rankingCategorias(lista, estado.categorias);

  if (ranking.length === 0) {
    const mensaje = estado.gastos.length === 0
      ? "Registra tu primer gasto y aquí verás en qué categoría gastas más."
      : "Aún no hay gastos este mes. Prueba con “Todo” para ver el historial completo.";
    $("g1-titular").textContent = "";
    alternarVacio("g1-vacio", "g1-grafico", mensaje);
    llenarTabla("g1-tabla", []);
    return;
  }
  alternarVacio("g1-vacio", "g1-grafico", "");
  const lider = ranking[0];
  const empate = ranking.length > 1 && ranking[1].total === lider.total;
  $("g1-titular").textContent = empate
    ? `Empate: ${lider.emoji} ${lider.nombre} y ${ranking[1].emoji} ${ranking[1].nombre} · ${formatearDinero(lider.total)} cada una`
    : `${lider.emoji} ${lider.nombre} · ${formatearDinero(lider.total)} (${Math.round(lider.porcentaje)} % ${enMes ? "del mes" : "del total"})`;
  pintarRanking($("g1-grafico"), ranking);
  llenarTabla("g1-tabla", ranking.map((f) => [
    `${f.emoji} ${f.nombre}`, formatearDinero(f.total), `${Math.round(f.porcentaje)} %`, String(f.cantidad)
  ]));
}

for (const boton of document.querySelectorAll("[data-periodo]")) {
  boton.addEventListener("click", () => {
    periodoRanking = boton.dataset.periodo;
    renderGraficoCategorias(fechaDeHoy());
  });
}

// ----- Gráfico 2: historial del último mes -----
function renderGraficoHistorial(hoy) {
  diasHistorial = totalesPorDia(estado.gastos, hoy, 30);
  const suma = diasHistorial.reduce((s, d) => s + d.total, 0);

  if (suma === 0) {
    $("g2-titular").textContent = "";
    alternarVacio("g2-vacio", "g2-grafico", "No hay gastos en los últimos 30 días.");
    llenarTabla("g2-tabla", []);
    return;
  }
  alternarVacio("g2-vacio", "g2-grafico", "");
  $("g2-titular").textContent = `${formatearDinero(suma)} en 30 días · ${formatearDinero(Math.round(suma / 30))} por día en promedio`;
  pintarHistorial($("g2-grafico"), diasHistorial);
  llenarTabla("g2-tabla", [...diasHistorial].reverse().filter((d) => d.cantidad > 0).map((d) => [
    formatearFecha(d.fecha), formatearDinero(d.total), String(d.cantidad)
  ]));
}

// El gráfico de 30 días es SVG de ancho fijo: se redibuja cuando cambia el ancho de su caja
let anchoHistorial = 0;
new ResizeObserver((entradas) => {
  const ancho = Math.round(entradas[0].contentRect.width);
  if (ancho === 0 || ancho === anchoHistorial || diasHistorial.length === 0 || $("g2-grafico").hidden) return;
  anchoHistorial = ancho;
  pintarHistorial($("g2-grafico"), diasHistorial);
}).observe($("g2-grafico"));

// ----- Gráfico 3: resumen del mes -----
function renderGraficoResumen(hoy) {
  const r = resumenMes(estado.gastos, hoy);
  const mesCorto = (fechaTexto) => aFecha(fechaTexto).toLocaleDateString("es-CO", { month: "short" });
  const previo = `${mesAnterior(hoy)}-01`;
  const diasPrevio = new Date(Number(previo.slice(0, 4)), Number(previo.slice(5, 7)), 0).getDate();

  $("g3-titular").textContent = textoVariacion(r);
  pintarComparacion($("g3-grafico"), r, {
    actual: `1–${r.diaDelMes} ${mesCorto(hoy)}`,
    previo: `1–${Math.min(r.diaDelMes, diasPrevio)} ${mesCorto(previo)}`
  });

  $("g3-promedio").textContent = formatearDinero(r.promedioDiario);
  $("g3-cantidad").textContent = String(r.cantidad);
  $("g3-total").textContent = formatearDinero(calcularTotal(estado.gastos));
  $("g3-mayor").textContent = r.mayor ? formatearDinero(r.mayor.monto) : "—";
  $("g3-mayor-detalle").textContent = r.mayor ? r.mayor.descripcion : "";

  llenarTabla("g3-tabla", [
    ["Este mes", formatearDinero(r.total)],
    ["Mes pasado, mismos días", formatearDinero(r.totalPrevio)],
    ["Mes pasado completo", formatearDinero(r.totalPrevioCompleto)],
    ["Promedio por día", formatearDinero(r.promedioDiario)],
    ["Gastos del mes", String(r.cantidad)],
    ["Total registrado", formatearDinero(calcularTotal(estado.gastos))]
  ]);
}

// ============================================================
// 8. VISTA MIS GASTOS
// ============================================================

function renderGastos() {
  rellenarCategorias();
  const filtro = $("filtro-categoria").value || "todas";
  const visibles = ordenarPorFecha(filtrarPorCategoria(estado.gastos, filtro));

  $("gastos-resumen").textContent = estado.gastos.length === 0
    ? "Sin gastos registrados"
    : `${visibles.length} ${visibles.length === 1 ? "gasto" : "gastos"} · ${formatearDinero(calcularTotal(visibles))}`;

  const vacio = estado.gastos.length === 0
    ? "Aún no registras gastos. Toca “Nuevo gasto” para empezar."
    : visibles.length === 0 ? "No hay gastos en esta categoría." : "";
  $("lista-vacia").hidden = vacio === "";
  $("lista-vacia").textContent = vacio;
  $("boton-borrar-todo").hidden = estado.gastos.length === 0;

  $("lista-gastos").replaceChildren(...visibles.map((gasto) => {
    const categoria = buscarCategoria(estado.categorias, gasto.categoria) ?? buscarCategoria(estado.categorias, ID_OTROS);
    const li = el("li", "gasto");
    li.style.setProperty("--c", `var(--cat-${categoria.color})`);

    const icono = el("span", "gasto-icono", categoria.emoji);
    icono.setAttribute("aria-hidden", "true");

    const info = el("div", "gasto-info");
    // textContent (y no innerHTML) evita que alguien inyecte código HTML en la página
    info.append(el("strong", "", gasto.descripcion), el("small", "", `${categoria.nombre} · ${formatearFecha(gasto.fecha)}`));

    const confirmando = confirmandoGasto === gasto.id;
    const borrar = el("button", confirmando ? "boton-eliminar boton-confirmar" : "boton-eliminar", confirmando ? "¿Borrar?" : "Borrar");
    borrar.type = "button";
    borrar.dataset.id = gasto.id; // guardamos el id para saber cuál borrar
    borrar.setAttribute("aria-label", `Borrar ${gasto.descripcion}`);

    li.append(icono, info, el("span", "gasto-monto", formatearDinero(gasto.monto)), borrar);
    return li;
  }));
}

$("filtro-categoria").addEventListener("change", renderGastos);

// "Delegación de eventos": un solo escuchador en la lista atiende todos los botones
$("lista-gastos").addEventListener("click", (e) => {
  const boton = e.target.closest(".boton-eliminar");
  if (!boton) return;
  const id = boton.dataset.id;
  if (confirmandoGasto !== id) {
    confirmandoGasto = id;
    clearTimeout(temporizadorGasto);
    temporizadorGasto = setTimeout(() => { confirmandoGasto = null; renderGastos(); }, 4000);
    renderGastos();
    return;
  }
  clearTimeout(temporizadorGasto);
  confirmandoGasto = null;
  if (!confirmarCambio({ categorias: estado.categorias, gastos: estado.gastos.filter((g) => g.id !== id) }, $("lista-vacia"))) {
    $("lista-vacia").hidden = false;
    return;
  }
  renderGastos();
  mostrarAviso("Gasto borrado");
});

// "Borrar todos": primer toque pide confirmar, el segundo borra (4 s para decidir)
const TEXTO_BORRAR_TODO = "Borrar todos los gastos";
$("boton-borrar-todo").addEventListener("click", () => {
  const boton = $("boton-borrar-todo");
  if (!temporizadorTodos) {
    boton.textContent = "¿Seguro? Toca otra vez para borrar todo";
    temporizadorTodos = setTimeout(() => { boton.textContent = TEXTO_BORRAR_TODO; temporizadorTodos = null; }, 4000);
    return;
  }
  clearTimeout(temporizadorTodos);
  temporizadorTodos = null;
  boton.textContent = TEXTO_BORRAR_TODO;
  if (!confirmarCambio({ categorias: estado.categorias, gastos: [] }, $("lista-vacia"))) {
    $("lista-vacia").hidden = false;
    return;
  }
  renderGastos();
  mostrarAviso("Se borraron todos los gastos");
});

// ============================================================
// 9. VISTA PERFIL
// ============================================================

function renderPerfil() {
  const p = usuario.perfil;
  $("pf-nombres").value = p.nombres;
  $("pf-apellidos").value = p.apellidos;
  $("pf-correo").value = usuario.correo;
  $("pf-telefono").value = p.telefono ?? "";
  $("pf-nacimiento").value = p.nacimiento ?? "";
  $("pf-nacimiento").max = fechaDeHoy();
  $("pf-ciudad").value = p.ciudad ?? "";
  $("pf-ocupacion").value = p.ocupacion ?? "";
  $("perfil-correo-texto").textContent = usuario.correo;
  $("perfil-desde").textContent = `Cuenta creada el ${formatearFecha(usuario.creado)}`;
  $("perfil-quitar-foto").hidden = !p.foto;
  $("clave-usuario-oculto").value = usuario.correo;
  for (const id of ["pf-error", "cc-error", "perfil-foto-error"]) $(id).textContent = "";
  $("form-clave").reset();
  pintarUsuario();
}

/** Guarda la cuenta; si el navegador no deja, devuelve false y muestra el motivo. */
function guardarCuenta(nueva, zonaError) {
  if (!guardarUsuario(nueva)) {
    zonaError.textContent = "No se pudo guardar. Revisa que tu navegador permita guardar datos.";
    return false;
  }
  usuario = nueva;
  return true;
}

$("form-perfil").addEventListener("submit", (e) => {
  e.preventDefault();
  const entrada = {
    nombres: $("pf-nombres").value.trim(),
    apellidos: $("pf-apellidos").value.trim(),
    telefono: $("pf-telefono").value.trim(),
    nacimiento: $("pf-nacimiento").value,
    ciudad: $("pf-ciudad").value.trim(),
    ocupacion: $("pf-ocupacion").value.trim()
  };
  const problema = validarPerfil(entrada);
  if (problema) {
    $("pf-error").textContent = problema;
    return;
  }
  if (!guardarCuenta({ ...usuario, perfil: { ...usuario.perfil, ...entrada } }, $("pf-error"))) return;
  $("pf-error").textContent = "";
  pintarUsuario();
  mostrarAviso("Perfil actualizado");
});
$("form-perfil").addEventListener("input", () => { $("pf-error").textContent = ""; });

// ----- Foto de perfil (opcional): se recorta en cuadrado y se reduce -----
function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => { URL.revokeObjectURL(url); resolver(imagen); };
    imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("imagen ilegible")); };
    imagen.src = url;
  });
}

async function fotoComoTexto(archivo) {
  const imagen = await cargarImagen(archivo);
  const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight);
  if (!lado) throw new Error("imagen vacía");
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = TAMANO_FOTO;
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#ffffff"; // los PNG con fondo transparente quedan sobre blanco en vez de negro
  ctx.fillRect(0, 0, TAMANO_FOTO, TAMANO_FOTO);
  const x = (imagen.naturalWidth - lado) / 2;
  const y = (imagen.naturalHeight - lado) / 2;
  ctx.drawImage(imagen, x, y, lado, lado, 0, 0, TAMANO_FOTO, TAMANO_FOTO);
  return lienzo.toDataURL("image/jpeg", 0.85);
}

$("perfil-foto-archivo").addEventListener("change", async (e) => {
  const archivo = e.target.files[0];
  e.target.value = ""; // permite volver a elegir el mismo archivo
  const error = $("perfil-foto-error");
  error.textContent = "";
  if (!archivo) return;
  if (!archivo.type.startsWith("image/")) {
    error.textContent = "Ese archivo no es una imagen. Elige una foto JPG o PNG.";
    return;
  }
  if (archivo.size > PESO_MAXIMO_FOTO) {
    error.textContent = "La imagen pesa más de 10 MB. Elige una más liviana.";
    return;
  }
  try {
    const foto = await fotoComoTexto(archivo);
    if (!guardarCuenta({ ...usuario, perfil: { ...usuario.perfil, foto } }, error)) return;
    pintarUsuario();
    $("perfil-quitar-foto").hidden = false;
    mostrarAviso("Foto actualizada");
  } catch (problema) {
    console.warn("No se pudo procesar la foto:", problema);
    error.textContent = "No se pudo leer esa imagen. Prueba con otra en formato JPG o PNG.";
  }
});

$("perfil-quitar-foto").addEventListener("click", () => {
  if (!guardarCuenta({ ...usuario, perfil: { ...usuario.perfil, foto: "" } }, $("perfil-foto-error"))) return;
  pintarUsuario();
  $("perfil-quitar-foto").hidden = true;
  mostrarAviso("Foto eliminada");
});

// ----- Cambiar contraseña -----
$("form-clave").addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = $("cc-error");
  const actual = $("cc-actual").value;
  const nueva = $("cc-nueva").value;
  if (actual === "" || nueva === "") {
    error.textContent = "Completa la contraseña actual y la nueva.";
    return;
  }
  if (nueva !== $("cc-confirmar").value) {
    error.textContent = "Las contraseñas nuevas no coinciden.";
    return;
  }
  if (nueva === actual) {
    error.textContent = "La contraseña nueva debe ser distinta de la actual.";
    return;
  }
  if (!cifradoDisponible()) {
    error.textContent = "Este navegador no permite cambiar contraseñas aquí. Abre la página desde su enlace https.";
    return;
  }
  const resultado = await cambiarContrasena(usuario, actual, nueva);
  if (resultado.error) {
    error.textContent = resultado.error;
    return;
  }
  usuario = resultado.usuario;
  $("form-clave").reset();
  error.textContent = "";
  mostrarAviso("Contraseña cambiada");
});
$("form-clave").addEventListener("input", () => { $("cc-error").textContent = ""; });

// ----- Eliminar cuenta (doble toque) -----
const TEXTO_BORRAR_CUENTA = "Eliminar mi cuenta y mis datos";
$("boton-borrar-cuenta").addEventListener("click", () => {
  const boton = $("boton-borrar-cuenta");
  if (!temporizadorCuenta) {
    boton.textContent = "¿Seguro? Se borra TODO. Toca otra vez";
    temporizadorCuenta = setTimeout(() => { boton.textContent = TEXTO_BORRAR_CUENTA; temporizadorCuenta = null; }, 5000);
    return;
  }
  clearTimeout(temporizadorCuenta);
  temporizadorCuenta = null;
  boton.textContent = TEXTO_BORRAR_CUENTA;
  const id = usuario.id;
  salir();
  eliminarUsuario(id);
  mostrarAviso("Tu cuenta y tus datos se eliminaron de este navegador");
});

// ============================================================
// 10. SINCRONIZACIÓN ENTRE PESTAÑAS Y CAMBIO DE DÍA
// ============================================================

// Si la misma cuenta está abierta en otra pestaña y cambia algo, esta pestaña se actualiza
// (así no se sobrescriben datos con una copia vieja).
window.addEventListener("storage", (e) => {
  if (!usuario) return;
  if (e.key === prefijoDatos(usuario.id)) {
    const cargado = cargarDatos(usuario.id);
    estado = { categorias: cargado.categorias, gastos: cargado.gastos };
    rellenarCategorias();
    renderVista();
  } else if (e.key === CLAVE_USUARIOS) {
    const actual = buscarUsuarioPorId(usuario.id);
    if (!actual) { salir(); return; }
    usuario = actual;
    pintarUsuario();
  }
});

// Al volver a la pestaña (por ejemplo, al día siguiente) se actualizan fecha y gráficos
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (usuario) renderVista();
  else pintarFechaDeAcceso();
});

// ============================================================
// 11. ARRANQUE
// ============================================================

crearOpcionesDeColor();
(function iniciar() {
  const id = leerSesion();
  const cuenta = id ? buscarUsuarioPorId(id) : null;
  if (cuenta) {
    entrarEnAplicacion(cuenta, { bienvenida: !haySaludoHecho() });
  } else {
    if (id) borrarSesion(); // la sesión apuntaba a una cuenta que ya no existe
    mostrarAcceso();
  }
})();
