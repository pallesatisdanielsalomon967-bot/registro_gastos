# 💰 Registro de Gastos (versión 3)

Página web de una sola página con **cuenta de usuario**, menú, perfil, registro de **gastos, ingresos y ahorros/inversiones** con opciones editables, carga por **voz, foto de recibo o frase pegada** y **5 gráficos de indicadores**.

- **Autor:** Daniel Salomón Palles Atis
- **Semestre:** Primer semestre, Ingeniería de Software
- **Materia:** Contexto de Software
- **Web publicada:** https://pallesatisdanielsalomon967-bot.github.io/registro_gastos/

## Funcionalidades

- **Ventana inicial:** verificación de usuario (ingresar / crear cuenta) con la fecha actual, y una **ventana de bienvenida** con saludo según la hora y la fecha de hoy.
- **Menú:** Inicio, Nuevo gasto, Registrar ingreso, Registrar ahorro, Movimientos, Categorías, Mi perfil y Cerrar sesión (barra lateral en computador, barra inferior en celular).
- **Un solo formulario con tres pestañas (Gasto / Ingreso / Ahorro e inversión):** campos en este orden: **Categoría (o fuente, o destino) → Monto → Descripción → Fecha**.
- **Ingresos:** 6 fuentes de partida (Salario, Mesada, Trabajo independiente, Ventas, Regalos y apoyos, Otros ingresos) y puedes crear, renombrar, cambiar ícono/color y eliminar las tuyas.
- **Ahorros e inversiones:** 6 destinos de partida (Ahorro general, Fondo de emergencia, Meta o proyecto, CDT, Acciones y fondos, Otros) también editables.
- **Resumen del mes:** ingresos, gastos, ahorro y **balance** (ingresos − gastos − ahorro; el signo y una frase indican si es negativo).
- **Movimientos:** lista única con filtro por tipo y por categoría/fuente/destino. El tipo se distingue por el signo (+ / −) y por la palabra, no solo por el color.
- **Opciones editables (categorías, fuentes y destinos):** crear, renombrar, cambiar ícono y color, y eliminar (los registros de una opción borrada pasan a "Otros"). Se guardan y se recuerdan al recargar.
- **Perfil personalizable:** nombres, apellidos, teléfono, fecha de nacimiento, ciudad, ocupación, **foto opcional** (se recorta y reduce a 256 px) y cambio de contraseña.
- **5 gráficos:** (4) **ingresos de los últimos 6 meses**, columnas apiladas por fuente; (5) ahorro e inversión acumulado por destino; y los tres de gastos: (1) categoría con más gastos, con filtro "Este mes / Todo"; (2) historial de los últimos 30 días; (3) resumen del mes frente al mismo tramo del mes pasado. Todos tienen tooltip, tabla de datos alternativa y colores validados para daltonismo.
- **Dictado por voz:** botón "Dictar" (micrófono) en el formulario; di por ejemplo “gasté quince mil en almuerzo ayer” o “me pagaron cien mil por clases”. Se interpreta tipo, monto, fecha, descripción y categoría. **Privacidad:** en Chrome y Edge el navegador envía el audio a su servicio de reconocimiento de voz (la página no lo recibe ni lo guarda); necesita internet y permiso del micrófono. Si el navegador no lo soporta, el botón se desactiva.
- **Frase escrita o pegada:** el mismo intérprete funciona con texto, por ejemplo un mensaje copiado de WhatsApp (los audios de WhatsApp no se pueden transcribir dentro de la página; puedes usar la transcripción de WhatsApp y pegar el texto).
- **Escanear recibo (OCR):** en el formulario (gasto, ingreso o ahorro), una foto del recibo propone monto, fecha, comercio y categoría/fuente/destino. La lectura se hace en tu dispositivo con Tesseract.js (incluido en `vendor/`, se descarga solo al usarlo) y la foto no se guarda. Se equivoca con recibos arrugados o borrosos, por eso los campos leídos quedan resaltados para que los revises.
- **Compartir por WhatsApp:** en el Resumen del Inicio, un botón muestra el mensaje (editable, ahora con ingresos, ahorro y balance) y abre WhatsApp con el texto escrito; tú eliges el contacto y confirmas el envío.
- Datos guardados en el navegador (`localStorage`); sin servidor. Modo oscuro automático. Sin librerías ni enlaces externos (la tipografía está incluida en `fonts/`).

## Límites honestos

- La verificación de usuario ocurre **solo en este navegador**: la contraseña se guarda cifrada (PBKDF2-SHA-256 con sal), pero sin servidor no es seguridad real; quien tenga acceso al dispositivo puede leer o borrar los datos con las herramientas del navegador.
- La cuenta y los gastos **no viajan entre dispositivos**: lo creado en el computador no aparece en el celular.
- WhatsApp **no se conecta de verdad**: solo se abre con un mensaje preparado. Registrar gastos enviando fotos al propio WhatsApp exigiría servidor, base de datos y la API de WhatsApp Business (trabajo futuro).
- El OCR no es infalible y no lee bien recibos térmicos desteñidos o con poca luz. Nunca guarda nada sin tu revisión.
- El dictado depende del navegador (funciona en Chrome/Edge y Safari recientes; Firefox no lo ofrece) y de un servicio externo de voz; la interpretación de frases es por reglas simples: entiende números en palabras, “lucas”/“palo”, hoy/ayer/anteayer/“hace N días”/“5 de octubre”, pero no frases muy rebuscadas. Siempre se revisa antes de guardar.
- Las cuentas creadas antes de esta versión siguen funcionando: se les añaden las fuentes y destinos de partida.
- Si el navegador tenía gastos de la versión 1, se importan a la **primera cuenta que se cree**.

## Estructura

```
registro-gastos/
├── index.html           Estructura (acceso, app, ventanas)
├── css/estilos.css      Diseño (claro/oscuro, celular/computador)
├── js/logica.js         Reglas y cálculos, sin HTML ni almacenamiento
├── js/almacen.js        Lectura y escritura en localStorage
├── js/auth.js           Crear cuenta e ingresar (hash de contraseñas)
├── js/graficos.js       Dibujo de los gráficos (HTML/SVG)
├── js/app.js            Interfaz: eventos y render
├── fonts/               Tipografía Schibsted Grotesk (licencia OFL)
├── vendor/tesseract/    Lector OCR (Tesseract.js, Apache-2.0) y datos de español
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
| 11 | Nuevo gasto → Escanear recibo con una foto nítida | Campos resaltados con monto, fecha, comercio y categoría propuestos |
| 12 | Escanear una imagen en blanco | Mensaje "No pude leer datos claros" |
| 14 | Registrar ingreso → elegir fuente → guardar | Aviso "Ingreso guardado"; sube el KPI de ingresos y la columna del mes en el gráfico de 6 meses |
| 15 | Categorías → pestaña Fuentes de ingreso → Nueva → recargar | La fuente sigue ahí y aparece en el formulario |
| 16 | Nuevo gasto → Dictar → decir "invertí doscientos mil en un CDT" | El formulario cambia a Ahorro, monto 200000, destino CDT |
| 17 | Pegar "me pagaron cien mil por clases ayer" en Frase → Interpretar | Cambia a Ingreso con monto, fecha de ayer y descripción |
| 18 | Movimientos → Mostrar: Solo ingresos | Solo se ven ingresos, con signo + |
| 13 | Resumen → Enviar resumen por WhatsApp | Ventana con el texto; "Abrir WhatsApp" abre wa.me con el mensaje |
