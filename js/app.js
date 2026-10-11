/*
 * app.js — Conecta la lógica (logica.js) con la página (index.html).
 *
 * Flujo general:
 *   1. Al abrir la página se cargan los gastos guardados (localStorage).
 *   2. El usuario hace algo (agregar, borrar, filtrar) -> se escucha con eventos.
 *   3. Se actualizan los datos, se guardan y se vuelve a "pintar" la pantalla (render).
 */
"use strict";

// Nombre con el que se guardan los datos. El ":v1" permite cambiar el formato
// en el futuro sin mezclarlo con datos viejos.
const CLAVE_ALMACENAMIENTO = "registro-gastos:v1";

// ---------- 1. Referencias a elementos del HTML ----------
const formulario = document.getElementById("formulario-gasto");
const campoDescripcion = document.getElementById("descripcion");
const campoMonto = document.getElementById("monto");
const campoCategoria = document.getElementById("categoria");
const campoFecha = document.getElementById("fecha");
const mensajeError = document.getElementById("mensaje-error");

const totalGeneral = document.getElementById("total-general");
const totalMes = document.getElementById("total-mes");
const cantidadGastos = document.getElementById("cantidad-gastos");
const grafico = document.getElementById("grafico-categorias");
const graficoVacio = document.getElementById("grafico-vacio");

const filtroCategoria = document.getElementById("filtro-categoria");
const listaGastos = document.getElementById("lista-gastos");
const listaVacia = document.getElementById("lista-vacia");
const botonBorrarTodo = document.getElementById("boton-borrar-todo");

// ---------- 2. Datos (estado de la aplicación) ----------
let gastos = cargarGastos();

/** Lee los gastos guardados. Si algo falla, empieza con una lista vacía. */
function cargarGastos() {
  try {
    const texto = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (!texto) return [];
    const datos = JSON.parse(texto); // de texto a objetos de JavaScript
    if (!Array.isArray(datos)) return [];
    // Descarta registros dañados en vez de dejar que rompan la página
    return datos.filter((g) => g && typeof g.id === "string" && validarGasto(g) === "");
  } catch (error) {
    console.warn("No se pudieron leer los gastos guardados:", error);
    return [];
  }
}

/** Guarda la lista actual. Devuelve true si se pudo guardar. */
function guardarGastos() {
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(gastos)); // de objetos a texto
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los gastos:", error);
    mostrarError("No se pudo guardar. Revisa que tu navegador permita guardar datos.");
    return false;
  }
}

// ---------- 3. Funciones de interfaz ----------

function mostrarError(texto) {
  mensajeError.textContent = texto;
}

/** Llena los dos <select> a partir del objeto CATEGORIAS. */
function llenarCategorias() {
  campoCategoria.append(new Option("Elige una…", ""));
  filtroCategoria.append(new Option("Todas las categorías", "todas"));

  for (const [clave, categoria] of Object.entries(CATEGORIAS)) {
    const texto = `${categoria.emoji} ${categoria.nombre}`;
    campoCategoria.append(new Option(texto, clave));
    filtroCategoria.append(new Option(texto, clave));
  }
}

/** Pinta los totales y el gráfico de barras. */
function renderResumen() {
  totalGeneral.textContent = formatearDinero(calcularTotal(gastos));
  totalMes.textContent = formatearDinero(totalDelMes(gastos, fechaDeHoy()));
  cantidadGastos.textContent = gastos.length;

  // Ordenamos las categorías de mayor a menor gasto
  const totales = Object.entries(totalesPorCategoria(gastos)).sort((a, b) => b[1] - a[1]);
  const maximo = totales.length > 0 ? totales[0][1] : 0;

  grafico.replaceChildren(); // borra lo que había antes
  graficoVacio.hidden = totales.length > 0;

  for (const [clave, total] of totales) {
    const categoria = CATEGORIAS[clave];
    const elemento = document.createElement("li");
    elemento.className = "barra-fila";

    const etiqueta = document.createElement("span");
    etiqueta.className = "barra-etiqueta";
    etiqueta.textContent = `${categoria.emoji} ${categoria.nombre}`;

    const pista = document.createElement("span");
    pista.className = "barra-pista";
    const relleno = document.createElement("span");
    relleno.className = "barra-relleno";
    relleno.style.width = `${(total / maximo) * 100}%`;
    relleno.style.backgroundColor = categoria.color;
    pista.append(relleno);

    const valor = document.createElement("span");
    valor.className = "barra-valor";
    valor.textContent = formatearDinero(total);

    elemento.append(etiqueta, pista, valor);
    grafico.append(elemento);
  }
}

