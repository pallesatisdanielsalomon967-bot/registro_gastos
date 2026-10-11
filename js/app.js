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
let estado = estadoVacio();                           // datos de esa cuenta: 3 catálogos + 3 listas de registros
let tipoActual = "gasto";                             // tipo del formulario abierto: gasto | ingreso | ahorro
let catalogoEditando = "gasto";                       // pestaña abierta en el editor de opciones
const ultimas = { gasto: "", ingreso: "", ahorro: "" }; // última opción elegida de cada tipo
let descartadosAlCargar = 0;
let periodoRanking = "mes";                           // "mes" | "todo"
let idCategoriaEditando = null;                       // null = se está creando una nueva
let confirmandoGasto = null;                          // id del gasto con el botón en "¿Borrar?"
let temporizadorGasto = null;
let temporizadorTodos = null;
let temporizadorCuenta = null;
let temporizadorCategoria = null;
let confirmandoCategoria = null;
let temporizadorAviso = null;
let diasHistorial = [];
let categoriaRecienCreada = null;                     // { tipo, id } para dejarla elegida en el formulario

function estadoVacio() {
  return { categorias: [], gastos: [], fuentes: [], ingresos: [], destinos: [], ahorros: [] };
}

/** Se queda solo con los seis campos de datos (sin `descartados`). */
function estadoDe(cargado) {
  const { descartados, ...datos } = cargado;
  return datos;
}

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
  if (pendientes.length > 0 && guardarDatos(resultado.usuario.id, { ...estadoVacio(), ...catalogosIniciales(), gastos: pendientes })) {
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
  estado = estadoDe(cargado);
  descartadosAlCargar = cargado.descartados;
  periodoRanking = "mes";
  for (const t of ORDEN_TIPOS) ultimas[t] = "";

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
  const f = totalesFinancieros(estado, hoy);
  let resumen;
  if (!ORDEN_TIPOS.some((t) => registrosDe(t).length > 0)) {
    resumen = "Aún no tienes movimientos registrados. Empieza con el primero cuando quieras.";
  } else if (f.ingresos + f.gastos + f.ahorros === 0) {
    resumen = "Todavía no has registrado movimientos este mes.";
  } else {
    resumen = `Este mes llevas ${formatearDinero(f.ingresos)} de ingresos, ${formatearDinero(f.gastos)} en gastos y ${formatearDinero(f.ahorros)} de ahorro e inversión.`;
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
  estado = estadoVacio();
  detenerDictado();
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
  const titulos = { inicio: "Inicio", gastos: "Movimientos", perfil: "Mi perfil" };
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
  if (accion === "nuevo-gasto") abrirFormulario("gasto");
  else if (accion === "nuevo-ingreso") abrirFormulario("ingreso");
  else if (accion === "nuevo-ahorro") abrirFormulario("ahorro");
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
// 5. CATÁLOGOS EDITABLES: categorías de gasto, fuentes de ingreso y destinos de ahorro
// ============================================================

const NOMBRE_OPCION = { gasto: "categoría", ingreso: "fuente de ingreso", ahorro: "destino de ahorro" };
const AYUDA_CATALOGO = {
  gasto: "Las categorías ordenan tus gastos. Cámbiales el nombre, el ícono o el color cuando quieras.",
  ingreso: "Las fuentes dicen de dónde viene tu dinero. Crea las tuyas: beca, arriendo, clases particulares…",
  ahorro: "Los destinos dicen a dónde va lo que ahorras o inviertes: una meta, un CDT, un fondo…"
};

const catalogoDe = (tipo) => estado[TIPOS[tipo].catalogo];
const registrosDe = (tipo) => estado[TIPOS[tipo].registros];

/** Llena una lista desplegable con las opciones del catálogo del tipo indicado. */
function llenarSelect(select, { tipo, primera, valor, conNueva = false }) {
  const catalogo = catalogoDe(tipo);
  select.replaceChildren(new Option(primera.texto, primera.valor));
  for (const c of catalogo) select.append(new Option(`${c.emoji} ${c.nombre}`, c.id));
  if (conNueva) select.append(new Option(`＋ Nueva ${NOMBRE_OPCION[tipo]}…`, "__nueva"));
  select.value = catalogo.some((c) => c.id === valor) || valor === "todas" ? valor : primera.valor;
}

function rellenarCategorias() {
  llenarSelect($("g-categoria"), {
    tipo: tipoActual, primera: { texto: "Elige una…", valor: "" }, valor: $("g-categoria").value, conNueva: true
  });
  const filtrando = filtroTipoActual() !== "todos";
  $("campo-filtro-categoria").hidden = !filtrando;
  if (filtrando) {
    const t = filtroTipoActual();
    $("filtro-categoria-etiqueta").textContent = `Filtrar por ${t === "gasto" ? "categoría" : t === "ingreso" ? "fuente" : "destino"}`;
    llenarSelect($("filtro-categoria"), {
      tipo: t, primera: { texto: t === "gasto" ? "Todas las categorías" : t === "ingreso" ? "Todas las fuentes" : "Todos los destinos", valor: "todas" },
      valor: $("filtro-categoria").value || "todas"
    });
  }
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

function pintarPestanasCatalogo() {
  for (const b of document.querySelectorAll("[data-cat-tipo]")) {
    b.setAttribute("aria-pressed", String(b.dataset.catTipo === catalogoEditando));
  }
  $("cat-ayuda").textContent = AYUDA_CATALOGO[catalogoEditando];
}

function abrirCategorias({ nueva = false, tipo = null } = {}) {
  catalogoEditando = tipo ?? ($("dlg-gasto").open ? tipoActual : catalogoEditando);
  $("cat-estado").textContent = "";
  ocultarFormCategoria();
  pintarPestanasCatalogo();
  renderCategorias();
  if (!$("dlg-categorias").open) $("dlg-categorias").showModal();
  if (nueva) mostrarFormCategoria(null);
}

for (const boton of document.querySelectorAll("[data-cat-tipo]")) {
  boton.addEventListener("click", () => {
    catalogoEditando = boton.dataset.catTipo;
    confirmandoCategoria = null;
    $("cat-estado").textContent = "";
    ocultarFormCategoria();
    pintarPestanasCatalogo();
    renderCategorias();
  });
}

function renderCategorias() {
  const tipo = catalogoEditando;
  const conteo = new Map();
  for (const g of registrosDe(tipo)) conteo.set(g.categoria, (conteo.get(g.categoria) ?? 0) + 1);
  const palabra = (n) => `${n} ${n === 1 ? TIPOS[tipo].nombre.toLowerCase() : TIPOS[tipo].plural}`;

  const filas = catalogoDe(tipo).map((c) => {
    const li = el("li", "cat-fila");
    li.style.setProperty("--c", `var(--cat-${c.color})`);
    const nombre = el("span", "cat-nombre", c.nombre);
    nombre.append(el("small", "", palabra(conteo.get(c.id) ?? 0)));
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
  const tipo = catalogoEditando;
  idCategoriaEditando = categoria ? categoria.id : null;
  $("cat-form-titulo").textContent = categoria ? `Editar “${categoria.nombre}”` : `Nueva ${NOMBRE_OPCION[tipo]}`;
  $("cat-nombre").value = categoria ? categoria.nombre : "";
  $("cat-emoji").value = categoria ? categoria.emoji : "";
  const color = categoria ? categoria.color : siguienteColorLibre(catalogoDe(tipo));
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
  const tipo = catalogoEditando;
  const T = TIPOS[tipo];
  const editar = e.target.closest("[data-editar]");
  if (editar) {
    $("cat-estado").textContent = "";
    mostrarFormCategoria(buscarCategoria(catalogoDe(tipo), editar.dataset.editar));
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
    const afectados = registrosDe(tipo).filter((g) => g.categoria === id).length;
    $("cat-estado").textContent = afectados > 0
      ? `Toca otra vez para borrarla. Sus ${afectados} ${afectados === 1 ? T.nombre.toLowerCase() : T.plural} pasarán a “Otros”.`
      : "Toca otra vez para borrarla.";
    return;
  }
  clearTimeout(temporizadorCategoria);
  confirmandoCategoria = null;
  const resultado = eliminarCategoria(catalogoDe(tipo), registrosDe(tipo), id);
  if (!resultado) return;
  if (!confirmarCambio({ ...estado, [T.catalogo]: resultado.categorias, [T.registros]: resultado.gastos }, $("cat-estado"))) return;
  if (idCategoriaEditando === id) ocultarFormCategoria();
  $("cat-estado").textContent = resultado.movidos > 0
    ? `Opción eliminada. ${resultado.movidos} ${resultado.movidos === 1 ? "registro pasó" : "registros pasaron"} a “Otros”.`
    : "Opción eliminada.";
  renderCategorias();
  rellenarCategorias();
  renderVista();
});

$("cat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const tipo = catalogoEditando;
  const T = TIPOS[tipo];
  const seleccionado = document.querySelector('input[name="cat-color"]:checked');
  const entrada = { nombre: $("cat-nombre").value, emoji: $("cat-emoji").value, color: seleccionado ? seleccionado.value : "" };
  const problema = validarCategoria(entrada, catalogoDe(tipo), idCategoriaEditando);
  if (problema) {
    $("cat-error").textContent = problema;
    return;
  }
  const nueva = idCategoriaEditando === null ? crearCategoria(entrada) : null;
  const lista = nueva
    ? [...catalogoDe(tipo), nueva]
    : actualizarCategoria(catalogoDe(tipo), idCategoriaEditando, entrada);
  if (!confirmarCambio({ ...estado, [T.catalogo]: lista }, $("cat-error"))) return;

  const eraNueva = nueva !== null;
  if (nueva) categoriaRecienCreada = { tipo, id: nueva.id };
  ocultarFormCategoria();
  $("cat-estado").textContent = eraNueva ? "Opción creada y guardada." : "Cambios guardados.";
  renderCategorias();
  rellenarCategorias();
  renderVista();
});

$("cat-form").addEventListener("input", () => { $("cat-error").textContent = ""; });

$("dlg-categorias").addEventListener("close", () => {
  confirmandoCategoria = null;
  clearTimeout(temporizadorCategoria);
  rellenarCategorias();
  // Si se creó una opción desde el formulario de movimientos, queda elegida para ahorrar un paso
  if (categoriaRecienCreada && $("dlg-gasto").open && categoriaRecienCreada.tipo === tipoActual) {
    $("g-categoria").value = categoriaRecienCreada.id;
  }
  categoriaRecienCreada = null;
});

// ============================================================
// 6. FORMULARIO DE MOVIMIENTO: gasto, ingreso o ahorro (categoría, monto, descripción, fecha)
// ============================================================

const TEXTOS_TIPO = {
  gasto:   { titulo: "Nuevo gasto",              editar: "Editar categorías", guardar: "Guardar gasto",   ejemploDesc: "Ej: Almuerzo en la universidad", ejemploFrase: "Ej: Gasté quince mil en almuerzo ayer" },
  ingreso: { titulo: "Nuevo ingreso",            editar: "Editar fuentes",    guardar: "Guardar ingreso", ejemploDesc: "Ej: Pago de clases particulares", ejemploFrase: "Ej: Me pagaron cien mil por clases hoy" },
  ahorro:  { titulo: "Nuevo ahorro o inversión", editar: "Editar destinos",   guardar: "Guardar ahorro",  ejemploDesc: "Ej: Aporte al fondo de emergencia", ejemploFrase: "Ej: Ahorré veinte mil para mi meta" }
};

/** Cambia el tipo del formulario y ajusta títulos, etiquetas y la lista de opciones. */
function ponerTipo(tipo) {
  tipoActual = tipo;
  const textos = TEXTOS_TIPO[tipo];
  for (const b of document.querySelectorAll("[data-tipo]")) b.setAttribute("aria-pressed", String(b.dataset.tipo === tipo));
  $("gasto-titulo").textContent = textos.titulo;
  $("g-categoria-etiqueta").textContent = TIPOS[tipo].campo;
  $("g-editar-categorias").textContent = textos.editar;
  $("g-guardar").textContent = textos.guardar;
  $("g-descripcion").placeholder = textos.ejemploDesc;
  $("g-frase").placeholder = textos.ejemploFrase;
  $("g-categoria").value = "";
  rellenarCategorias();
  $("g-categoria").value = catalogoDe(tipo).some((c) => c.id === ultimas[tipo]) ? ultimas[tipo] : "";
  $("g-categoria").classList.remove("leido");
}

function abrirFormulario(tipo) {
  if (!usuario) return;
  detenerDictado();
  $("form-gasto").reset();
  ponerTipo(tipo);
  const hoy = fechaDeHoy();
  $("g-fecha").value = hoy;
  $("g-fecha").max = hoy; // el calendario no deja elegir fechas futuras
  $("g-error").textContent = "";
  for (const campo of $("form-gasto").querySelectorAll(".leido")) campo.classList.remove("leido");
  const dictado = Reconocimiento ? "dicta" : "escribe";
  mensajeEscaner(`Puedes ${dictado} una frase, pegar un mensaje o fotografiar un recibo, y yo propongo los datos. Tú los revisas antes de guardar.`);
  prepararBotonDictado();
  if (!$("dlg-gasto").open) $("dlg-gasto").showModal();
  $("g-categoria").focus();
}

for (const boton of document.querySelectorAll("[data-tipo]")) {
  boton.addEventListener("click", () => {
    if (boton.dataset.tipo !== tipoActual) ponerTipo(boton.dataset.tipo);
  });
}

// "＋ Nueva …" dentro de la lista abre el editor ya listo para crear una opción
let categoriaPrevia = "";
$("g-categoria").addEventListener("focus", () => { categoriaPrevia = $("g-categoria").value; });
$("g-categoria").addEventListener("change", () => {
  if ($("g-categoria").value === "__nueva") {
    $("g-categoria").value = categoriaPrevia === "__nueva" ? "" : categoriaPrevia;
    abrirCategorias({ nueva: true, tipo: tipoActual });
  }
  categoriaPrevia = $("g-categoria").value;
});
$("g-editar-categorias").addEventListener("click", () => abrirCategorias({ tipo: tipoActual }));

$("form-gasto").addEventListener("input", () => { $("g-error").textContent = ""; });

$("form-gasto").addEventListener("submit", (e) => {
  e.preventDefault();
  const tipo = tipoActual;
  const T = TIPOS[tipo];
  const entrada = {
    categoria: $("g-categoria").value,
    monto: $("g-monto").value,
    descripcion: $("g-descripcion").value,
    fecha: $("g-fecha").value
  };
  const problema = validarGasto(entrada, catalogoDe(tipo), fechaDeHoy(), tipo);
  if (problema) {
    $("g-error").textContent = problema;
    return;
  }
  const registro = crearGasto(entrada);
  if (!confirmarCambio({ ...estado, [T.registros]: [...registrosDe(tipo), registro] }, $("g-error"))) return;

  ultimas[tipo] = registro.categoria;
  const opcion = buscarCategoria(catalogoDe(tipo), registro.categoria);
  $("dlg-gasto").close();
  mostrarAviso(`${T.nombre} guardado: ${formatearDinero(registro.monto)} · ${opcion.nombre}`);
  renderVista();
});

// ============================================================
// 6a. DICTADO POR VOZ Y FRASES ESCRITAS O PEGADAS
// ============================================================
// El navegador convierte la voz en texto (API de reconocimiento de voz). OJO: en Chrome y Edge
// ese audio se envía al servicio de voz del fabricante; esta página no lo recibe ni lo guarda.
// La frase resultante se interpreta aquí, en el dispositivo, y solo PROPONE datos.

const Reconocimiento = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
let reconocimiento = null;
let escuchando = false;
let errorDictado = false;

function prepararBotonDictado() {
  const boton = $("g-dictar");
  boton.disabled = !Reconocimiento;
  boton.classList.remove("escuchando");
  boton.setAttribute("aria-pressed", "false");
  $("g-dictar-texto").textContent = Reconocimiento ? "Dictar" : "Dictado no disponible";
  boton.title = Reconocimiento ? "" : "Este navegador no permite dictar. Escribe o pega la frase.";
}

function detenerDictado() {
  if (reconocimiento) {
    const r = reconocimiento;
    reconocimiento = null;
    r.onresult = r.onerror = r.onend = null;
    try { r.abort(); } catch { /* nada */ }
  }
  escuchando = false;
  if ($("g-dictar")) prepararBotonDictado();
}

const ERRORES_DICTADO = {
  "not-allowed": "No tengo permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentar.",
  "service-not-allowed": "Este navegador no deja usar el dictado aquí. Escribe o pega la frase.",
  "no-speech": "No escuché nada. Acerca el micrófono y prueba de nuevo.",
  "audio-capture": "No encontré un micrófono disponible.",
  "network": "El dictado necesita internet (el navegador usa su servicio de voz). Revisa la conexión o escribe la frase.",
  "language-not-supported": "El navegador no soporta dictado en español."
};

function iniciarDictado() {
  if (!Reconocimiento || escuchando) return;
  const r = new Reconocimiento();
  r.lang = "es-CO";
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  errorDictado = false;
  reconocimiento = r;

  r.onresult = (evento) => {
    let texto = "";
    for (const resultado of evento.results) texto += resultado[0].transcript;
    $("g-frase").value = texto.trim().slice(0, 200);
  };
  r.onerror = (evento) => {
    errorDictado = true;
    mensajeEscaner(ERRORES_DICTADO[evento.error] ?? "El dictado se interrumpió. Prueba otra vez o escribe la frase.", true);
  };
  r.onend = () => {
    const habiaFrase = $("g-frase").value.trim() !== "";
    escuchando = false;
    reconocimiento = null;
    prepararBotonDictado();
    if (!errorDictado && habiaFrase) interpretarFrase();
    else if (!errorDictado) mensajeEscaner("No escuché nada. Prueba otra vez o escribe la frase.", true);
  };

  try {
    r.start();
  } catch (problema) {
    console.warn("No se pudo iniciar el dictado:", problema);
    reconocimiento = null;
    mensajeEscaner("No se pudo iniciar el dictado. Escribe o pega la frase.", true);
    return;
  }
  escuchando = true;
  $("g-frase").value = "";
  $("g-dictar").classList.add("escuchando");
  $("g-dictar").setAttribute("aria-pressed", "true");
  $("g-dictar-texto").textContent = "Detener";
  mensajeEscaner("Escuchando… di, por ejemplo: “gasté quince mil en almuerzo ayer”. El navegador envía el audio a su servicio de voz.");
}

$("g-dictar").addEventListener("click", () => {
  if (escuchando && reconocimiento) reconocimiento.stop(); // al terminar, onend interpreta lo dicho
  else iniciarDictado();
});

function interpretarFrase() {
  const frase = $("g-frase").value.trim();
  if (frase === "") {
    mensajeEscaner("Escribe, pega o dicta una frase primero.", true);
    return;
  }
  const leido = parsearDictado(frase, estado, fechaDeHoy(), tipoActual);
  if (leido.tipo !== tipoActual) ponerTipo(leido.tipo);
  aplicarDatos(leido, "frase");
}

$("g-interpretar").addEventListener("click", interpretarFrase);
$("g-frase").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); interpretarFrase(); } // Enter interpreta, no guarda
});


