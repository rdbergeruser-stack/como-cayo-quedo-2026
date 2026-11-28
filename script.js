// EEA Impro 2026 - Lógica del Proyector HD
// Ruleta 4K Ultra-HD de 5 Géneros Sorteables + Sonido Mecánico de Alta Definición

const cfg = window.EEA_CONFIG;
const STORAGE_KEY = 'eea_impro_2026_state_v1';

// Mapeos de recursos y datos de los géneros de la ruleta
const generosRuleta = cfg.generosRuleta;
const numSectores = generosRuleta.length;
const sliceAngleRad = (2 * Math.PI) / numSectores;
const sliceAngleDeg = 360 / numSectores;

const imagenesMapa = {};
const audioMapa = {};

generosRuleta.forEach(g => {
    imagenesMapa[g.nombre] = g.imagen;
    audioMapa[g.nombre] = g.audio;
});

cfg.generosDirectos.forEach(g => {
    imagenesMapa[g.nombre] = g.imagen;
    audioMapa[g.nombre] = g.audio;
});

const coloresFondo = cfg.coloresFondo;

function obtenerIndiceArreglado() {
    return generosRuleta.findIndex(g => g.tipo === 'sorteo_arreglado');
}

function obtenerBolsaLibreInicial() {
    return generosRuleta
        .map((g, idx) => (g.tipo === 'sorteo_libre' ? idx : -1))
        .filter(idx => idx !== -1);
}

// Estado del show
let contadorSorteo = 0;
let bolsaAzar = obtenerBolsaLibreInicial();
let generosJugados = new Set();

let girando = false;
let estado = "TABLERO";
let blackoutActivo = false;
let ultimoGanador = '';
let puntajeRojo = 0;
let puntajeVerde = 0;
let volumenActual = cfg.defaultSettings.volumenInicial ?? 1.0;
let ultimoBtnAudioId = null;
let ultimoAudioNombre = "Silencio";
let currentRotation = 0; // Ángulo acumulado de rotación en grados
let controlWindow = null;

// Handles de animaciones y timers cancelables
let spinAnimId = null;
let agujaTimeoutId = null;
let detenerTimeouts = [];
let fadeIntervalId = null;

// Persistencia en localStorage para recuperar ante recarga accidental (F5)
function guardarEstadoShow() {
    try {
        const snapshot = {
            contadorSorteo,
            bolsaAzar,
            generosJugados: Array.from(generosJugados),
            ultimoGanador,
            puntajeRojo,
            puntajeVerde,
            currentRotation,
            volumenActual
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {}
}

function cargarEstadoShow() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.contadorSorteo === 'number') contadorSorteo = data.contadorSorteo;
        if (Array.isArray(data.bolsaAzar)) {
            bolsaAzar = data.bolsaAzar.filter(idx => Number.isInteger(idx) && idx >= 0 && idx < numSectores);
        }
        if (Array.isArray(data.generosJugados)) {
            generosJugados = new Set(data.generosJugados);
        }
        if (typeof data.ultimoGanador === 'string') {
            ultimoGanador = data.ultimoGanador;
        }
        if (typeof data.puntajeRojo === 'number' && Number.isFinite(data.puntajeRojo)) {
            puntajeRojo = Math.max(0, Math.floor(data.puntajeRojo));
        }
        if (typeof data.puntajeVerde === 'number' && Number.isFinite(data.puntajeVerde)) {
            puntajeVerde = Math.max(0, Math.floor(data.puntajeVerde));
        }
        if (typeof data.currentRotation === 'number' && Number.isFinite(data.currentRotation)) {
            currentRotation = data.currentRotation % 360;
        }
        if (typeof data.volumenActual === 'number' && Number.isFinite(data.volumenActual)) {
            volumenActual = Math.max(0, Math.min(1, data.volumenActual));
        }
    } catch (e) {}
}

function limpiarEstadoGuardado() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
}

// Comunicación remota vía BroadcastChannel
let canalProyector = null;
if (typeof BroadcastChannel !== 'undefined') {
    try {
        canalProyector = new BroadcastChannel(cfg.channelName || 'eea_impro_2026');
    } catch (e) {
        console.warn("BroadcastChannel error:", e);
    }
}

function notificarCanalControl(tipo = 'STATE_UPDATE', extra = {}) {
    if (!canalProyector) return;
    try {
        canalProyector.postMessage({
            tipo,
            estado,
            estadoTexto: extra.estadoTexto || obtenerTextoEstado(),
            ultimoGanador: ultimoGanador || '',
            contadorSorteo,
            quedanEnBolsa: bolsaAzar.length,
            generosJugados: Array.from(generosJugados),
            puntajeRojo,
            puntajeVerde,
            girando,
            blackoutActivo,
            volumen: volumenActual,
            btnAudioActivo: ultimoBtnAudioId,
            ...extra
        });
    } catch (e) {}
}

function enviarAlertaControl(mensaje, nivel = 'warning') {
    notificarCanalControl('SHOW_ALERT', { mensaje, nivel });
}

// Elementos DOM
const audioMaster = document.getElementById('audio-master');
const audioTickElement = document.getElementById('audio-tick');
const audioSettleElement = document.getElementById('audio-settle');
const videoPlayer = document.getElementById('video-player');
const ruletaCanvas = document.getElementById('ruleta-canvas');
const ruletaAgujaBox = document.getElementById('ruleta-aguja-box');
const bannerGanador = document.getElementById('pop-genero-ganador');
const textoGanador = document.getElementById('pop-genero-nombre');
const overlayBlackout = document.getElementById('overlay-blackout');
const overlayTanteador = document.getElementById('overlay-tanteador');
const scoreRojoDisplay = document.getElementById('score-rojo-display');
const scoreVerdeDisplay = document.getElementById('score-verde-display');
const cardEquipoRojo = document.getElementById('card-equipo-rojo');
const cardEquipoVerde = document.getElementById('card-equipo-verde');
const nombreEquipoRojo = document.getElementById('nombre-equipo-rojo');
const nombreEquipoVerde = document.getElementById('nombre-equipo-verde');
const ctxRuleta = ruletaCanvas.getContext('2d');

if (cfg.equipos) {
    if (nombreEquipoRojo && cfg.equipos.rojo?.nombre) nombreEquipoRojo.textContent = cfg.equipos.rojo.nombre;
    if (nombreEquipoVerde && cfg.equipos.verde?.nombre) nombreEquipoVerde.textContent = cfg.equipos.verde.nombre;
}

