# 💰 Registro de Gastos

Página web de una sola página para registrar gastos personales y ver un resumen por categoría.

- **Autor:** Daniel Salomón Palles Atis
- **Semestre:** Primer semestre, Ingeniería de Software
- **Materia:** Contexto de Software
- **Web publicada:** https://pallesatisdanielsalomon967-bot.github.io/registro_gastos/

## Funcionalidades

- Registrar un gasto con descripción, monto (COP), categoría y fecha.
- Validación de datos con mensajes claros (campos vacíos, montos negativos, fechas futuras).
- Resumen: total general, total del mes y número de gastos.
- Gráfico de barras por categoría hecho solo con CSS.
- Historial ordenado por fecha, con filtro por categoría y opción de eliminar.
- Los datos se guardan en el navegador (`localStorage`) y no se envían a ningún servidor.
- Diseño adaptable (celular y computador) y modo oscuro automático.

## Tecnologías

HTML5, CSS3 y JavaScript sin librerías externas. No depende de ningún enlace externo.

## Estructura

```
registro-gastos/
├── index.html        Estructura de la página
├── css/estilos.css   Diseño visual
├── js/logica.js      Reglas del negocio (cálculos y validaciones), sin HTML
├── js/app.js         Conecta la lógica con la página (eventos y render)
├── img/favicon.svg   Ícono de la pestaña
└── README.md
```

## Cómo ejecutarlo en tu computador

Abre `index.html` con doble clic en el navegador. No necesita instalar nada.

## Despliegue en GitHub Pages

La rutina completa, con solución de problemas, está en el documento de entrega (sección 3). Resumen:

```bash
cd registro-gastos
git init
git add .
git commit -m "Primera versión del registro de gastos"
git branch -M main
git remote add origin https://github.com/pallesatisdanielsalomon967-bot/registro_gastos.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.

## Pruebas manuales

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Presionar "Agregar gasto" con todo vacío | Mensaje "Escribe una descripción." |
| 2 | Monto 0 o negativo | Mensaje de monto inválido |
| 3 | Agregar 3 gastos de categorías distintas | Totales y barras se actualizan |
| 4 | Recargar la página (F5) | Los gastos siguen ahí |
| 5 | Filtrar por una categoría | Solo se ven gastos de esa categoría |
| 6 | Eliminar un gasto | Desaparece y el total baja |
| 7 | Escribir `<b>hola</b>` como descripción | Se muestra como texto, no como negrita |
| 8 | Abrir en el celular | Todo se ve sin desplazamiento horizontal |
| 9 | Hacer clic en Registrar, Resumen e Historial | Baja a la sección correcta |