// ============================================================
// 6b. ESCANEAR RECIBO (OCR en el propio dispositivo)
// ============================================================
// El lector (Tesseract) vive en vendor/tesseract y solo se descarga cuando se usa.
// La foto NO se sube a ningún sitio ni se guarda: se lee en el navegador y se descarta.
// El OCR se equivoca, por eso solo PROPONE datos: la persona revisa antes de guardar.

const LADO_MAXIMO_RECIBO = 1800;
const ESPERA_MAXIMA_OCR_MS = 120000;
let lectorOcr = null;
let escaneando = false;

function ruta(relativa) { return new URL(relativa, location.href).href; }

function cargarScript(src) {
  return new Promise((resolver, rechazar) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolver;
    script.onerror = () => rechazar(new Error(`No se pudo cargar ${src}`));
    document.head.append(script);
  });
}

function mensajeEscaner(texto, esError = false) {
  const nodo = $("g-escaner-estado");
  nodo.textContent = texto;
  nodo.classList.toggle("hay-error", esError);
}

async function obtenerLector() {
  if (lectorOcr) return lectorOcr;
  mensajeEscaner("Preparando el lector (la primera vez descarga unos 6 MB)…");
  if (!globalThis.Tesseract) await cargarScript(ruta("vendor/tesseract/tesseract.min.js"));
  lectorOcr = await Tesseract.createWorker("spa", 1, {
    workerPath: ruta("vendor/tesseract/worker.min.js"),
    corePath: ruta("vendor/tesseract/"),
    langPath: ruta("vendor/tesseract/lang"),
    logger: (m) => {
      if (m.status === "recognizing text") mensajeEscaner(`Leyendo el recibo… ${Math.round(m.progress * 100)} %`);
    }
  });
  return lectorOcr;
}