// Manejo de errores en carga de videos (evita pantalla negra colgada si falta el archivo)
if (videoPlayer) {
    videoPlayer.addEventListener('error', () => {
        const overlayVideo = document.getElementById('overlay-video');
        if (overlayVideo && overlayVideo.style.display !== 'none') {
            overlayVideo.style.display = 'none';
            estado = "TABLERO";
            enviarAlertaControl(`No se pudo cargar el video (${videoPlayer.getAttribute('src') || 'desconocido'}). Verificá la carpeta Videos/.`, 'error');
            actualizarControlUI("Error de video - Ruleta HD Lista");
        }
    });
}

// Web Audio API y Buffers HD
let audioCtx = null;
let tickBuffer = null;
let settleBuffer = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

async function cargarSonidosHD() {
    if (window.location.protocol === 'file:') return; // En file:// fetch falla por CORS; usar fallback <audio>
    try {
        const ctx = getAudioContext();

        const resTick = await fetch('Audio/wheel_tick_hd.wav');
        if (resTick.ok) {
            tickBuffer = await ctx.decodeAudioData(await resTick.arrayBuffer());
        }

        const resSettle = await fetch('Audio/wheel_settle_hd.wav');
        if (resSettle.ok) {
            settleBuffer = await ctx.decodeAudioData(await resSettle.arrayBuffer());
        }
    } catch (e) {
        // Fallback natural a <audio> o procedural
    }
}
cargarSonidosHD();

function playTickHD(progress = 0) {
    try {
        const ctx = getAudioContext();
        if (tickBuffer) {
            const src = ctx.createBufferSource();
            src.buffer = tickBuffer;

            const pitchJitter = 0.94 + Math.random() * 0.12;
            src.playbackRate.value = pitchJitter;

            const gain = ctx.createGain();
            const vol = (0.3 + (1 - progress) * 0.35) * volumenActual;
            gain.gain.setValueAtTime(vol, ctx.currentTime);

            src.connect(gain);
            gain.connect(ctx.destination);
            src.start();
        } else if (audioTickElement) {
            audioTickElement.currentTime = 0;
            audioTickElement.volume = volumenActual;
            audioTickElement.play().catch(() => {});
        }
    } catch (e) {
        playClickFallback();
    }
}

function playSettleHD() {
    try {
        const ctx = getAudioContext();
        if (settleBuffer) {
            const src = ctx.createBufferSource();
            src.buffer = settleBuffer;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.75 * volumenActual, ctx.currentTime);
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start();
        } else if (audioSettleElement) {
            audioSettleElement.currentTime = 0;
            audioSettleElement.volume = volumenActual;
            audioSettleElement.play().catch(() => {});
        }
    } catch (e) {}
}

function playClickFallback() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(820, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.04);
        gain.gain.setValueAtTime(0.35 * volumenActual, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
    } catch (e) {}
}

function playCampanita() {
    try {
        const ctx = getAudioContext();
        [440, 554, 659, 880].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, ctx.currentTime + (i * 0.1));
            gain.gain.setValueAtTime(0.25 * volumenActual, ctx.currentTime + (i * 0.1));
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + (i * 0.1));
            osc.stop(ctx.currentTime + 2.5);
        });
    } catch (e) {}
}

function playPopCategoria(pitch = 500) {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, now);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.65, now + 0.08);
        gain.gain.setValueAtTime(0.35 * volumenActual, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
    } catch (e) {}
}

// Precarga de placas
function precargarRecursos() {
    generosRuleta.forEach(g => {
        const img = new Image();
        img.src = g.imagen;
    });
    cfg.generosDirectos.forEach(g => {
        const img = new Image();
        img.src = g.imagen;
    });
}
precargarRecursos();

