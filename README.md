# 💰 Registro de Gastos (versión 2)

Página web de una sola página con **cuenta de usuario**, menú, perfil, registro de gastos con categorías editables y **3 gráficos de indicadores**.

- **Autor:** Daniel Salomón Palles Atis
- **Semestre:** Primer semestre, Ingeniería de Software
- **Materia:** Contexto de Software
- **Web publicada:** https://pallesatisdanielsalomon967-bot.github.io/registro_gastos/

## Funcionalidades

- **Ventana inicial:** verificación de usuario (ingresar / crear cuenta) con la fecha actual, y una **ventana de bienvenida** con saludo según la hora y la fecha de hoy.
- **Menú:** Inicio, Nuevo gasto, Mis gastos, Categorías, Mi perfil y Cerrar sesión (barra lateral en computador, barra inferior en celular).
- **Nuevo gasto:** ventana con los campos en este orden: **Categoría → Monto → Descripción → Fecha**.
- **Categorías editables:** crear, renombrar, cambiar ícono y color, y eliminar (los gastos de una categoría borrada pasan a "Otros"). Se guardan y se recuerdan al recargar.
- **Perfil personalizable:** nombres, apellidos, teléfono, fecha de nacimiento, ciudad, ocupación, **foto opcional** (se recorta y reduce a 256 px) y cambio de contraseña.
- **3 gráficos:** (1) categoría con más gastos, con filtro "Este mes / Todo"; (2) historial de los últimos 30 días; (3) resumen del mes frente al mismo tramo del mes pasado. Todos tienen tooltip, tabla de datos alternativa y colores validados para daltonismo.
- Datos guardados en el navegador (`localStorage`); sin servidor. Modo oscuro automático. Sin librerías ni enlaces externos (la tipografía está incluida en `fonts/`).

## Límites honestos

- La verificación de usuario ocurre **solo en este navegador**: la contraseña se guarda cifrada (PBKDF2-SHA-256 con sal), pero sin servidor no es seguridad real; quien tenga acceso al dispositivo puede leer o borrar los datos con las herramientas del navegador.
- La cuenta y los gastos **no viajan entre dispositivos**: lo creado en el computador no aparece en el celular.
- Si el navegador tenía gastos de la versión 1, se importan a la **primera cuenta que se cree**.

## Estructura

```
registro-gastos/
├── index.html           Estructura (acceso, app, ventanas)
├── css/estilos.css      Diseño (claro/oscuro, celular/computador)
├── js/logica.js         Reglas y cálculos, sin HTML ni almacenamiento
├── js/almacen.js        Lectura y escritura en localStorage
├── js/auth.js           Crear cuenta e ingresar (hash de contraseñas)
├── js/graficos.js       Dibujo de los 3 gráficos (HTML/SVG)
├── js/app.js            Interfaz: eventos y render
├── fonts/               Tipografía Schibsted Grotesk (licencia OFL)
├── img/favicon.svg
├── pruebas/logica.test.js   Pruebas automáticas (node pruebas/logica.test.js)
└── README.md
```

## Cómo ejecutarlo en tu computador

Para crear cuentas el navegador exige `https` o `localhost`. Con Python instalado:

```bash
cd registro-gastos
python -m http.server 8000
```

y abre http://localhost:8000. (Con doble clic en `index.html` puede funcionar en algunos navegadores, pero no está garantizado.)

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

## Pruebas

Automáticas de la lógica: `node pruebas/logica.test.js`.

Manuales:

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abrir la página sin cuenta | Ventana inicial con la fecha de hoy |
| 2 | Crear cuenta con contraseña corta | Mensaje "mínimo 8 caracteres" |
| 3 | Crear cuenta correcta | Ventana de bienvenida con saludo y fecha |
| 4 | Nuevo gasto sin categoría | "Elige una categoría." |
| 5 | Nuevo gasto con fecha futura | "La fecha no puede ser futura." |
| 6 | Categorías → Nueva → guardar → recargar | La categoría sigue ahí |
| 7 | Borrar una categoría con gastos | Sus gastos pasan a "Otros" |
| 8 | Perfil → subir foto → recargar | La foto sigue y se ve en el menú |
| 9 | Pasar el mouse sobre una columna del gráfico de 30 días | Tooltip con fecha y total |
| 10 | Cerrar sesión y entrar con otra cuenta | Cada cuenta ve solo sus gastos |