/** Reduce la foto y sube el contraste (gris + estirar niveles): el OCR lee mejor así. */
async function prepararImagenParaOcr(archivo) {
  const imagen = await cargarImagen(archivo);
  const escala = Math.min(1, LADO_MAXIMO_RECIBO / Math.max(imagen.naturalWidth, imagen.naturalHeight));
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(imagen, 0, 0, ancho, alto);

  const pixeles = ctx.getImageData(0, 0, ancho, alto);
  const d = pixeles.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gris = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = gris;
    if (gris < min) min = gris;
    if (gris > max) max = gris;
  }
  const rango = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(((d[i] - min) / rango) * 255);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(pixeles, 0, 0);
  return lienzo;
}

function marcarLeido(campo) {
  campo.classList.add("leido");
  campo.addEventListener("input", () => campo.classList.remove("leido"), { once: true });
  campo.addEventListener("change", () => campo.classList.remove("leido"), { once: true });
}

/** Pone en el formulario los datos propuestos (del recibo o de una frase) y los marca para revisarlos. */
function aplicarDatos(datosLeidos, origen) {
  const partes = [];
  if (origen === "frase") partes.push(`tipo ${TIPOS[tipoActual].nombre.toLowerCase()}`);
  if (datosLeidos.categoria) {
    $("g-categoria").value = datosLeidos.categoria;
    marcarLeido($("g-categoria"));
    partes.push(`${TIPOS[tipoActual].campo.toLowerCase()} ${buscarCategoria(catalogoDe(tipoActual), datosLeidos.categoria).nombre}`);
  }
  if (datosLeidos.monto) {
    $("g-monto").value = String(datosLeidos.monto);
    marcarLeido($("g-monto"));
    partes.push(`monto ${formatearDinero(datosLeidos.monto)}`);
  }
  if (datosLeidos.descripcion) {
    $("g-descripcion").value = datosLeidos.descripcion;
    marcarLeido($("g-descripcion"));
    partes.push(`descripción “${datosLeidos.descripcion}”`);
  }
  if (datosLeidos.fecha) {
    $("g-fecha").value = datosLeidos.fecha;
    marcarLeido($("g-fecha"));
    partes.push(`fecha ${formatearFecha(datosLeidos.fecha)}`);
  }
  if (!datosLeidos.monto && !datosLeidos.descripcion && !datosLeidos.categoria && !datosLeidos.fecha) {
    mensajeEscaner(origen === "recibo"
      ? "No pude leer datos claros. Prueba con más luz, sin arrugas y enfocando el total, o escribe los datos a mano."
      : "No entendí datos claros en esa frase. Prueba con algo como “gasté quince mil en almuerzo ayer”.", true);
    return;
  }
  let aviso = `Propuse: ${partes.join(", ")}. Los campos marcados vienen ${origen === "recibo" ? "del recibo" : "de la frase"}: revísalos antes de guardar.`;
  if (datosLeidos.origenMonto === "mayor") aviso += " No encontré la línea de TOTAL; tomé el monto más grande, verifícalo.";
  if (!datosLeidos.monto) aviso += " No encontré el monto: escríbelo tú.";
  mensajeEscaner(aviso);
}