// ========================================================
// RENDERIZADO ULTRA-HD 4K (2048x2048) DE LA RULETA
// ========================================================
function dibujarRuleta() {
    const w = ruletaCanvas.width;
    const h = ruletaCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const rRimOuter = 975;
    const rRimInner = 860;
    const rWheel = 855;

    ctxRuleta.clearRect(0, 0, w, h);

    // 1. SECTORES DE GÉNEROS
    for (let i = 0; i < numSectores; i++) {
        const g = generosRuleta[i];
        const startAngle = -Math.PI / 2 + (i - 0.5) * sliceAngleRad;
        const endAngle = startAngle + sliceAngleRad;
        const midAngle = -Math.PI / 2 + i * sliceAngleRad;
        const yaJugado = generosJugados.has(g.nombre);

        ctxRuleta.save();
        ctxRuleta.beginPath();
        ctxRuleta.moveTo(cx, cy);
        ctxRuleta.arc(cx, cy, rWheel, startAngle, endAngle);
        ctxRuleta.closePath();

        if (yaJugado) {
            const gradJugado = ctxRuleta.createRadialGradient(cx, cy, 150, cx, cy, rWheel);
            gradJugado.addColorStop(0, '#1c1c26');
            gradJugado.addColorStop(0.75, '#12121a');
            gradJugado.addColorStop(1, '#09090e');
            ctxRuleta.fillStyle = gradJugado;
        } else {
            const gradSector = ctxRuleta.createRadialGradient(cx, cy, 160, cx, cy, rWheel);
            gradSector.addColorStop(0, g.colorLight || g.color);
            gradSector.addColorStop(0.65, g.color);
            gradSector.addColorStop(1, g.colorDark || g.color);
            ctxRuleta.fillStyle = gradSector;
        }
        ctxRuleta.fill();

        ctxRuleta.lineWidth = 4;
        ctxRuleta.strokeStyle = 'rgba(0,0,0,0.4)';
        ctxRuleta.stroke();
        ctxRuleta.restore();

        // Rayos divisores metálicos dorados/cromados
        ctxRuleta.save();
        ctxRuleta.beginPath();
        ctxRuleta.moveTo(cx, cy);
        ctxRuleta.lineTo(cx + Math.cos(startAngle) * rWheel, cy + Math.sin(startAngle) * rWheel);
        ctxRuleta.lineWidth = 8;
        ctxRuleta.strokeStyle = '#d4af37';
        ctxRuleta.shadowColor = 'rgba(0,0,0,0.8)';
        ctxRuleta.shadowBlur = 10;
        ctxRuleta.stroke();

        ctxRuleta.lineWidth = 3;
        ctxRuleta.strokeStyle = '#fff8db';
        ctxRuleta.stroke();
        ctxRuleta.restore();

        // 2. TEXTO CONFIGURADO DESDE config.js
        const baseLineas = Array.isArray(g.lineas) && g.lineas.length > 0
            ? [...g.lineas]
            : [g.nombre.toUpperCase()];
        const lineas = yaJugado
            ? [`✔ ${baseLineas[0]}`, ...baseLineas.slice(1)]
            : baseLineas;
        const fontSize = g.fontSize || 112;
        const lineHeight = g.lineHeight || 122;
        const textRadius = g.textRadius || 550;

        const tx = cx + Math.cos(midAngle) * textRadius;
        const ty = cy + Math.sin(midAngle) * textRadius;

        ctxRuleta.save();
        ctxRuleta.translate(tx, ty);
        ctxRuleta.rotate(midAngle + Math.PI / 2);

        const totalH = lineas.length * lineHeight;
        const startY = -(totalH / 2) + (lineHeight / 2);

        ctxRuleta.font = `bold ${fontSize}px 'Luckiest Guy Local', 'Arial Black', sans-serif`;
        ctxRuleta.textAlign = "center";
        ctxRuleta.textBaseline = "middle";

        lineas.forEach((linea, lIdx) => {
            const yPos = startY + lIdx * lineHeight;

            if (yaJugado) {
                ctxRuleta.lineWidth = 16;
                ctxRuleta.strokeStyle = "#080808";
                ctxRuleta.strokeText(linea, 0, yPos);
                ctxRuleta.fillStyle = "#888899";
                ctxRuleta.fillText(linea, 0, yPos);
            } else {
                ctxRuleta.shadowColor = "rgba(0, 0, 0, 0.95)";
                ctxRuleta.shadowBlur = 22;
                ctxRuleta.shadowOffsetX = 0;
                ctxRuleta.shadowOffsetY = 8;

                ctxRuleta.lineWidth = 20;
                ctxRuleta.strokeStyle = "#000000";
                ctxRuleta.lineJoin = "round";
                ctxRuleta.strokeText(linea, 0, yPos);

                ctxRuleta.shadowColor = "transparent";
                ctxRuleta.lineWidth = 6;
                ctxRuleta.strokeStyle = "#ffd700";
                ctxRuleta.lineJoin = "round";
                ctxRuleta.strokeText(linea, 0, yPos);

                ctxRuleta.fillStyle = "#ffffff";
                ctxRuleta.fillText(linea, 0, yPos);
            }
        });

        ctxRuleta.restore();
    }

    // 3. MARCO EXTERIOR 3D ROJO METALIZADO
    ctxRuleta.save();
    ctxRuleta.beginPath();
    ctxRuleta.arc(cx, cy, rRimOuter, 0, Math.PI * 2);
    ctxRuleta.arc(cx, cy, rRimInner, 0, Math.PI * 2, true);
    ctxRuleta.closePath();

    const gradRim = ctxRuleta.createRadialGradient(cx, cy, rRimInner, cx, cy, rRimOuter);
    gradRim.addColorStop(0, '#59010a');
    gradRim.addColorStop(0.25, '#c90016');
    gradRim.addColorStop(0.55, '#ff2e43');
    gradRim.addColorStop(0.85, '#9d0208');
    gradRim.addColorStop(1, '#3b0006');
    ctxRuleta.fillStyle = gradRim;
    ctxRuleta.fill();

    ctxRuleta.lineWidth = 8;
    ctxRuleta.strokeStyle = '#ffd700';
    ctxRuleta.stroke();

    ctxRuleta.beginPath();
    ctxRuleta.arc(cx, cy, rRimInner, 0, Math.PI * 2);
    ctxRuleta.lineWidth = 6;
    ctxRuleta.strokeStyle = '#ffe57f';
    ctxRuleta.stroke();
    ctxRuleta.restore();

    // 4. DIENTES TRIANGULARES CROMADOS (PEGS)
    for (let i = 0; i < numSectores; i++) {
        const angle = -Math.PI / 2 + (i - 0.5) * sliceAngleRad;
        ctxRuleta.save();
        ctxRuleta.translate(cx, cy);
        ctxRuleta.rotate(angle);

        ctxRuleta.beginPath();
        ctxRuleta.moveTo(rRimInner - 2, 0);
        ctxRuleta.lineTo(rRimInner + 36, -20);
        ctxRuleta.lineTo(rRimInner + 36, 20);
        ctxRuleta.closePath();

        const gradPeg = ctxRuleta.createLinearGradient(rRimInner, -20, rRimInner + 36, 20);
        gradPeg.addColorStop(0, '#ffffff');
        gradPeg.addColorStop(0.5, '#cfd8dc');
        gradPeg.addColorStop(1, '#78909c');
        ctxRuleta.fillStyle = gradPeg;
        ctxRuleta.shadowColor = 'rgba(0,0,0,0.85)';
        ctxRuleta.shadowBlur = 10;
        ctxRuleta.fill();

        ctxRuleta.lineWidth = 3;
        ctxRuleta.strokeStyle = '#37474f';
        ctxRuleta.stroke();
        ctxRuleta.restore();
    }

    // 5. 15 BOMBILLAS / CABOCHONES CASINO 3D
    const numBombillas = 15;
    const rBombillas = (rRimOuter + rRimInner) / 2;
    for (let j = 0; j < numBombillas; j++) {
        const bAngle = (j / numBombillas) * Math.PI * 2;
        const bx = cx + Math.cos(bAngle) * rBombillas;
        const by = cy + Math.sin(bAngle) * rBombillas;

        ctxRuleta.save();
        ctxRuleta.beginPath();
        ctxRuleta.arc(bx, by, 18, 0, Math.PI * 2);
        const gradBase = ctxRuleta.createRadialGradient(bx - 3, by - 3, 2, bx, by, 18);
        gradBase.addColorStop(0, '#ffffff');
        gradBase.addColorStop(0.35, '#ffea70');
        gradBase.addColorStop(0.7, '#d4af37');
        gradBase.addColorStop(1, '#4a3200');
        ctxRuleta.fillStyle = gradBase;
        ctxRuleta.shadowColor = 'rgba(0,0,0,0.9)';
        ctxRuleta.shadowBlur = 8;
        ctxRuleta.fill();

        ctxRuleta.beginPath();
        ctxRuleta.arc(bx, by, 12, 0, Math.PI * 2);
        const gradBulb = ctxRuleta.createRadialGradient(bx - 4, by - 4, 1, bx, by, 12);
        gradBulb.addColorStop(0, '#ffffff');
        gradBulb.addColorStop(0.45, '#fff275');
        gradBulb.addColorStop(0.85, '#ffaa00');
        gradBulb.addColorStop(1, '#ff6f00');
        ctxRuleta.fillStyle = gradBulb;
        ctxRuleta.shadowColor = 'rgba(255, 234, 112, 0.9)';
        ctxRuleta.shadowBlur = 15;
        ctxRuleta.fill();

        ctxRuleta.restore();
    }
}

