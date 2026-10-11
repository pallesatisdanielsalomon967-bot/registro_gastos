// Pruebas de la lógica. Ejecutar:  node pruebas/logica.test.js   (no necesita instalar nada)
"use strict";
const assert = require("assert");
const L = require("../js/logica.js");
let n = 0;
const prueba = (nombre, fn) => { fn(); n++; };

const cats = L.categoriasIniciales();
const g = (id, categoria, monto, fecha, descripcion = "x") => ({ id, categoria, monto, fecha, descripcion });

prueba("fechas reales", () => {
  assert.ok(L.esFechaReal("2026-10-11"));
  assert.ok(L.esFechaReal("2024-02-29"));
  assert.ok(!L.esFechaReal("2026-02-29"));
  assert.ok(!L.esFechaReal("2026-02-31"));
  assert.ok(!L.esFechaReal("2026-13-01"));
  assert.ok(!L.esFechaReal("26-10-11"));
  assert.ok(!L.esFechaReal(""));
  assert.ok(!L.esFechaReal(undefined));
});
prueba("sumarDias y mesAnterior", () => {
  assert.equal(L.sumarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(L.sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(L.mesAnterior("2026-01-15"), "2025-12");
  assert.equal(L.mesAnterior("2026-10-11"), "2026-09");
  assert.equal(L.mesAnterior("2026-03-31"), "2026-02");
});
prueba("saludo", () => {
  assert.equal(L.saludoSegunHora(0), "Buenos días");
  assert.equal(L.saludoSegunHora(11), "Buenos días");
  assert.equal(L.saludoSegunHora(12), "Buenas tardes");
  assert.equal(L.saludoSegunHora(18), "Buenas tardes");
  assert.equal(L.saludoSegunHora(19), "Buenas noches");
});
prueba("fecha larga en español", () => {
  assert.equal(L.fechaLarga(new Date(2026, 9, 11, 15)), "Domingo, 11 de octubre de 2026");
  const p = L.partesDeFecha(new Date(2026, 9, 11, 15));
  assert.equal(p.numero, "11"); assert.equal(p.diaSemana, "domingo"); assert.equal(p.mesAnio, "octubre de 2026");
});
prueba("validarGasto sigue el orden categoría > monto > descripción > fecha", () => {
  const ok = { categoria: "comida", monto: "15000", descripcion: "Almuerzo", fecha: "2026-10-11" };
  assert.equal(L.validarGasto(ok, cats, "2026-10-11"), "");
  assert.equal(L.validarGasto({ ...ok, categoria: "" }, cats, "2026-10-11"), "Elige una categoría.");
  assert.equal(L.validarGasto({ ...ok, categoria: "__nueva" }, cats, "2026-10-11"), "Elige una categoría.");
  assert.match(L.validarGasto({ ...ok, monto: "" }, cats, "2026-10-11"), /monto/);
  assert.match(L.validarGasto({ ...ok, monto: "0" }, cats, "2026-10-11"), /monto/);
  assert.match(L.validarGasto({ ...ok, monto: "-5" }, cats, "2026-10-11"), /monto/);
  assert.match(L.validarGasto({ ...ok, monto: "abc" }, cats, "2026-10-11"), /monto/);
  assert.match(L.validarGasto({ ...ok, monto: "999999999" }, cats, "2026-10-11"), /demasiado grande/);
  assert.match(L.validarGasto({ ...ok, descripcion: "   " }, cats, "2026-10-11"), /descripción/);
  assert.match(L.validarGasto({ ...ok, descripcion: "a".repeat(61) }, cats, "2026-10-11"), /60/);
  assert.match(L.validarGasto({ ...ok, fecha: "2026-02-31" }, cats, "2026-10-11"), /válida/);
  assert.match(L.validarGasto({ ...ok, fecha: "2026-10-12" }, cats, "2026-10-11"), /futura/);
});
prueba("crearGasto redondea y recorta", () => {
  const x = L.crearGasto({ categoria: "comida", monto: "1500.6", descripcion: "  Café  ", fecha: "2026-10-11" });
  assert.equal(x.monto, 1501); assert.equal(x.descripcion, "Café"); assert.ok(x.id);
});
prueba("categorías: validar, crear, editar, borrar", () => {
  assert.match(L.validarCategoria({ nombre: " ", emoji: "", color: 0 }, cats), /nombre/);
  assert.match(L.validarCategoria({ nombre: "COMIDA", emoji: "", color: 0 }, cats), /Ya existe/);
  assert.match(L.validarCategoria({ nombre: "estudió".replace("ó", "o"), emoji: "", color: 0 }, cats), /Ya existe/);
  assert.equal(L.validarCategoria({ nombre: "Comida", emoji: "🍔", color: 1 }, cats, "comida"), "", "puede conservar su propio nombre");
  assert.match(L.validarCategoria({ nombre: "a".repeat(25), emoji: "", color: 0 }, cats), /24/);
  assert.match(L.validarCategoria({ nombre: "Nueva", emoji: "", color: 99 }, cats), /color/);
  assert.match(L.validarCategoria({ nombre: "Nueva", emoji: "", color: "" }, cats), /color/);
  assert.equal(L.validarCategoria({ nombre: "Mascotas", emoji: "🐶", color: 5 }, cats), "");
  const nueva = L.crearCategoria({ nombre: " Mascotas ", emoji: "", color: "5" });
  assert.equal(nueva.nombre, "Mascotas"); assert.equal(nueva.emoji, "🏷️"); assert.equal(nueva.color, 5);
  const lista = [...cats, nueva];
  const ed = L.actualizarCategoria(lista, nueva.id, { nombre: "Perros", emoji: "🐶", color: 2 });
  assert.equal(L.buscarCategoria(ed, nueva.id).nombre, "Perros");
  assert.equal(L.buscarCategoria(lista, nueva.id).nombre, "Mascotas", "no muta la original");
  const gastos = [g("1", nueva.id, 100, "2026-10-01"), g("2", "comida", 50, "2026-10-01")];
  const r = L.eliminarCategoria(lista, gastos, nueva.id);
  assert.equal(r.movidos, 1); assert.equal(r.gastos[0].categoria, "otros"); assert.equal(r.gastos[1].categoria, "comida");
  assert.ok(!L.buscarCategoria(r.categorias, nueva.id));
  assert.equal(L.eliminarCategoria(lista, gastos, "otros"), null, "Otros no se borra");
  assert.equal(L.eliminarCategoria(lista, gastos, "noexiste"), null);
});
prueba("color libre", () => {
  const usados = Array.from({ length: 8 }, (_, i) => ({ color: i }));
  assert.equal(L.siguienteColorLibre(usados), 0);
  assert.equal(L.siguienteColorLibre([{ color: 0 }, { color: 1 }]), 2);
  assert.equal(L.siguienteColorLibre(cats), 5, "las base usan 0,1,2,3,4,6,8 -> primer libre es 5");
});
prueba("limpiarGastos no pierde datos por detalles menores", () => {
  const { gastos, descartados } = L.limpiarGastos([
    { id: "a", categoria: "ya-no-existe", monto: 1000, fecha: "2026-10-01", descripcion: "ok" },
    { monto: "2500", fecha: "2026-10-02" },
    { id: "a", categoria: "comida", monto: 10, fecha: "2026-10-03", descripcion: "id repetido" },
    { id: "z", monto: -5, fecha: "2026-10-01" },
    { id: "y", monto: 5, fecha: "2026-02-31" },
    null, "basura"
  ], cats);
  assert.equal(gastos.length, 3); assert.equal(descartados, 4);
  assert.equal(gastos[0].categoria, "otros");
  assert.equal(gastos[1].descripcion, "(sin descripción)");
  assert.equal(new Set(gastos.map((x) => x.id)).size, 3, "ids únicos");
  assert.deepEqual(L.limpiarGastos(null, cats), { gastos: [], descartados: 0 });
});
prueba("limpiarCategorias garantiza Otros", () => {
  const r = L.limpiarCategorias([{ id: "x", nombre: "X", emoji: "", color: 77 }, { id: "x", nombre: "dup", color: 1 }, { id: "y", nombre: "  " }]);
  assert.equal(r.length, 2); assert.equal(r[0].color, 8); assert.equal(r[0].emoji, "🏷️"); assert.equal(r[1].id, "otros");
});
prueba("ranking por categoría (gráfico 1)", () => {
  const gs = [g("1", "comida", 30000, "2026-10-01"), g("2", "comida", 20000, "2026-10-02"), g("3", "transporte", 10000, "2026-10-02"), g("4", "fantasma", 40000, "2026-10-03")];
  const r = L.rankingCategorias(gs, cats);
  assert.equal(r[0].id, "comida"); assert.equal(r[0].total, 50000); assert.equal(r[0].cantidad, 2);
  assert.equal(Math.round(r[0].porcentaje), 50);
  assert.equal(r[1].id, "fantasma"); assert.equal(r[1].nombre, "Otros", "categoría desconocida cae en Otros");
  assert.equal(r.reduce((s, x) => s + x.porcentaje, 0).toFixed(6), "100.000000");
  assert.deepEqual(L.rankingCategorias([], cats), []);
});
prueba("historial 30 días (gráfico 2)", () => {
  const hoy = "2026-10-11";
  const gs = [g("1", "comida", 100, "2026-10-11"), g("2", "comida", 50, "2026-10-11"), g("3", "comida", 70, "2026-09-12"), g("4", "comida", 999, "2026-09-11"), g("5", "comida", 5, "2026-10-12")];
  const d = L.totalesPorDia(gs, hoy, 30);
  assert.equal(d.length, 30); assert.equal(d[0].fecha, "2026-09-12"); assert.equal(d[29].fecha, hoy);
  assert.equal(d[29].total, 150); assert.equal(d[29].cantidad, 2);
  assert.equal(d[0].total, 70, "el día 30 hacia atrás entra");
  assert.equal(d.reduce((s, x) => s + x.total, 0), 220, "el día 31 y el futuro no entran");
  assert.equal(d[5].total, 0);
});
prueba("resumen del mes (gráfico 3)", () => {
  const hoy = "2026-10-11";
  const gs = [
    g("1", "comida", 100000, "2026-10-01", "Mercado"), g("2", "comida", 50000, "2026-10-11", "Cena"),
    g("3", "comida", 60000, "2026-09-05"), g("4", "comida", 40000, "2026-09-11"), g("5", "comida", 900000, "2026-09-20")
  ];
  const r = L.resumenMes(gs, hoy);
  assert.equal(r.total, 150000); assert.equal(r.cantidad, 2); assert.equal(r.promedioDiario, Math.round(150000 / 11));
  assert.equal(r.mayor.descripcion, "Mercado");
  assert.equal(r.totalPrevio, 100000, "solo septiembre 1-11");
  assert.equal(r.totalPrevioCompleto, 1000000);
  assert.equal(r.variacion, 50);
  const vacio = L.resumenMes([], hoy);
  assert.equal(vacio.variacion, null); assert.equal(vacio.mayor, null); assert.equal(vacio.promedioDiario, 0);
  const enero = L.resumenMes([g("1", "comida", 10, "2025-12-02")], "2026-01-05");
  assert.equal(enero.totalPrevio, 10, "enero compara con diciembre del año anterior");
  const marzo = L.resumenMes([g("1", "comida", 10, "2026-02-28")], "2026-03-30");
  assert.equal(marzo.totalPrevio, 10, "30 de marzo compara con todo febrero");
});
prueba("formatos", () => {
  assert.equal(L.formatearDineroCorto(1500000), "1,5 M");
  assert.equal(L.formatearDineroCorto(50000), "50 mil");
  assert.equal(L.formatearDineroCorto(800), "800");
  assert.equal(L.formatearDineroCorto(0), "0");
  assert.equal(L.formatearDinero(15000).replace(/\s/g, " "), "$ 15.000");
  assert.equal(L.formatearFecha("2026-10-10").includes("2026"), true);
});
prueba("usuarios", () => {
  assert.equal(L.normalizarCorreo("  Ana@X.COM "), "ana@x.com");
  assert.match(L.validarContrasena("corta1"), /mínimo 8/);
  assert.match(L.validarContrasena("sololetrasaqui"), /letras y números/);
  assert.match(L.validarContrasena("12345678"), /letras y números/);
  assert.equal(L.validarContrasena("clave1234"), "");
  assert.equal(L.validarContrasena("contraseña2026"), "");
  const base = { nombres: "Daniel", apellidos: "Palles", correo: "d@x.co", contrasena: "clave1234", confirmar: "clave1234" };
  assert.equal(L.validarRegistro(base, []), "");
  assert.match(L.validarRegistro({ ...base, nombres: " " }, []), /nombre/);
  assert.match(L.validarRegistro({ ...base, apellidos: "" }, []), /apellidos/);
  assert.match(L.validarRegistro({ ...base, correo: "sin-arroba" }, []), /correo/);
  assert.match(L.validarRegistro({ ...base, correo: "a@b" }, []), /correo/);
  assert.match(L.validarRegistro(base, [{ correo: "d@x.co" }]), /Ya existe/);
  assert.match(L.validarRegistro({ ...base, correo: " D@X.CO " }, [{ correo: "d@x.co" }]), /Ya existe/);
  assert.match(L.validarRegistro({ ...base, confirmar: "otra1234" }, []), /no coinciden/);
  assert.equal(L.iniciales("Daniel Salomón", "Palles Atis"), "DP");
  assert.equal(L.iniciales("", ""), "?");
});
prueba("perfil", () => {
  const ok = { nombres: "Daniel", apellidos: "Palles", telefono: "", nacimiento: "", ciudad: "", ocupacion: "" };
  assert.equal(L.validarPerfil(ok, "2026-10-11"), "");
  assert.equal(L.validarPerfil({ ...ok, telefono: "+57 300 123 4567", nacimiento: "2007-05-20", ciudad: "Cali", ocupacion: "Estudiante" }, "2026-10-11"), "");
  assert.match(L.validarPerfil({ ...ok, nombres: " " }, "2026-10-11"), /nombre/);
  assert.match(L.validarPerfil({ ...ok, telefono: "123" }, "2026-10-11"), /teléfono/);
  assert.match(L.validarPerfil({ ...ok, telefono: "abc1234567" }, "2026-10-11"), /teléfono/);
  assert.match(L.validarPerfil({ ...ok, nacimiento: "2030-01-01" }, "2026-10-11"), /anterior a hoy/);
  assert.match(L.validarPerfil({ ...ok, nacimiento: "2026-10-11" }, "2026-10-11"), /anterior a hoy/);
  assert.match(L.validarPerfil({ ...ok, nacimiento: "2001-02-30" }, "2026-10-11"), /válida/);
  assert.match(L.validarPerfil({ ...ok, ciudad: "x".repeat(61) }, "2026-10-11"), /ciudad/);
});
prueba("ordenar y filtrar no mutan", () => {
  const gs = [g("1", "comida", 1, "2026-10-01"), g("2", "salud", 1, "2026-10-05")];
  assert.equal(L.ordenarPorFecha(gs)[0].id, "2"); assert.equal(gs[0].id, "1");
  assert.equal(L.filtrarPorCategoria(gs, "salud").length, 1); assert.equal(L.filtrarPorCategoria(gs, "todas").length, 2);
});
console.log(`OK: ${n} grupos de pruebas pasaron`);