$("g-recibo").addEventListener("change", async (e) => {
  const archivo = e.target.files[0];
  e.target.value = "";
  if (!archivo || escaneando) return;
  if (!archivo.type.startsWith("image/")) {
    mensajeEscaner("Ese archivo no es una imagen. Elige una foto JPG o PNG.", true);
    return;
  }
  if (archivo.size > PESO_MAXIMO_FOTO) {
    mensajeEscaner("La imagen pesa más de 10 MB. Elige una más liviana.", true);
    return;
  }
  escaneando = true;
  $("g-recibo").disabled = true;
  try {
    mensajeEscaner("Preparando la imagen…");
    const imagen = await prepararImagenParaOcr(archivo);
    const lector = await obtenerLector();
    mensajeEscaner("Leyendo el recibo…");
    const resultado = await Promise.race([
      lector.recognize(imagen),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("tiempo agotado")), ESPERA_MAXIMA_OCR_MS))
    ]);
    aplicarDatos(parsearRecibo(resultado.data.text, catalogoDe(tipoActual), fechaDeHoy(), tipoActual), "recibo");
  } catch (problema) {
    console.warn("No se pudo escanear el recibo:", problema);
    await cerrarLector(); // el lector pudo quedar en mal estado: la próxima vez se crea de nuevo
    mensajeEscaner("No se pudo leer ese recibo. Puede que tu navegador no sea compatible o que falten los archivos de la carpeta vendor. Escribe los datos a mano.", true);
  } finally {
    escaneando = false;
    $("g-recibo").disabled = false;
  }
});

