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
  assert.equal(L.formatearFecha("2026-10-10"), "10 oct 2026");
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
prueba("interpretarNumero con formatos de recibos", () => {
  assert.equal(L.interpretarNumero("15.000"), 15000);
  assert.equal(L.interpretarNumero("$ 15.000"), 15000);
  assert.equal(L.interpretarNumero("1.234.567"), 1234567);
  assert.equal(L.interpretarNumero("15.000,00"), 15000);
  assert.equal(L.interpretarNumero("1,234.50"), 1234.5);
  assert.equal(L.interpretarNumero("15000"), 15000);
  assert.equal(L.interpretarNumero("15,50"), 15.5);
  assert.equal(L.interpretarNumero("abc"), null);
  assert.equal(L.interpretarNumero(""), null);
});
prueba("recibo de supermercado", () => {
  const texto = `ALMACENES EXITO S.A.
NIT 890.900.608-9
Cra 43A # 5-30  Tel 3125550000
Factura de venta 123456789
Fecha: 09/10/2026 18:45
LECHE ENTERA      6.500
PAN TAJADO        7.200
SUBTOTAL         46.700
IVA               2.300
TOTAL A PAGAR    49.000
EFECTIVO         50.000
CAMBIO            1.000`;
  const r = L.parsearRecibo(texto, cats, "2026-10-11");
  assert.equal(r.monto, 49000); assert.equal(r.origenMonto, "total");
  assert.equal(r.fecha, "2026-10-09");
  assert.equal(r.descripcion, "Almacenes Exito S.A.");
  assert.equal(r.categoria, "comida");
});
prueba("recibo sin línea de total usa el mayor monto con formato de dinero", () => {
  const r = L.parsearRecibo("Taxi Bogotá\nTel 3001112222\nViaje   $ 18.500\n2026-10-10", cats, "2026-10-11");
  assert.equal(r.monto, 18500); assert.equal(r.origenMonto, "mayor"); assert.equal(r.fecha, "2026-10-10");
  assert.equal(r.categoria, "transporte");
});
prueba("fechas de recibos", () => {
  assert.equal(L.buscarFecha("Fecha 5-3-26", "2026-10-11"), "2026-03-05");
  assert.equal(L.buscarFecha("11 de octubre de 2026", "2026-10-11"), "2026-10-11");
  assert.equal(L.buscarFecha("3 sept 2026", "2026-10-11"), "2026-09-03");
  assert.equal(L.buscarFecha("15/10/2026", "2026-10-11"), null, "futura");
  assert.equal(L.buscarFecha("31/02/2026", "2026-10-11"), null, "imposible");
  assert.equal(L.buscarFecha("sin fecha", "2026-10-11"), null);
});
prueba("recibo ilegible no inventa datos", () => {
  const r = L.parsearRecibo("@@ ## ~~ \n .. ,,", cats, "2026-10-11");
  assert.deepEqual(r, { monto: null, origenMonto: null, fecha: null, descripcion: "", categoria: null });
  assert.equal(L.parsearRecibo("", cats).monto, null);
  assert.equal(L.parsearRecibo(null, cats).monto, null);
});
prueba("categoría sugerida solo si existe", () => {
  const sinComida = cats.filter((c) => c.id !== "comida");
  assert.equal(L.sugerirCategoria("Restaurante El Sazón", cats), "comida");
  assert.equal(L.sugerirCategoria("Restaurante El Sazón", sinComida), null);
  assert.equal(L.sugerirCategoria("Droguería Cruz Verde", cats), "salud");
  const conPropia = [...cats, { id: "c1", nombre: "Mascotas", emoji: "🐶", color: 5 }];
  assert.equal(L.sugerirCategoria("Clinica de Mascotas Felices", conPropia), "c1");
});
prueba("texto de WhatsApp", () => {
  const resumen = { diaDelMes: 11, total: 372500, cantidad: 15, promedioDiario: 33864, mayor: { monto: 60000, descripcion: "Bus" }, variacion: -5 };
  const t = L.textoResumenWhatsApp({ nombre: "Daniel", hoy: "2026-10-11", resumen, ranking: [{ nombre: "Comida", total: 146000 }], formatoDinero: L.formatearDinero });
  assert.ok(t.includes("octubre de 2026 (1–11)")); assert.ok(t.includes("Donde más gasto: Comida")); assert.ok(t.includes("▼ 5 %")); assert.ok(t.includes("— Daniel"));
  const completo = L.textoResumenWhatsApp({ nombre: "Daniel", hoy: "2026-10-11", resumen, ranking: [], formatoDinero: L.formatearDinero, finanzas: { ingresos: 1000000, gastos: 372500, ahorros: 100000, balance: 527500 } });
  assert.ok(completo.includes("Ingresos:") && completo.includes("Ahorro e inversión:") && completo.includes("Balance del mes:"));
  const negativo = L.textoResumenWhatsApp({ nombre: "D", hoy: "2026-10-11", resumen, ranking: [], formatoDinero: L.formatearDinero, finanzas: { ingresos: 0, gastos: 5000, ahorros: 0, balance: -5000 } });
  assert.ok(negativo.includes("−") && negativo.includes("gasté más de lo que entró"));
  const vacio = L.textoResumenWhatsApp({ nombre: "Daniel", hoy: "2026-10-11", resumen: { diaDelMes: 11, total: 0, cantidad: 0, promedioDiario: 0, mayor: null, variacion: null }, ranking: [], formatoDinero: L.formatearDinero });
  assert.ok(vacio.includes("0 gastos") && !vacio.includes("Promedio"));
});
prueba("catálogos de ingresos y ahorros: más de tres opciones y editables con las mismas reglas", () => {
  const base = L.catalogosIniciales();
  assert.ok(base.fuentes.length > 3 && base.destinos.length > 3);
  assert.ok(base.fuentes.some((f) => f.id === "otros") && base.destinos.some((f) => f.id === "otros"));
  assert.equal(new Set(base.fuentes.map((f) => f.nombre)).size, base.fuentes.length);
  assert.equal(L.validarCategoria({ nombre: "Beca", emoji: "🎓", color: 5 }, base.fuentes), "");
  assert.match(L.validarCategoria({ nombre: "salario", emoji: "", color: 5 }, base.fuentes), /Ya existe/);
  const f = [...base.fuentes, L.crearCategoria({ nombre: "Beca", emoji: "", color: 5 })];
  const r = L.eliminarCategoria(f, [{ id: "1", categoria: f[f.length - 1].id, monto: 5, fecha: "2026-10-01", descripcion: "x" }], f[f.length - 1].id);
  assert.equal(r.gastos[0].categoria, "otros");
});
prueba("validarGasto con tipo da el mensaje correcto", () => {
  const base = L.catalogosIniciales();
  assert.equal(L.validarGasto({ categoria: "", monto: 5000, descripcion: "x", fecha: "2026-10-01" }, base.fuentes, "2026-10-11", "ingreso"), "Elige una fuente de ingreso.");
  assert.equal(L.validarGasto({ categoria: "", monto: 5000, descripcion: "x", fecha: "2026-10-01" }, base.destinos, "2026-10-11", "ahorro"), "Elige un destino del ahorro.");
  assert.equal(L.validarGasto({ categoria: "salario", monto: 5000, descripcion: "x", fecha: "2026-10-01" }, base.fuentes, "2026-10-11", "ingreso"), "");
});
prueba("totales financieros y balance", () => {
  const e = { gastos: [g("1", "comida", 100000, "2026-10-02"), g("2", "comida", 50000, "2026-09-30")], ingresos: [g("3", "salario", 1000000, "2026-10-01"), g("4", "ventas", 200000, "2026-09-15")], ahorros: [g("5", "ahorro", 150000, "2026-10-05"), g("6", "ahorro", 50000, "2026-08-05")] };
  const t = L.totalesFinancieros(e, "2026-10-11");
  assert.deepEqual([t.ingresos, t.gastos, t.ahorros, t.balance, t.ahorradoTotal], [1000000, 100000, 150000, 750000, 200000]);
  const vacio = L.totalesFinancieros({}, "2026-10-11");
  assert.deepEqual([vacio.ingresos, vacio.balance], [0, 0]);
});
prueba("ingresos de los últimos 6 meses por fuente", () => {
  const ing = [g("1", "salario", 1000000, "2026-10-01"), g("2", "ventas", 50000, "2026-10-03"), g("3", "salario", 900000, "2026-05-30"), g("4", "salario", 800000, "2026-04-30"), g("5", "ventas", 70000, "2026-10-12")];
  const m = L.ingresosPorMes(ing, L.FUENTES_BASE, "2026-10-11", 6);
  assert.deepEqual(m.map((x) => x.mes), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.equal(m[0].total, 900000, "mayo entra y abril ya no");
  assert.equal(m[5].total, 1050000, "el futuro (12 oct) no cuenta");
  assert.deepEqual(m[5].porFuente.map((f) => f.id), ["salario", "ventas"]);
  assert.equal(m[1].total, 0); assert.deepEqual(m[1].porFuente, []);
  assert.equal(m[5].etiqueta, "oct");
  const cruce = L.listaDeMeses("2026-02-15", 6); assert.deepEqual([cruce[0], cruce[5]], ["2025-09", "2026-02"]);
});
prueba("números dichos con palabras", () => {
  const v = (x) => L.valorDeNumeros(x.split(" "));
  assert.equal(v("quince mil"), 15000); assert.equal(v("quince mil quinientos"), 15500);
  assert.equal(v("treinta y cinco mil"), 35000); assert.equal(v("ciento cincuenta mil"), 150000);
  assert.equal(v("dos millones quinientos mil"), 2500000); assert.equal(v("un millon"), 1000000);
  assert.equal(v("medio millon"), 500000); assert.equal(v("mil"), 1000); assert.equal(v("mil quinientos"), 1500);
  assert.equal(v("veinte lucas"), 20000); assert.equal(v("un palo"), 1000000);
  assert.equal(v("15 mil"), 15000); assert.equal(v("2 millones 500 mil"), 2500000); assert.equal(v("1.500.000"), 1500000);
  assert.equal(v("15k"), 15000); assert.equal(v("veintiun mil"), 21000); assert.equal(v("novecientos noventa y nueve mil"), 999000);
});
prueba("dictado: tipo, monto, fecha, categoría y descripción", () => {
  const e = L.catalogosIniciales(); const d = (x) => L.parsearDictado(x, e, "2026-10-11");
  assert.deepEqual(d("Gasté quince mil pesos en almuerzo ayer"), { tipo: "gasto", monto: 15000, fecha: "2026-10-10", descripcion: "Almuerzo", categoria: "comida" });
  assert.deepEqual(d("Me pagaron el salario de dos millones quinientos mil"), { tipo: "ingreso", monto: 2500000, fecha: null, descripcion: "Salario", categoria: "salario" });
  assert.deepEqual(d("Ahorré cincuenta mil para el viaje"), { tipo: "ahorro", monto: 50000, fecha: null, descripcion: "Viaje", categoria: "meta" });
  assert.equal(d("pagué 35.000 de transporte el 5 de octubre").fecha, "2026-10-05");
  assert.equal(d("pagué 35.000 el 5 de octubre de 2025").fecha, "2025-10-05");
  assert.equal(d("pagué 35.000 el 20 de diciembre").fecha, "2025-12-20", "sin año y futuro -> año pasado");
  assert.equal(d("compré un café por veinte lucas hace tres días").fecha, "2026-10-08");
  assert.equal(d("compré un café por veinte lucas hace tres días").monto, 20000);
  assert.equal(d("gasté 12000 anteayer en bus").fecha, "2026-10-09");
  assert.equal(d("gasté 12000 el 09/10/2026 en bus").fecha, "2026-10-09");
  assert.equal(d("gasté dos almuerzos de quince mil").monto, 15000);
  assert.equal(d("gasté 20 mil que había ahorrado").tipo, "gasto", "gana el verbo que aparece primero");
  assert.equal(d("invertí 200 mil en un CDT").tipo, "ahorro"); assert.equal(d("invertí 200 mil en un CDT").categoria, "cdt");
  assert.equal(d("recibí 80 mil por una venta").tipo, "ingreso");
  assert.equal(d("pagué el recibo de la luz 90 mil").tipo, "gasto", "'recibo' no es 'recibí'");
  const nada = d("hola buenas tardes"); assert.equal(nada.monto, null); assert.equal(nada.categoria, null); assert.equal(nada.descripcion, "");
  assert.equal(d("").monto, null); assert.equal(d(null).tipo, "gasto");
  assert.equal(d("gasté 50 pesos").monto, null, "montos menores a 100 no se inventan");
  assert.equal(d("gasté 15 mil el 31 de febrero").fecha, null, "fecha imposible");
});
prueba("dictado usa categorías propias del usuario", () => {
  const e = L.catalogosIniciales(); e.categorias.push({ id: "c1", nombre: "Mascotas", emoji: "🐶", color: 5 });
  assert.equal(L.parsearDictado("gasté 40 mil en comida para mascotas", e, "2026-10-11").categoria, "c1");
  e.fuentes.push({ id: "f1", nombre: "Beca", emoji: "🎓", color: 5 });
  const r = L.parsearDictado("me consignaron la beca de 600 mil", e, "2026-10-11"); assert.equal(r.tipo, "ingreso"); assert.equal(r.categoria, "f1"); assert.equal(r.monto, 600000);
});
prueba("dictado sin verbo respeta el tipo que ya estaba elegido", () => {
  const e = L.catalogosIniciales();
  assert.equal(L.parsearDictado("quince mil por clases", e, "2026-10-11", "ingreso").tipo, "ingreso");
  assert.equal(L.parsearDictado("quince mil por clases", e, "2026-10-11").tipo, "gasto");
  assert.equal(L.parsearDictado("gasté quince mil", e, "2026-10-11", "ingreso").tipo, "gasto", "el verbo gana");
});
console.log(`OK: ${n} grupos de pruebas pasaron`);
