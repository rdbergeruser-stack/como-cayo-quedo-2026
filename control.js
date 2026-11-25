// Panel de Control - EEA Impro 2026
// Edición HD: 5 Géneros en Ruleta + 2 Directos (Banquito y Director)

const cfg = window.EEA_CONFIG;
const canal = new BroadcastChannel(cfg.channelName || 'eea_impro_2026');

// Elementos UI
const liveStatusText = document.getElementById('live-status-text');
const generoBadge = document.getElementById('genero-sorteado-badge');
const sorteoStepHint = document.getElementById('sorteo-step-hint');
const inputTitulo = document.getElementById('input-titulo');
const volumeSlider = document.getElementById('volume-slider');
const volumeLabel = document.getElementById('volume-label');
const connStatus = document.getElementById('conn-status');
const btnSorteoGenero = document.getElementById('btn-sorteo-genero');
const btnBlackout = document.getElementById('btn-blackout');
const controlToast = document.getElementById('control-toast');
const inputPuntajeRojo = document.getElementById('input-puntaje-rojo');
const inputPuntajeVerde = document.getElementById('input-puntaje-verde');

let currentAudioBtnId = null;
let ultimoContactoProyector = 0;
let toastTimeoutId = null;

function mostrarToast(mensaje, nivel = 'info', duracionMs = 4500) {
    if (!controlToast) return;
    controlToast.textContent = mensaje;
    controlToast.className = `show ${nivel}`;
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
        controlToast.classList.remove('show');
    }, duracionMs);
}

function marcarProyectorConectado() {
    ultimoContactoProyector = Date.now();
    if (connStatus) {
        connStatus.textContent = '● PROYECTOR OK';
        connStatus.classList.remove('desconectado');
        connStatus.classList.add('conectado');
    }
}

function verificarConexionProyector() {
    if (!connStatus) return;
    const desconectado = (Date.now() - ultimoContactoProyector) > 6000;
    if (desconectado) {
        connStatus.textContent = '● SIN PROYECTOR';
        connStatus.classList.remove('conectado');
        connStatus.classList.add('desconectado');
    }
}

function obtenerTextoPrimerSorteo() {
    const arreglado = cfg.generosRuleta.find(g => g.tipo === 'sorteo_arreglado');
    if (arreglado) {
        return `Próximo sorteo: ${arreglado.icono || '🎯'} ${arreglado.nombre} (Arreglado)`;
    }
    return 'Próximo sorteo: Sorteo libre';
}