function renderizarTanteador(animarRojo = false, animarVerde = false) {
    if (scoreRojoDisplay) {
        scoreRojoDisplay.textContent = String(puntajeRojo);
        if (animarRojo) {
            scoreRojoDisplay.classList.remove('score-pop');
            void scoreRojoDisplay.offsetWidth;
            scoreRojoDisplay.classList.add('score-pop');
            setTimeout(() => scoreRojoDisplay.classList.remove('score-pop'), 220);
        }
    }
    if (scoreVerdeDisplay) {
        scoreVerdeDisplay.textContent = String(puntajeVerde);
        if (animarVerde) {
            scoreVerdeDisplay.classList.remove('score-pop');
            void scoreVerdeDisplay.offsetWidth;
            scoreVerdeDisplay.classList.add('score-pop');
            setTimeout(() => scoreVerdeDisplay.classList.remove('score-pop'), 220);
        }
    }
    if (cardEquipoRojo && cardEquipoVerde) {
        cardEquipoRojo.classList.toggle('lider', puntajeRojo > puntajeVerde);
        cardEquipoVerde.classList.toggle('lider', puntajeVerde > puntajeRojo);
    }
}

function mostrarTanteador() {
    cancelarGiroYTimers();
    setBlackout(false);
    ocultarTodosLosOverlays(true);
    renderizarTanteador();
    if (overlayTanteador) overlayTanteador.style.display = 'flex';
    estado = "TANTEADOR";
    actualizarControlUI();
}
window.mostrarTanteador = mostrarTanteador;

function actualizarTanteador({ rojo, verde, deltaRojo = 0, deltaVerde = 0 } = {}) {
    const prevRojo = puntajeRojo;
    const prevVerde = puntajeVerde;

    if (typeof rojo === 'number' && Number.isFinite(rojo)) {
        puntajeRojo = Math.max(0, Math.floor(rojo));
    } else if (deltaRojo) {
        puntajeRojo = Math.max(0, puntajeRojo + deltaRojo);
    }

    if (typeof verde === 'number' && Number.isFinite(verde)) {
        puntajeVerde = Math.max(0, Math.floor(verde));
    } else if (deltaVerde) {
        puntajeVerde = Math.max(0, puntajeVerde + deltaVerde);
    }

    const cambioRojo = puntajeRojo !== prevRojo;
    const cambioVerde = puntajeVerde !== prevVerde;

    if (estado === "TANTEADOR" && (puntajeRojo > prevRojo || puntajeVerde > prevVerde)) {
        playPopCategoria(puntajeRojo > prevRojo ? 560 : 660);
    }

    renderizarTanteador(cambioRojo, cambioVerde);
    guardarEstadoShow();
    actualizarControlUI();
}
window.actualizarTanteador = actualizarTanteador;

// Restaurar estado guardado antes del primer renderizado
cargarEstadoShow();
renderizarTanteador();
audioMaster.volume = volumenActual;
videoPlayer.volume = volumenActual;
if (currentRotation !== 0) {
    ruletaCanvas.style.transform = `rotate(${currentRotation}deg)`;
}

// Garantizar carga de fuente Luckiest Guy antes de renderizar canvas (sin redibujos redundantes)
async function inicializarFuenteYRuleta() {
    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    } catch (e) {}
    dibujarRuleta();
    actualizarControlUI();
}
inicializarFuenteYRuleta();

function obtenerTextoEstado() {
    if (blackoutActivo) return "⬛ PANTALLA NEGRA (BLACKOUT)";
    switch (estado) {
        case "TABLERO": return "Ruleta HD Lista";
        case "SORTEANDO": return "Girando Ruleta HD...";
        case "ESPERANDO_INPUT": return `🎯 Ganador: ${ultimoGanador || ''}`;
        case "PLACA_LIMPIA": return `Placa: ${ultimoGanador || ''}`;
        case "REVELADO": return `En Escena: ${ultimoGanador || ''}`;
        case "TANTEADOR": return `Tanteador: Rojo ${puntajeRojo} - Verde ${puntajeVerde}`;
        case "MULTIMEDIA": return "Multimedia en Pantalla";
        default: return estado;
    }
}

function actualizarControlUI(textoExtra = null) {
    notificarCanalControl('STATE_UPDATE', { estadoTexto: textoExtra || obtenerTextoEstado() });
}

function cancelarGiroYTimers() {
    if (spinAnimId) {
        cancelAnimationFrame(spinAnimId);
        spinAnimId = null;
    }
    if (agujaTimeoutId) {
        clearTimeout(agujaTimeoutId);
        agujaTimeoutId = null;
    }
    detenerTimeouts.forEach(t => clearTimeout(t));
    detenerTimeouts = [];
    girando = false;
    if (ruletaAgujaBox) {
        ruletaAgujaBox.style.transform = 'translateX(-50%) rotate(0deg)';
    }
}

function cancelarFadeAudio() {
    if (fadeIntervalId) {
        clearInterval(fadeIntervalId);
        fadeIntervalId = null;
    }
}