/** Pinta la lista del historial según el filtro elegido. */
function renderLista() {
  const visibles = ordenarPorFecha(filtrarPorCategoria(gastos, filtroCategoria.value));

  listaGastos.replaceChildren();
  listaVacia.hidden = visibles.length > 0;
  botonBorrarTodo.hidden = gastos.length === 0;

  for (const gasto of visibles) {
    const categoria = CATEGORIAS[gasto.categoria];
    const elemento = document.createElement("li");
    elemento.className = "gasto";

    const icono = document.createElement("span");
    icono.className = "gasto-icono";
    icono.style.backgroundColor = categoria.color;
    icono.textContent = categoria.emoji;
    icono.setAttribute("aria-hidden", "true");

    const info = document.createElement("div");
    info.className = "gasto-info";
    const descripcion = document.createElement("strong");
    // textContent (y no innerHTML) evita que alguien inyecte código HTML en la página
    descripcion.textContent = gasto.descripcion;
    const detalle = document.createElement("small");
    detalle.textContent = `${categoria.nombre} · ${formatearFecha(gasto.fecha)}`;
    info.append(descripcion, detalle);

    const monto = document.createElement("span");
    monto.className = "gasto-monto";
    monto.textContent = formatearDinero(gasto.monto);

    const botonEliminar = document.createElement("button");
    botonEliminar.type = "button";
    botonEliminar.className = "boton-eliminar";
    botonEliminar.dataset.id = gasto.id; // guardamos el id para saber cuál borrar
    botonEliminar.setAttribute("aria-label", `Eliminar ${gasto.descripcion}`);
    botonEliminar.textContent = "✕";

    elemento.append(icono, info, monto, botonEliminar);
    listaGastos.append(elemento);
  }
}

/** Vuelve a pintar todo lo que depende de los datos. */
function render() {
  renderResumen();
  renderLista();
}

// ---------- 4. Eventos (lo que hace el usuario) ----------

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault(); // evita que el navegador recargue la página

  const datos = {
    descripcion: campoDescripcion.value,
    monto: campoMonto.value,
    categoria: campoCategoria.value,
    fecha: campoFecha.value
  };

  const error = validarGasto(datos);
  if (error) {
    mostrarError(error);
    return; // no seguimos si hay error
  }

  gastos.push(crearGasto(datos));
  if (!guardarGastos()) return;

  mostrarError("");
  formulario.reset();
  campoFecha.value = fechaDeHoy();
  campoDescripcion.focus();
  render();
});

// Al corregir cualquier campo, se borra el mensaje de error anterior
formulario.addEventListener("input", () => mostrarError(""));

// "Delegación de eventos": un solo escuchador en la lista atiende todos los botones
listaGastos.addEventListener("click", (evento) => {
  const boton = evento.target.closest(".boton-eliminar");
  if (!boton) return;

  gastos = gastos.filter((gasto) => gasto.id !== boton.dataset.id);
  guardarGastos();
  render();
});

filtroCategoria.addEventListener("change", renderLista);

// Confirmación de doble toque: el primer clic pide confirmar, el segundo borra.
// Si no se confirma en 4 segundos, el botón vuelve a su estado normal.
const TEXTO_BORRAR = "Borrar todos los gastos";
let esperaConfirmacion = null;

botonBorrarTodo.addEventListener("click", () => {
  if (!esperaConfirmacion) {
    botonBorrarTodo.textContent = "¿Seguro? Toca otra vez para borrar todo";
    esperaConfirmacion = setTimeout(() => {
      botonBorrarTodo.textContent = TEXTO_BORRAR;
      esperaConfirmacion = null;
    }, 4000);
    return;
  }
  clearTimeout(esperaConfirmacion);
  esperaConfirmacion = null;
  botonBorrarTodo.textContent = TEXTO_BORRAR;
  gastos = [];
  guardarGastos();
  render();
});

// ---------- 5. Arranque ----------
llenarCategorias();
campoFecha.value = fechaDeHoy();
campoFecha.max = fechaDeHoy(); // el calendario no deja elegir fechas futuras
render();