async function cerrarLector() {
  const lector = lectorOcr;
  lectorOcr = null;
  if (lector) { try { await lector.terminate(); } catch { /* nada */ } }
}

// Al cerrar el formulario se libera la memoria del lector (usa bastante) y se corta el micrófono
$("dlg-gasto").addEventListener("close", () => { cerrarLector(); detenerDictado(); });

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
  renderResumenFinanciero(hoy);
  renderGraficoCategorias(hoy);
  renderGraficoHistorial(hoy);
  renderGraficoResumen(hoy);
  renderGraficoIngresos(hoy);
  renderGraficoAhorros();
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

// ----- Resumen de números del mes (ingresos, gastos, ahorro y balance) -----
function renderResumenFinanciero(hoy) {
  const f = totalesFinancieros(estado, hoy);
  $("kpi-ingresos").textContent = formatearDinero(f.ingresos);
  $("kpi-gastos").textContent = formatearDinero(f.gastos);
  $("kpi-ahorros").textContent = formatearDinero(f.ahorros);
  $("kpi-balance").textContent = `${f.balance < 0 ? "−" : ""}${formatearDinero(Math.abs(f.balance))}`;
  document.querySelector(".kpi-balance").classList.toggle("negativo", f.balance < 0);
  $("kpi-balance-nota").textContent = f.balance < 0
    ? "Gastaste y ahorraste más de lo que entró"
    : f.balance > 0 ? "Te queda disponible este mes" : "Ingresos − gastos − ahorro";
}