function ocultarTodosLosOverlays(pausarVideo = true) {
    detenerIntro();
    document.getElementById('overlay-genero').style.display = 'none';
    document.getElementById('overlay-video').style.display = 'none';
    document.getElementById('overlay-logo-fijo').style.display = 'none';
    const overlayPubliMosquito = document.getElementById('overlay-publi-mosquito');
    if (overlayPubliMosquito) overlayPubliMosquito.style.display = 'none';
    const overlayActor = document.getElementById('overlay-actor');
    if (overlayActor) overlayActor.style.display = 'none';
    if (overlayTanteador) overlayTanteador.style.display = 'none';
    document.getElementById('marquesina').classList.remove('show');
    if (bannerGanador) bannerGanador.classList.remove('show');
    if (pausarVideo && videoPlayer) {
        videoPlayer.pause();
    }
}

function setBlackout(activo) {
    blackoutActivo = Boolean(activo);
    if (overlayBlackout) {
        overlayBlackout.classList.toggle('activo', blackoutActivo);
    }
    actualizarControlUI();
}

function toggleBlackout() {
    setBlackout(!blackoutActivo);
}
window.toggleBlackout = toggleBlackout;

function abrirControl() {
    audioMaster.play().then(() => audioMaster.pause()).catch(() => {});
    videoPlayer.play().then(() => videoPlayer.pause()).catch(() => {});
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const w = 1200, h = 850;
    const y = window.top.outerHeight / 2 + window.top.screenY - (h / 2);
    const x = window.top.outerWidth / 2 + window.top.screenX - (w / 2);
    controlWindow = window.open('control.html', 'ControlEEA2026', `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${w}, height=${h}, top=${y}, left=${x}`);
}
window.abrirControl = abrirControl;

// ========================================================
// 1. LANZAMIENTO DIRECTO: BANQUITO (FUERA DE LA RULETA)
// ========================================================
function lanzarBanquito(titulo = null) {
    getAudioContext();
    cancelarGiroYTimers();
    setBlackout(false);
    ultimoGanador = "Banquito";
    guardarEstadoShow();

    const bgAudio = audioMapa["Banquito"] || "Audio/Banquito.mp3";
    prepararAudio(bgAudio, 'btn-audio-banquito', "Banquito");

    lanzarFase1(titulo);
    actualizarControlUI("1º Escena: Banquito en Pantalla");
    notificarCanalControl('GENERO_ELEGIDO', { genero: "Banquito" });
}
window.lanzarBanquito = lanzarBanquito;

// ========================================================
// 2. GIRO FÍSICO Y SORTEO EN LA RULETA HD
// ========================================================
function sortear() {
    if (girando || estado !== "TABLERO") return;

    getAudioContext();
    setBlackout(false);
    if (bannerGanador) bannerGanador.classList.remove('show');

    const idxArreglado = obtenerIndiceArreglado();
    const generoArreglado = idxArreglado >= 0 ? generosRuleta[idxArreglado] : null;
    let targetIdx;

    if (contadorSorteo === 0 && generoArreglado && !generosJugados.has(generoArreglado.nombre)) {
        targetIdx = idxArreglado;
    } else {
        const disponibles = bolsaAzar.filter(idx => !generosJugados.has(generosRuleta[idx].nombre));

        if (disponibles.length === 0) {
            enviarAlertaControl("¡Ya se sortearon todos los géneros de la ruleta! Siguiente paso: Director o Reiniciar Show.", 'warning');
            return;
        }

        const randomPick = Math.floor(Math.random() * disponibles.length);
        targetIdx = disponibles[randomPick];
        bolsaAzar = bolsaAzar.filter(idx => idx !== targetIdx);
    }

    contadorSorteo++;
    girando = true;
    estado = "SORTEANDO";
    actualizarControlUI();

    document.body.style.backgroundColor = coloresFondo[Math.floor(Math.random() * coloresFondo.length)];

    // Cálculo del ángulo de parada
    const deltaHaciaDestino = (360 - (targetIdx * sliceAngleDeg) + 360) % 360;
    const jitter = (Math.random() - 0.5) * (sliceAngleDeg * 0.44);
    const vueltasCompletas = (6 + Math.floor(Math.random() * 3)) * 360;

    const rotacionActualNormalizada = ((currentRotation % 360) + 360) % 360;
    let avanceNecesario = deltaHaciaDestino - rotacionActualNormalizada;
    if (avanceNecesario <= 0) avanceNecesario += 360;

    const startRotation = rotacionActualNormalizada;
    const finalRotation = startRotation + vueltasCompletas + avanceNecesario + jitter;

    const duracionGiro = 5600;
    const startTime = performance.now();
    const pegOffset = sliceAngleDeg / 2;
    let ultimoPegIndex = Math.floor((startRotation + pegOffset) / sliceAngleDeg);

    function animarGiro(now) {
        if (!girando) return;
        const transcurrido = now - startTime;
        const progress = Math.min(1, transcurrido / duracionGiro);

        const ease = 1 - Math.pow(1 - progress, 4);
        const rotActual = startRotation + (finalRotation - startRotation) * ease;

        ruletaCanvas.style.transform = `rotate(${rotActual}deg)`;

        const pegActual = Math.floor((rotActual + pegOffset) / sliceAngleDeg);
        if (pegActual !== ultimoPegIndex) {
            ultimoPegIndex = pegActual;
            playTickHD(progress);

            const deflectAngle = -22 * (1 - progress * 0.4);
            ruletaAgujaBox.style.transform = `translateX(-50%) rotate(${deflectAngle}deg)`;
            if (agujaTimeoutId) clearTimeout(agujaTimeoutId);
            agujaTimeoutId = setTimeout(() => {
                ruletaAgujaBox.style.transform = `translateX(-50%) rotate(0deg)`;
            }, 55);
        }

        if (progress < 1) {
            spinAnimId = requestAnimationFrame(animarGiro);
        } else {
            spinAnimId = null;
            currentRotation = ((finalRotation % 360) + 360) % 360;
            ruletaCanvas.style.transform = `rotate(${currentRotation}deg)`;
            detenerSorteo(targetIdx);
        }
    }

    spinAnimId = requestAnimationFrame(animarGiro);
}
window.sortear = sortear;

function detenerSorteo(idx) {
    girando = false;
    estado = "ESPERANDO_INPUT";
    ultimoGanador = generosRuleta[idx].nombre;
    generosJugados.add(ultimoGanador);
    guardarEstadoShow();

    playSettleHD();
    detenerTimeouts.push(setTimeout(playCampanita, 250));

    if (bannerGanador && textoGanador) {
        textoGanador.textContent = ultimoGanador.toUpperCase();
        bannerGanador.classList.add('show');
    }

    dibujarRuleta();

    if (audioMapa[ultimoGanador]) {
        prepararAudio(audioMapa[ultimoGanador], `btn-audio-ruleta-${idx}`, ultimoGanador);
    }

    actualizarControlUI();
    notificarCanalControl('GENERO_ELEGIDO', { genero: generosRuleta[idx].nombre });
}

