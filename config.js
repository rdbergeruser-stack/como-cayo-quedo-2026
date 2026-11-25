// Configuración general del espectáculo EEA Impro - Edición 2026
// Ruleta HD de 5 Géneros Sorteables + Géneros Directos (Banquito y Director)

const EEA_CONFIG = {
    // 1. Los 5 géneros que están en la ruleta HD para ser sorteados:
    // - 0: Última palabra (1º sorteo arreglado)
    // - 1: Telenovela (Sorteo libre)
    // - 2: Gauchesca (Sorteo libre)
    // - 3: Ciencia Ficción (Sorteo libre)
    // - 4: Policial (Sorteo libre)
    generosRuleta: [
        { 
            id: "ultima-palabra", 
            nombre: "Última palabra", 
            icono: "🎯",
            lineas: ["ÚLTIMA", "PALABRA"],
            fontSize: 118,
            lineHeight: 122,
            textRadius: 540,
            imagen: "Generos/Gultimapalabra.png", 
            audio: "Audio/Ultimapalabra.mp3", 
            color: "#1565c0", 
            colorLight: "#42a5f5",
            colorDark: "#0d47a1",
            tipo: "sorteo_arreglado" 
        },
        { 
            id: "telenovela", 
            nombre: "Telenovela", 
            icono: "❤️",
            lineas: ["TELENOVELA"],
            fontSize: 108,
            lineHeight: 122,
            textRadius: 560,
            imagen: "Generos/Gtelenovela.png", 
            audio: "Audio/Telenovela.mp3", 
            color: "#c2185b", 
            colorLight: "#ec407a",
            colorDark: "#880e4f",
            tipo: "sorteo_libre" 
        },
        { 
            id: "gauchesca", 
            nombre: "Gauchesca", 
            icono: "🌾",
            lineas: ["GAUCHESCA"],
            fontSize: 114,
            lineHeight: 122,
            textRadius: 555,
            imagen: "Generos/GGauchesco.png", 
            audio: "Audio/Gauchesca.mp3", 
            color: "#6a1b9a", 
            colorLight: "#ab47bc",
            colorDark: "#4a148c",
            tipo: "sorteo_libre" 
        },
        { 
            id: "ciencia-ficcion", 
            nombre: "Ciencia Ficción", 
            icono: "🚀",
            lineas: ["CIENCIA", "FICCIÓN"],
            fontSize: 118,
            lineHeight: 122,
            textRadius: 540,
            imagen: "Generos/GCienciaFiccion.png", 
            audio: "Audio/CienciaFiccion.mp3", 
            color: "#00838f", 
            colorLight: "#26c6da",
            colorDark: "#006064",
            tipo: "sorteo_libre" 
        },
        { 
            id: "policial", 
            nombre: "Policial", 
            icono: "🕵️",
            lineas: ["POLICIAL"],
            fontSize: 122,
            lineHeight: 122,
            textRadius: 545,
            imagen: "Generos/GPolicial.png", 
            audio: "Audio/Policial.mp3", 
            color: "#283593", 
            colorLight: "#5c6bc0",
            colorDark: "#1a237e",
            tipo: "sorteo_libre" 
        }
    ],

    // 2. Géneros directos seleccionados desde el control (fuera de la ruleta)
    generosDirectos: [
        { 
            id: "banquito", 
            nombre: "Banquito", 
            icono: "🪑",
            imagen: "Generos/GBanquito.png", 
            audio: "Audio/Banquito.mp3", 
            color: "#fb5607",
            colorLight: "#ff7b00"
        },
        { 
            id: "director", 
            nombre: "Director", 
            icono: "🎬",
            imagen: "Generos/Gdirector.png", 
            audio: "Audio/Director.mp3", 
            color: "#b7094c",
            colorLight: "#d90429"
        }
    ],

    // 3. Audios especiales del espectáculo
    audiosEspeciales: [
        { id: "pres", nombre: "🎤 MÚSICA PRES.", archivo: "Audio/Presentacion.mp3", color: "#4CAF50" },
        { id: "rem", nombre: "🎹 MÚSICA REMATE", archivo: "Audio/Remate.mp3", color: "#2196F3" }
    ],

    // 4. Equipos para el tanteador (Rojo vs Verde)
    equipos: {
        rojo: { nombre: "EQUIPO ROJO", color: "#E63946", colorLight: "#ff5c6a", colorDark: "#8f111c" },
        verde: { nombre: "EQUIPO VERDE", color: "#16a34a", colorLight: "#4ade80", colorDark: "#14532d" }
    },

    // 5. Colores de fondo para el proyector
    coloresFondo: ['#0f172a', '#1e1b4b', '#172554', '#042f2e', '#2e1065', '#3b0764', '#18181b'],

    channelName: 'eea_impro_2026',

    defaultSettings: {
        volumenInicial: 1.0
    }
};

if (typeof window !== 'undefined') {
    window.EEA_CONFIG = EEA_CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EEA_CONFIG;
}