// ----- Gráfico 4: ingresos de los últimos 6 meses, por fuente -----
let mesesIngresos = [];
function renderGraficoIngresos(hoy) {
  mesesIngresos = ingresosPorMes(estado.ingresos, estado.fuentes, hoy, 6);
  const suma = mesesIngresos.reduce((s, m) => s + m.total, 0);
  const hayDatos = suma > 0;
  $("g4-leyenda").hidden = !hayDatos;
  $("g4-nota").hidden = !hayDatos;

  if (!hayDatos) {
    $("g4-titular").textContent = "";
    alternarVacio("g4-vacio", "g4-grafico", "Registra tu primer ingreso (menú → Registrar ingreso) y aquí verás de dónde viene tu dinero mes a mes.");
    llenarTabla("g4-tabla", []);
    return;
  }
  alternarVacio("g4-vacio", "g4-grafico", "");
  const mejor = mesesIngresos.reduce((a, b) => (b.total > a.total ? b : a));
  $("g4-titular").textContent = `${formatearDinero(suma)} en 6 meses · mejor mes: ${mejor.nombre.split(" de ")[0]} (${formatearDinero(mejor.total)})`;
  pintarIngresos6Meses($("g4-grafico"), mesesIngresos);

  // La leyenda lleva solo las fuentes que aparecen; el color sigue a la fuente, no a su posición
  const usadas = estado.fuentes.filter((f) => mesesIngresos.some((m) => m.porFuente.some((p) => p.id === f.id)));
  $("g4-leyenda").replaceChildren(...usadas.map((f) => {
    const li = el("li", "leyenda-item");
    li.style.setProperty("--c", `var(--cat-${f.color})`);
    li.append(el("span", "leyenda-marca"), el("span", "", `${f.emoji} ${f.nombre}`));
    return li;
  }));
  $("g4-nota").textContent = "El último mes está en curso: puede seguir subiendo.";
  llenarTabla("g4-tabla", [...mesesIngresos].reverse().map((m) => [
    m.nombre.charAt(0).toUpperCase() + m.nombre.slice(1),
    formatearDinero(m.total),
    m.porFuente.length === 0 ? "—" : m.porFuente.map((p) => `${p.nombre} ${formatearDinero(p.total)}`).join(" · ")
  ]));
}