// ========================================================
// 3. LANZAMIENTO DIRECTO: DIRECTOR (FUERA DE LA RULETA)
// ========================================================
function lanzarDirector(titulo = null) {
    getAudioContext();
    cancelarGiroYTimers();
    setBlackout(false);
    ultimoGanador = "Director";
    guardarEstadoShow();

    prepararAudio(audioMapa["Director"] || "Audio/Director.mp3", 'btn-audio-director', "Director");

    lanzarFase1(titulo);
    actualizarControlUI("Cierre: Género Director en Pantalla");
    notificarCanalControl('GENERO_ELEGIDO', { genero: "Director" });
}
window.lanzarDirector = lanzarDirector;

// ========================================================
// 4. FASES DE LA ESCENA (PLACA Y TÍTULO)
// ========================================================
function lanzarFase1(titVal) {
    cancelarGiroYTimers();
    setBlackout(false);
    const inputVal = (titVal && titVal.trim() !== "") ? titVal : "A IMPROVISAR";

    const imagenUrl = imagenesMapa[ultimoGanador] || "Generos/GCienciaFiccion.png";
    document.getElementById('img-revelada').src = imagenUrl;
    document.getElementById('texto-titulo').textContent = inputVal;

    ocultarTodosLosOverlays(true);
    document.getElementById('overlay-genero').style.display = 'flex';
    estado = "PLACA_LIMPIA";

    actualizarControlUI();
}
window.lanzarFase1 = lanzarFase1;

function lanzarFase2(titVal) {
    cancelarGiroYTimers();
    setBlackout(false);
    const inputVal = (titVal && titVal.trim() !== "") ? titVal : "A IMPROVISAR";

    const imagenUrl = imagenesMapa[ultimoGanador] || "Generos/GCienciaFiccion.png";
    document.getElementById('img-revelada').src = imagenUrl;

    ocultarTodosLosOverlays(true);
    document.getElementById('overlay-genero').style.display = 'flex';
    document.getElementById('texto-titulo').textContent = inputVal;
    document.getElementById('marquesina').classList.add('show');
    estado = "REVELADO";

    actualizarControlUI();
}
window.lanzarFase2 = lanzarFase2;

function cerrarTodoYTablero() {
    cancelarGiroYTimers();
    setBlackout(false);
    ocultarTodosLosOverlays(true);

    estado = "TABLERO";
    actualizarControlUI("Ruleta HD Lista");
    notificarCanalControl('VOLVIO_A_TABLERO');
}
window.cerrarTodoYTablero = cerrarTodoYTablero;

// ========================================================
// 5. AUDIO Y MULTIMEDIA MAESTRO
// ========================================================
function prepararAudio(src, btnId, nombre) {
    cancelarFadeAudio();
    ultimoBtnAudioId = btnId;
    ultimoAudioNombre = nombre || "Audio";
    audioMaster.src = src;
    audioMaster.volume = volumenActual;
    audioMaster.load();
    actualizarControlUI(`Audio preparado: ${ultimoAudioNombre}`);
}
window.prepararAudio = prepararAudio;

function controlAudio(accion, srcOpcional = null, btnIdOpcional = null, nombreOpcional = null) {
    if (srcOpcional) {
        prepararAudio(srcOpcional, btnIdOpcional, nombreOpcional);
    }

    if (accion === 'PLAY') {
        cancelarFadeAudio();
        getAudioContext();
        audioMaster.volume = volumenActual;
        audioMaster.play().catch(e => {
            console.warn("Error reproduciendo audio:", e);
            enviarAlertaControl(`No se pudo reproducir "${ultimoAudioNombre}". Hacé clic en el proyector para habilitar el audio.`, 'warning');
        });
        actualizarControlUI(`Reproduciendo: ${ultimoAudioNombre}`);
    }
    if (accion === 'STOP') {
        cancelarFadeAudio();
        audioMaster.pause();
        audioMaster.currentTime = 0;
        audioMaster.volume = volumenActual;
        actualizarControlUI(`Audio detenido`);
    }
    if (accion === 'FADE') {
        cancelarFadeAudio();
        let vol = audioMaster.volume;
        const step = Math.max(0.02, vol / 16);
        fadeIntervalId = setInterval(() => {
            if (vol > step) {
                vol = Math.max(0, vol - step);
                audioMaster.volume = vol;
            } else {
                cancelarFadeAudio();
                audioMaster.pause();
                audioMaster.currentTime = 0;
                audioMaster.volume = volumenActual;
                actualizarControlUI(`Fade completado`);
            }
        }, 75);
    }
}
window.controlAudio = controlAudio;

function setVolumen(nuevoVolumen) {
    cancelarFadeAudio();
    volumenActual = Math.max(0, Math.min(1, nuevoVolumen));
    audioMaster.volume = volumenActual;
    videoPlayer.volume = volumenActual;
    guardarEstadoShow();
    actualizarControlUI();
}
window.setVolumen = setVolumen;

// ========================================================
// 6. APERTURA DE TELÓN TEATRAL (INTRO)
// ========================================================
let introAnimId = null;
let introTimeouts = [];
let introRunning = false;
let introResizeHandler = null;

function limpiarIntroTimeouts() {
    introTimeouts.forEach(t => clearTimeout(t));
    introTimeouts = [];
}