// Inicialización de la Interfaz
function inicializarUI() {
    // 1. Cortinas de Géneros (Directos + Ruleta) usando íconos desde config.js
    const contAudiosGeneros = document.getElementById('contenedor-audios-generos');
    contAudiosGeneros.innerHTML = '';

    const gBanquito = cfg.generosDirectos.find(g => g.id === "banquito");
    if (gBanquito) {
        crearBotonAudio(
            contAudiosGeneros,
            'btn-audio-banquito',
            `${gBanquito.icono || '🪑'} ${gBanquito.nombre}`,
            gBanquito.audio,
            gBanquito.color,
            'white'
        );
    }

    cfg.generosRuleta.forEach((genero, index) => {
        const btnId = `btn-audio-ruleta-${index}`;
        const texto = `${genero.icono || '🎵'} ${genero.nombre}`;
        crearBotonAudio(contAudiosGeneros, btnId, texto, genero.audio, genero.color, 'white');
    });

    const gDirector = cfg.generosDirectos.find(g => g.id === "director");
    if (gDirector) {
        crearBotonAudio(
            contAudiosGeneros,
            'btn-audio-director',
            `${gDirector.icono || '🎬'} ${gDirector.nombre}`,
            gDirector.audio,
            gDirector.color,
            'white'
        );
    }

    // 2. Audios Especiales (Charton, Presentación, Remate)
    const contAudiosEsp = document.getElementById('contenedor-audios-especiales');
    contAudiosEsp.innerHTML = '';
    cfg.audiosEspeciales.forEach(esp => {
        const btn = document.createElement('button');
        btn.id = `btn-audio-${esp.id}`;
        btn.className = 'btn-audio-select';
        btn.style.background = esp.color;
        btn.style.color = 'white';
        btn.textContent = esp.nombre;
        btn.onclick = () => {
            marcarAudioSeleccionado(btn.id);
            enviarAccion('PREPARAR_AUDIO', { src: esp.archivo, btnId: btn.id, nombre: esp.nombre });
        };
        contAudiosEsp.appendChild(btn);
    });

    if (sorteoStepHint) {
        sorteoStepHint.textContent = obtenerTextoPrimerSorteo();
    }

    // 3. Multimedia
    document.getElementById('btn-logo-fijo').onclick = () => enviarAccion('LANZAR_LOGO_FIJO');
    document.getElementById('btn-publi-mosquito').onclick = () => enviarAccion('LANZAR_PUBLI_MOSQUITO');

    // 3B. Tanteador (Rojo vs Verde)
    const leerPuntaje = (inputEl) => {
        const val = parseInt(inputEl?.value, 10);
        return Number.isNaN(val) ? 0 : Math.max(0, val);
    };

    const enviarPuntajeDirecto = () => {
        const rojo = leerPuntaje(inputPuntajeRojo);
        const verde = leerPuntaje(inputPuntajeVerde);
        if (inputPuntajeRojo) inputPuntajeRojo.value = rojo;
        if (inputPuntajeVerde) inputPuntajeVerde.value = verde;
        enviarAccion('ACTUALIZAR_TANTEADOR', { rojo, verde });
    };

    document.getElementById('btn-rojo-mas').onclick = () => {
        const nuevo = leerPuntaje(inputPuntajeRojo) + 1;
        inputPuntajeRojo.value = nuevo;
        enviarAccion('ACTUALIZAR_TANTEADOR', { rojo: nuevo });
    };

    document.getElementById('btn-rojo-menos').onclick = () => {
        const nuevo = Math.max(0, leerPuntaje(inputPuntajeRojo) - 1);
        inputPuntajeRojo.value = nuevo;
        enviarAccion('ACTUALIZAR_TANTEADOR', { rojo: nuevo });
    };

    document.getElementById('btn-verde-mas').onclick = () => {
        const nuevo = leerPuntaje(inputPuntajeVerde) + 1;
        inputPuntajeVerde.value = nuevo;
        enviarAccion('ACTUALIZAR_TANTEADOR', { verde: nuevo });
    };

    document.getElementById('btn-verde-menos').onclick = () => {
        const nuevo = Math.max(0, leerPuntaje(inputPuntajeVerde) - 1);
        inputPuntajeVerde.value = nuevo;
        enviarAccion('ACTUALIZAR_TANTEADOR', { verde: nuevo });
    };

    inputPuntajeRojo.addEventListener('change', enviarPuntajeDirecto);
    inputPuntajeVerde.addEventListener('change', enviarPuntajeDirecto);
    inputPuntajeRojo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviarPuntajeDirecto();
    });
    inputPuntajeVerde.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviarPuntajeDirecto();
    });

    document.getElementById('btn-mostrar-tanteador').onclick = () => {
        enviarPuntajeDirecto();
        enviarAccion('MOSTRAR_TANTEADOR');
    };

    document.getElementById('btn-reset-tanteador').onclick = () => {
        const rojo = leerPuntaje(inputPuntajeRojo);
        const verde = leerPuntaje(inputPuntajeVerde);
        if ((rojo > 0 || verde > 0) && !confirm('¿Reiniciar el tanteador a 0 - 0?')) return;
        inputPuntajeRojo.value = 0;
        inputPuntajeVerde.value = 0;
        enviarAccion('ACTUALIZAR_TANTEADOR', { rojo: 0, verde: 0 });
    };

    // 4. Estructura del Show: Disparadores de Géneros
    document.getElementById('btn-banquito-directo').onclick = () => {
        marcarAudioSeleccionado('btn-audio-banquito');
        enviarAccion('LANZAR_BANQUITO', { titulo: inputTitulo.value });
    };

    btnSorteoGenero.onclick = () => {
        if (btnSorteoGenero.disabled) return;
        enviarAccion('INICIAR_SORTEO');
    };

    document.getElementById('btn-director-directo').onclick = () => {
        marcarAudioSeleccionado('btn-audio-director');
        enviarAccion('LANZAR_DIRECTOR', { titulo: inputTitulo.value });
    };

    // 5. Control de Escena (Placa limpia y Título)
    document.getElementById('btn-fase1').onclick = () => {
        enviarAccion('LANZAR_FASE_1', { titulo: inputTitulo.value });
    };

    document.getElementById('btn-fase2').onclick = () => {
        enviarAccion('LANZAR_FASE_2', { titulo: inputTitulo.value });
    };

    inputTitulo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            enviarAccion('LANZAR_FASE_2', { titulo: inputTitulo.value });
        }
    });

    // 6. Volver a la Ruleta
    document.getElementById('btn-volver-tablero').onclick = () => {
        enviarAccion('VOLVER_TABLERO');
        inputTitulo.value = '';
    };

    // 7. Control Maestro de Audio
    document.getElementById('btn-audio-play').onclick = () => enviarAccion('CONTROL_AUDIO', { accion: 'PLAY' });
    document.getElementById('btn-audio-stop').onclick = () => enviarAccion('CONTROL_AUDIO', { accion: 'STOP' });
    document.getElementById('btn-audio-fade').onclick = () => enviarAccion('CONTROL_AUDIO', { accion: 'FADE' });

    // Slider de Volumen
    volumeSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        volumeLabel.textContent = `${val}%`;
        enviarAccion('SET_VOLUMEN', { volumen: val / 100 });
    };

    // Blackout (Pantalla negra de pánico)
    if (btnBlackout) {
        btnBlackout.onclick = () => enviarAccion('TOGGLE_BLACKOUT');
    }

    // Pantalla Completa
    document.getElementById('btn-fullscreen-toggle').onclick = () => {
        enviarAccion('TOGGLE_FULLSCREEN');
    };

    // Reiniciar Show
    document.getElementById('btn-reset-show').onclick = () => {
        if (confirm('¿Estás seguro de reiniciar el show por completo?\nSe reiniciará la ruleta HD, el contador de rondas y los estados de géneros.')) {
            enviarAccion('REINICIAR_SHOW');
            inputTitulo.value = '';
            setGeneroBadge('');
            if (sorteoStepHint) {
                sorteoStepHint.textContent = obtenerTextoPrimerSorteo();
            }
        }
    };

    // Sincronización inicial + heartbeat con el proyector
    enviarAccion('REQUEST_SYNC');
    enviarAccion('PING');
    setInterval(() => {
        enviarAccion('PING');
        verificarConexionProyector();
    }, 2500);
}