let anchoIngresos = 0;
new ResizeObserver((entradas) => {
  const ancho = Math.round(entradas[0].contentRect.width);
  if (ancho === 0 || ancho === anchoIngresos || mesesIngresos.length === 0 || $("g4-grafico").hidden) return;
  anchoIngresos = ancho;
  pintarIngresos6Meses($("g4-grafico"), mesesIngresos);
}).observe($("g4-grafico"));

// ----- Ahorro e inversión: total acumulado por destino -----
function renderGraficoAhorros() {
  const ranking = rankingCategorias(estado.ahorros, estado.destinos);
  if (ranking.length === 0) {
    $("g5-titular").textContent = "";
    alternarVacio("g5-vacio", "g5-grafico", "Registra tu primer ahorro o inversión (menú → Registrar ahorro) y aquí verás a dónde va.");
    llenarTabla("g5-tabla", []);
    return;
  }
  alternarVacio("g5-vacio", "g5-grafico", "");
  const f = totalesFinancieros(estado, fechaDeHoy());
  $("g5-titular").textContent = `${formatearDinero(f.ahorradoTotal)} acumulados · ${formatearDinero(f.ahorros)} este mes`;
  pintarRanking($("g5-grafico"), ranking, { singular: "registro", plural: "registros", otras: "Otros destinos" });
  llenarTabla("g5-tabla", ranking.map((r) => [
    `${r.emoji} ${r.nombre}`, formatearDinero(r.total), `${Math.round(r.porcentaje)} %`, String(r.cantidad)
  ]));
}

// ============================================================
// 7b. COMPARTIR EL RESUMEN POR WHATSAPP
// ============================================================

function actualizarEnlaceWhatsApp() {
  // wa.me abre WhatsApp con el mensaje escrito; la persona elige el contacto y confirma el envío
  $("wa-enlace").href = `https://wa.me/?text=${encodeURIComponent($("wa-texto").value)}`;
}

$("g3-whatsapp").addEventListener("click", () => {
  const hoy = fechaDeHoy();
  const delMes = gastosEntre(estado.gastos, `${hoy.slice(0, 7)}-01`, hoy);
  $("wa-texto").value = textoResumenWhatsApp({
    nombre: primerNombre(),
    hoy,
    resumen: resumenMes(estado.gastos, hoy),
    ranking: rankingCategorias(delMes, estado.categorias),
    formatoDinero: formatearDinero,
    finanzas: totalesFinancieros(estado, hoy)
  });
  $("wa-estado").textContent = "";
  actualizarEnlaceWhatsApp();
  $("dlg-whatsapp").showModal();
});

$("wa-texto").addEventListener("input", actualizarEnlaceWhatsApp);

$("wa-copiar").addEventListener("click", async () => {
  const texto = $("wa-texto").value;
  try {
    await navigator.clipboard.writeText(texto);
    $("wa-estado").textContent = "Texto copiado.";
  } catch {
    $("wa-texto").select(); // si el navegador no deja copiar solo, queda seleccionado para Ctrl+C
    $("wa-estado").textContent = "Selecciona el texto y cópialo con Ctrl+C.";
  }
});

// ============================================================
// 8. VISTA MOVIMIENTOS (gastos, ingresos y ahorros juntos)
// ============================================================

const filtroTipoActual = () => $("filtro-tipo").value || "todos";

/** Los tres tipos en una sola lista; cada registro lleva su `tipo`. */
function listaDeMovimientos() {
  const todos = [];
  for (const tipo of ORDEN_TIPOS) for (const r of registrosDe(tipo)) todos.push({ ...r, tipo });
  return todos;
}

const PREFIJO_MONTO = { gasto: "−", ingreso: "+", ahorro: "" };