function detenerIntro() {
    introRunning = false;
    if (introAnimId) {
        cancelAnimationFrame(introAnimId);
        introAnimId = null;
    }
    if (introResizeHandler) {
        window.removeEventListener('resize', introResizeHandler);
        introResizeHandler = null;
    }
    limpiarIntroTimeouts();

    const overlayComienzo = document.getElementById('overlay-comienzo');
    if (overlayComienzo) {
        overlayComienzo.style.display = 'none';
        overlayComienzo.style.opacity = '1';
    }

    const cLeft = document.getElementById('curtain-left');
    const cRight = document.getElementById('curtain-right');
    if (cLeft) cLeft.classList.remove('open');
    if (cRight) cRight.classList.remove('open');

    const logoBox = document.getElementById('intro-logo-box');
    if (logoBox) logoBox.classList.remove('show-theatre');

    const introIg = document.getElementById('intro-ig-banner');
    if (introIg) introIg.classList.remove('show-theatre');

    const flashScreen = document.getElementById('intro-flash-screen');
    if (flashScreen) flashScreen.style.opacity = '0';

    const ruletaStage = document.getElementById('ruleta-stage');
    if (ruletaStage) {
        ruletaStage.style.opacity = '1';
        ruletaStage.style.transform = 'scale(1)';
    }
}

function lanzarComienzo() {
    cancelarGiroYTimers();
    setBlackout(false);
    prepararAudio("Audio/IntroTeatro.mp3", 'btn-comienzo', "Música de Presentación");
    controlAudio('PLAY');

    ocultarTodosLosOverlays(true);

    const overlayComienzo = document.getElementById('overlay-comienzo');
    const canvas = document.getElementById('canvas-comienzo-fx');
    const ctx = canvas.getContext('2d');
    const cLeft = document.getElementById('curtain-left');
    const cRight = document.getElementById('curtain-right');
    const logoBox = document.getElementById('intro-logo-box');
    const introIg = document.getElementById('intro-ig-banner');
    const flashScreen = document.getElementById('intro-flash-screen');
    const ruletaStage = document.getElementById('ruleta-stage');

    overlayComienzo.style.display = 'flex';
    overlayComienzo.style.opacity = '1';
    if (cLeft) cLeft.classList.remove('open');
    if (cRight) cRight.classList.remove('open');
    if (logoBox) logoBox.classList.remove('show-theatre');
    if (introIg) introIg.classList.remove('show-theatre');
    if (flashScreen) flashScreen.style.opacity = '0';

    if (ruletaStage) {
        ruletaStage.style.opacity = '0';
        ruletaStage.style.transform = 'scale(0.85)';
    }

    introResizeHandler = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    introResizeHandler();
    window.addEventListener('resize', introResizeHandler);

    introRunning = true;
    const startTime = performance.now();

    function renderIntroFrame(currentTime) {
        if (!introRunning) return;
        const elapsed = (currentTime - startTime) / 1000;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        if (elapsed > 0.4 && elapsed < 8.5) {
            const sweepA = Math.sin(elapsed * 1.5) * (canvas.width * 0.28);
            const sweepB = Math.cos(elapsed * 1.2) * (canvas.width * 0.28);

            drawSpotlight(ctx, canvas.width * 0.15, -20, cx + sweepA, cy + 30, 240, 'rgba(255, 230, 150, 0.45)', 'rgba(255, 200, 50, 0)');
            drawSpotlight(ctx, canvas.width * 0.85, -20, cx + sweepB, cy + 30, 240, 'rgba(200, 230, 255, 0.45)', 'rgba(80, 160, 255, 0)');
            drawSpotlight(ctx, cx, -30, cx + (sweepA * 0.4), cy, 280, 'rgba(255, 255, 255, 0.55)', 'rgba(255, 220, 120, 0)');
        }

        if (elapsed < 8.7) {
            introAnimId = requestAnimationFrame(renderIntroFrame);
        } else {
            introAnimId = null;
        }
    }
    introAnimId = requestAnimationFrame(renderIntroFrame);

    introTimeouts.push(setTimeout(() => {
        if (!introRunning) return;
        if (cLeft) cLeft.classList.add('open');
        if (cRight) cRight.classList.add('open');
    }, 450));

    introTimeouts.push(setTimeout(() => {
        if (!introRunning) return;
        if (logoBox) logoBox.classList.add('show-theatre');
        if (introIg) introIg.classList.add('show-theatre');
    }, 1100));

    introTimeouts.push(setTimeout(() => {
        if (!introRunning) return;
        if (flashScreen) {
            flashScreen.style.transition = 'opacity 0.25s ease-in';
            flashScreen.style.opacity = '1';
        }
    }, 8300));

    introTimeouts.push(setTimeout(() => {
        if (!introRunning) return;
        detenerIntro();

        if (ruletaStage) {
            ruletaStage.style.transition = 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.8s ease';
            ruletaStage.style.opacity = '1';
            ruletaStage.style.transform = 'scale(1)';
            playPopCategoria(480);
        }

        estado = "TABLERO";
        actualizarControlUI("Ruleta HD Lista");
    }, 8650));

    estado = "MULTIMEDIA";
    actualizarControlUI("Apertura de Telón en Pantalla");
}
window.lanzarComienzo = lanzarComienzo;

function drawSpotlight(ctx, ox, oy, tx, ty, radius, colorCenter, colorEdge) {
    ctx.save();
    ctx.beginPath();
    const angle = Math.atan2(ty - oy, tx - ox);
    const perp = angle + Math.PI / 2;
    const spread = radius * 0.85;

    ctx.moveTo(ox, oy);
    ctx.lineTo(tx + Math.cos(perp) * spread, ty + Math.sin(perp) * spread);
    ctx.lineTo(tx - Math.cos(perp) * spread, ty - Math.sin(perp) * spread);
    ctx.closePath();

    const grad = ctx.createRadialGradient(tx, ty, 10, tx, ty, radius * 1.5);
    grad.addColorStop(0, colorCenter);
    grad.addColorStop(0.65, colorEdge);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
}

// Videos y Multimedia
function lanzarVideo(nombreVideo, mostrarInstagram = false) {
    cancelarGiroYTimers();
    setBlackout(false);

    const videoMap = {
        'comienzo': 'Videos/comienzo.mp4',
        'inicio': 'Videos/inicio.mp4',
        'gorra': 'Videos/gorra.mp4',
        'logo': 'Videos/logo.mp4'
    };

    const rutaVideo = videoMap[nombreVideo] || `Videos/${nombreVideo}.mp4`;

    ocultarTodosLosOverlays(false);

    const overlayVideo = document.getElementById('overlay-video');
    const igBanner = document.getElementById('ig-banner-video');

    igBanner.style.display = mostrarInstagram ? 'flex' : 'none';
    videoPlayer.src = rutaVideo;
    videoPlayer.load();
    videoPlayer.volume = volumenActual;

    overlayVideo.style.display = 'flex';
    videoPlayer.play().catch(e => {
        console.warn("Error al reproducir video:", e);
        enviarAlertaControl(`No se pudo reproducir el video "${nombreVideo}". Verificá que exista en Videos/.`, 'error');
    });

    estado = "MULTIMEDIA";
    actualizarControlUI(`Video: ${nombreVideo}`);
}
window.lanzarVideo = lanzarVideo;

