# Como Cayó Quedó 2026 — Proyector HD y Panel de Control

Aplicación web local para operar en vivo el espectáculo de improvisación teatral **Como Cayó Quedó (CCQ) — Edición 2026**. Funciona en dos ventanas sincronizadas en tiempo real mediante `BroadcastChannel`:

- **Proyector (`index.html`)**: pantalla pública HD con la ruleta física en Canvas 4K, placas de género, marquesina de título, tanteador, fotos de actores, logo fijo, publicidad y blackout.
- **Panel de Control (`control.html`)**: consola de operador para controlar géneros, escenas, actores, multimedia, tanteador y audio maestro.

---

## Cómo iniciar el show

1. Ejecutar **`iniciar_show.bat`** (en Windows).
   - Levanta un servidor local en `http://localhost:8080` (usando Python o `npx serve` automáticamente).
   - Abre las dos pestañas: el **Proyector** (`index.html`) y el **Panel de Control** (`control.html`).
2. Arrastrar la ventana de `index.html` a la pantalla del proyector y activar pantalla completa (tecla `F` en el proyector o el botón **Pantalla Completa** en el control).

> Se recomienda usar siempre `iniciar_show.bat` (`localhost`) para que la comunicación entre el panel de control y el proyector (`BroadcastChannel`) y la reproducción de audio funcionen sin restricciones del navegador.

---

## Funcionalidades principales

### Estructura del Show y Ruleta HD
- **1. Banquito (Directo)**: lanza la placa de Banquito y prepara su cortina (`Audio/Banquito.mp3`).
- **2. Ruleta HD (5 géneros sorteables)**:
  - **1º sorteo**: *Última palabra* (arreglado).
  - **Siguientes 4 sorteos libres** (sin repetir): *Telenovela*, *Gauchesca*, *Ciencia Ficción* y *Policial*.
  - Al detenerse la ruleta, queda en pantalla el cartel del género elegido hasta que el operador decida avanzar manualmente.
- **3. Director (Cierre directo)**: lanza la placa de Director y prepara su cortina (`Audio/Director.mp3`).
- **Control de Escena**: permite mostrar la **Placa Limpia** o **Mostrar Título** (`Enter`) con la marquesina animada, y **Volver a la Ruleta**.

### Multimedia, Publicidad y Actores
- **Logo Imagen**: muestra el logo de CCQ centrado en pantalla completa.
- **Mosquito**: muestra la publicidad en pantalla completa (`Publi/Mosquito.jpeg`).
- **Actores (10 botones)**: muestra en pantalla completa la placa/foto de cada integrante desde `Actores/`:
  - Anto Curvale, Gaby Farber, Dorita Seigorman, Veronica Elgberg, Sol Milessi, Silvina Suarez, Andrea Costa, Javier Osequer, Alicia Bertelloti y Turque Zapata.

### Tanteador (Equipo Rojo vs Equipo Verde)
- Controles rápidos `+` / `−`, edición directa de puntaje, reinicio a `0-0` y visualización a pantalla completa en el proyector.

### Audio Maestro y Seguridad en Vivo
- Cortinas musicales por género + audios especiales (*Música Presentación* y *Música Remate*).
- Controles **Play**, **Stop**, **Fade Out** suave y slider de **Volumen Master**.
- **Blackout** (pantalla negra de pánico), **Reiniciar Show** y monitor de conexión en vivo con el proyector.

---

## Atajos de teclado (en el Proyector)

| Tecla | Acción |
| :--- | :--- |
| `Espacio` | Gira la ruleta (en tablero) o vuelve a la ruleta (desde cualquier placa/overlay) |
| `F` | Alterna pantalla completa |
| `B` | Activa / desactiva Blackout (pantalla negra) |

*(En el Panel de Control, `Enter` dentro del campo de título muestra directamente la marquesina en pantalla).*

---

## Estructura del proyecto

```text
como-cayo-quedo-2026/
├── index.html          # Pantalla del proyector HD
├── style.css           # Estilos y animaciones del proyector
├── script.js           # Lógica de ruleta HD, audio, overlays y sincronización
├── control.html        # Panel de control del operador
├── control.css         # Estilos del panel de control
├── control.js          # Lógica del panel de control
├── config.js           # Configuración central (géneros, actores, audios, equipos)
├── iniciar_show.bat    # Lanzador local para Windows
├── Actores/            # Imágenes PNG de los 10 actores
├── Audio/              # Cortinas musicales y efectos de sonido
├── Fuentes/            # Tipografía local (LuckiestGuy-Regular.ttf)
├── Generos/            # Placas PNG de cada género
├── Logo/               # Logo principal e ícono de Instagram
└── Publi/              # Imágenes de publicidad (Mosquito.jpeg)
```

---

## Personalización rápida

Toda la configuración de géneros, rutas de placas, cortinas musicales, lista de actores y colores de equipos se edita desde **`config.js`**.