function renderGastos() {
  rellenarCategorias();
  const tipo = filtroTipoActual();
  const categoria = $("filtro-categoria").value || "todas";
  const hayAlgo = ORDEN_TIPOS.some((t) => registrosDe(t).length > 0);

  let visibles = listaDeMovimientos();
  if (tipo !== "todos") visibles = visibles.filter((m) => m.tipo === tipo);
  if (tipo !== "todos" && categoria !== "todas") visibles = visibles.filter((m) => m.categoria === categoria);
  visibles = ordenarPorFecha(visibles);

  if (!hayAlgo) {
    $("gastos-resumen").textContent = "Sin movimientos registrados";
  } else if (tipo === "todos") {
    const suma = (t) => calcularTotal(visibles.filter((m) => m.tipo === t));
    $("gastos-resumen").textContent = `${visibles.length} ${visibles.length === 1 ? "movimiento" : "movimientos"} · Ingresos ${formatearDinero(suma("ingreso"))} · Gastos ${formatearDinero(suma("gasto"))} · Ahorro ${formatearDinero(suma("ahorro"))}`;
  } else {
    const T = TIPOS[tipo];
    $("gastos-resumen").textContent = `${visibles.length} ${visibles.length === 1 ? T.nombre.toLowerCase() : T.plural} · ${formatearDinero(calcularTotal(visibles))}`;
  }

  let vacio = "";
  if (!hayAlgo) vacio = "Aún no registras movimientos. Toca “Nuevo gasto” o usa el menú para registrar un ingreso o un ahorro.";
  else if (visibles.length === 0) vacio = "No hay movimientos con ese filtro.";
  $("lista-vacia").hidden = vacio === "";
  $("lista-vacia").textContent = vacio;
  $("boton-borrar-todo").hidden = !hayAlgo;

  $("lista-gastos").replaceChildren(...visibles.map((mov) => {
    const catalogo = catalogoDe(mov.tipo);
    const opcion = buscarCategoria(catalogo, mov.categoria) ?? buscarCategoria(catalogo, ID_OTROS);
    const li = el("li", `gasto gasto-${mov.tipo}`);
    li.style.setProperty("--c", `var(--cat-${opcion.color})`);

    const icono = el("span", "gasto-icono", opcion.emoji);
    icono.setAttribute("aria-hidden", "true");

    const info = el("div", "gasto-info");
    // textContent (y no innerHTML) evita que alguien inyecte código HTML en la página
    info.append(el("strong", "", mov.descripcion), el("small", "", `${TIPOS[mov.tipo].nombre} · ${opcion.nombre} · ${formatearFecha(mov.fecha)}`));

    const clave = `${mov.tipo}:${mov.id}`;
    const confirmando = confirmandoGasto === clave;
    const borrar = el("button", confirmando ? "boton-eliminar boton-confirmar" : "boton-eliminar", confirmando ? "¿Borrar?" : "Borrar");
    borrar.type = "button";
    borrar.dataset.id = mov.id; // guardamos tipo e id para saber cuál borrar
    borrar.dataset.tipo = mov.tipo;
    borrar.setAttribute("aria-label", `Borrar ${mov.descripcion}`);

    const monto = el("span", `gasto-monto monto-${mov.tipo}`, `${PREFIJO_MONTO[mov.tipo]}${formatearDinero(mov.monto)}`);
    li.append(icono, info, monto, borrar);
    return li;
  }));
}

$("filtro-tipo").addEventListener("change", () => {
  $("filtro-categoria").value = "todas"; // las opciones del filtro cambian con el tipo
  renderGastos();
});
$("filtro-categoria").addEventListener("change", renderGastos);

// "Delegación de eventos": un solo escuchador en la lista atiende todos los botones
$("lista-gastos").addEventListener("click", (e) => {
  const boton = e.target.closest(".boton-eliminar");
  if (!boton) return;
  const { id, tipo } = boton.dataset;
  const clave = `${tipo}:${id}`;
  if (confirmandoGasto !== clave) {
    confirmandoGasto = clave;
    clearTimeout(temporizadorGasto);
    temporizadorGasto = setTimeout(() => { confirmandoGasto = null; renderGastos(); }, 4000);
    renderGastos();
    return;
  }
  clearTimeout(temporizadorGasto);
  confirmandoGasto = null;
  const T = TIPOS[tipo];
  if (!confirmarCambio({ ...estado, [T.registros]: registrosDe(tipo).filter((g) => g.id !== id) }, $("lista-vacia"))) {
    $("lista-vacia").hidden = false;
    return;
  }
  renderGastos();
  mostrarAviso(`${T.nombre} borrado`);
});

// "Borrar todos": primer toque pide confirmar, el segundo borra (4 s para decidir)
const TEXTO_BORRAR_TODO = "Borrar todos los movimientos";
$("boton-borrar-todo").addEventListener("click", () => {
  const boton = $("boton-borrar-todo");
  if (!temporizadorTodos) {
    boton.textContent = "¿Seguro? Se borran gastos, ingresos y ahorros. Toca otra vez";
    temporizadorTodos = setTimeout(() => { boton.textContent = TEXTO_BORRAR_TODO; temporizadorTodos = null; }, 4000);
    return;
  }
  clearTimeout(temporizadorTodos);
  temporizadorTodos = null;
  boton.textContent = TEXTO_BORRAR_TODO;
  if (!confirmarCambio({ ...estado, gastos: [], ingresos: [], ahorros: [] }, $("lista-vacia"))) {
    $("lista-vacia").hidden = false;
    return;
  }
  renderGastos();
  mostrarAviso("Se borraron todos los movimientos");
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
    estado = estadoDe(cargado);
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