function lanzarInicioGracioso() {
    lanzarVideo('InicioGracioso');
}
window.lanzarInicioGracioso = lanzarInicioGracioso;

function lanzarLogoFijo() {
    cancelarGiroYTimers();
    setBlackout(false);
    ocultarTodosLosOverlays(true);

    document.getElementById('overlay-logo-fijo').style.display = 'flex';
    estado = "MULTIMEDIA";
    actualizarControlUI("Logo Fijo en Pantalla");
}
window.lanzarLogoFijo = lanzarLogoFijo;

function lanzarPubliMosquito() {
    cancelarGiroYTimers();
    setBlackout(false);
    ocultarTodosLosOverlays(true);

    const overlay = document.getElementById('overlay-publi-mosquito');
    if (overlay) overlay.style.display = 'flex';
    estado = "MULTIMEDIA";
    actualizarControlUI("Publicidad: Mosquito en Pantalla");
}
window.lanzarPubliMosquito = lanzarPubliMosquito;

function lanzarActor(nombre, imagen) {
    if (!imagen) return;
    cancelarGiroYTimers();
    setBlackout(false);
    ocultarTodosLosOverlays(true);

    const imgEl = document.getElementById('img-actor');
    const overlay = document.getElementById('overlay-actor');
    if (imgEl) {
        imgEl.src = imagen;
        imgEl.alt = nombre || 'Actor';
    }
    if (overlay) overlay.style.display = 'flex';
    estado = "MULTIMEDIA";
    actualizarControlUI(`Actor: ${nombre || ''}`.trim());
}
window.lanzarActor = lanzarActor;

// ========================================================
// 7. REINICIO DEL SHOW
// ========================================================
function reiniciarShow() {
    cancelarGiroYTimers();
    cancelarFadeAudio();
    setBlackout(false);
    ocultarTodosLosOverlays(true);

    contadorSorteo = 0;
    bolsaAzar = obtenerBolsaLibreInicial();
    generosJugados.clear();
    currentRotation = 0;
    ultimoGanador = '';
    puntajeRojo = 0;
    puntajeVerde = 0;
    renderizarTanteador();
    limpiarEstadoGuardado();

    ruletaCanvas.style.transition = 'none';
    ruletaCanvas.style.transform = 'rotate(0deg)';
    dibujarRuleta();

    controlAudio('STOP');

    document.body.style.backgroundColor = 'var(--bg-inicial)';
    estado = "TABLERO";

    actualizarControlUI("Show Reiniciado - Ruleta HD Lista");
    notificarCanalControl('RESET_COMPLETADO');
}
window.reiniciarShow = reiniciarShow;

// Pantalla completa
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Error al intentar pantalla completa: ${err.message}`);
            enviarAlertaControl("El navegador bloqueó Pantalla Completa remota. Presioná la tecla F en la ventana del Proyector.", 'info');
        });
    } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
}
window.toggleFullscreen = toggleFullscreen;

// Atajos de teclado en el proyector
window.addEventListener('keydown', (e) => {
    if (e.code === "Space") {
        e.preventDefault();
        if (estado === "TABLERO") sortear();
        else if (estado === "REVELADO" || estado === "MULTIMEDIA" || estado === "PLACA_LIMPIA" || estado === "TANTEADOR") cerrarTodoYTablero();
    }
    if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
    }
    if (e.key === "b" || e.key === "B") {
        toggleBlackout();
    }
});

// ========================================================
// 8. ESCUCHAR COMANDOS DEL PANEL DE CONTROL
// ========================================================
if (canalProyector) {
    canalProyector.onmessage = (e) => {
        const msg = e.data;
        if (!msg || !msg.tipo) return;
        const payload = msg.data || msg;

        switch (msg.tipo) {
            case 'PING':
                notificarCanalControl('PONG');
                break;
            case 'REQUEST_SYNC':
                notificarCanalControl('SYNC_STATE');
                break;
            case 'LANZAR_COMIENZO':
                lanzarComienzo();
                break;
            case 'LANZAR_INICIO_GRACIOSO':
                lanzarInicioGracioso();
                break;
            case 'LANZAR_LOGO_FIJO':
                lanzarLogoFijo();
                break;
            case 'LANZAR_PUBLI_MOSQUITO':
                lanzarPubliMosquito();
                break;
            case 'LANZAR_ACTOR':
                lanzarActor(payload.nombre, payload.imagen);
                break;
            case 'LANZAR_VIDEO':
                lanzarVideo(payload.nombre, payload.ig || false);
                break;
            case 'LANZAR_BANQUITO':
                lanzarBanquito(payload.titulo);
                break;
            case 'INICIAR_SORTEO':
                sortear();
                break;
            case 'LANZAR_DIRECTOR':
                lanzarDirector(payload.titulo);
                break;
            case 'LANZAR_FASE_1':
                lanzarFase1(payload.titulo);
                break;
            case 'LANZAR_FASE_2':
                lanzarFase2(payload.titulo);
                break;
            case 'VOLVER_TABLERO':
                cerrarTodoYTablero();
                break;
            case 'MOSTRAR_TANTEADOR':
                mostrarTanteador();
                break;
            case 'ACTUALIZAR_TANTEADOR':
                actualizarTanteador(payload);
                break;
            case 'TOGGLE_BLACKOUT':
                toggleBlackout();
                break;
            case 'REINICIAR_SHOW':
                reiniciarShow();
                break;
            case 'PREPARAR_AUDIO':
                if (payload.src) {
                    prepararAudio(payload.src, payload.btnId, payload.nombre);
                    controlAudio('PLAY');
                }
                break;
            case 'CONTROL_AUDIO':
                if (payload.accion) controlAudio(payload.accion);
                break;
            case 'SET_VOLUMEN':
                if (payload.volumen !== undefined) setVolumen(payload.volumen);
                break;
            case 'TOGGLE_FULLSCREEN':
                toggleFullscreen();
                break;
        }
    };
}