function crearBotonAudio(contenedor, id, texto, audioSrc, bg, color) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'btn-audio-select';
    btn.style.background = bg;
    btn.style.color = color;
    btn.textContent = texto;
    btn.onclick = () => {
        marcarAudioSeleccionado(btn.id);
        enviarAccion('PREPARAR_AUDIO', { src: audioSrc, btnId: btn.id, nombre: texto });
    };
    contenedor.appendChild(btn);
}

function marcarAudioSeleccionado(btnId) {
    document.querySelectorAll('.btn-audio-select').forEach(b => b.classList.remove('audio-seleccionado'));
    if (btnId) {
        const b = document.getElementById(btnId);
        if (b) b.classList.add('audio-seleccionado');
    }
    currentAudioBtnId = btnId;
}

function enviarAccion(tipo, payload = {}) {
    canal.postMessage({ tipo, ...payload, timestamp: Date.now() });
}

function setGeneroBadge(generoNombre) {
    if (generoNombre && generoNombre.trim() !== '') {
        generoBadge.textContent = `🎯 Género: ${generoNombre}`;
        generoBadge.classList.add('activo');
    } else {
        generoBadge.textContent = 'Sin género activo';
        generoBadge.classList.remove('activo');
    }
}

// Escuchar actualizaciones desde el proyector
canal.onmessage = (event) => {
    const data = event.data;
    if (!data || !data.tipo) return;

    marcarProyectorConectado();

    switch (data.tipo) {
        case 'PONG':
            break;

        case 'SYNC_STATE':
        case 'STATE_UPDATE':
            actualizarMonitor(data);
            break;

        case 'GENERO_ELEGIDO':
            setGeneroBadge(data.genero);
            setTimeout(() => {
                inputTitulo.focus();
                inputTitulo.select();
            }, 100);
            break;

        case 'VOLVIO_A_TABLERO':
            inputTitulo.value = '';
            actualizarMonitor(data);
            break;

        case 'SHOW_ALERT':
            if (data.mensaje) {
                mostrarToast(data.mensaje, data.nivel || 'warning');
            }
            break;

        case 'RESET_COMPLETADO':
            inputTitulo.value = '';
            setGeneroBadge('');
            actualizarMonitor(data);
            mostrarToast('Show reiniciado correctamente.', 'info', 2500);
            break;
    }
};

function actualizarMonitor(data) {
    if (data.estadoTexto) {
        liveStatusText.textContent = data.estadoTexto;
    }

    if (data.ultimoGanador !== undefined) {
        setGeneroBadge(data.ultimoGanador);
    }

    if (data.girando !== undefined && btnSorteoGenero) {
        btnSorteoGenero.disabled = Boolean(data.girando);
    }

    if (data.blackoutActivo !== undefined && btnBlackout) {
        btnBlackout.classList.toggle('activo', Boolean(data.blackoutActivo));
        btnBlackout.textContent = data.blackoutActivo ? '☀️ Quitar Blackout' : '⬛ Blackout';
    }

    if (data.contadorSorteo !== undefined && sorteoStepHint) {
        if (data.contadorSorteo === 0) {
            sorteoStepHint.textContent = obtenerTextoPrimerSorteo();
        } else if (data.quedanEnBolsa > 0) {
            sorteoStepHint.textContent = `Sorteo libre • Quedan ${data.quedanEnBolsa} géneros`;
        } else {
            sorteoStepHint.textContent = 'Ruleta completa • Todos jugados • Siguiente: Director';
        }
    }

    if (data.volumen !== undefined && data.volumen !== null) {
        const pct = Math.round(data.volumen * 100);
        volumeSlider.value = pct;
        volumeLabel.textContent = `${pct}%`;
    }

    if (data.btnAudioActivo !== undefined) {
        marcarAudioSeleccionado(data.btnAudioActivo);
    }

    if (data.puntajeRojo !== undefined && inputPuntajeRojo && document.activeElement !== inputPuntajeRojo) {
        inputPuntajeRojo.value = data.puntajeRojo;
    }

    if (data.puntajeVerde !== undefined && inputPuntajeVerde && document.activeElement !== inputPuntajeVerde) {
        inputPuntajeVerde.value = data.puntajeVerde;
    }
}

// Iniciar al cargar el DOM
window.addEventListener('DOMContentLoaded', inicializarUI);
