var map;
var markersLayer;
var ghostMarker = null;

/**
 * Inicializa el mapa base
 */
function initMap() {
    if (map) return;

    map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 3,
        zoomControl: false
    });

    // Vista inicial neutra para evitar errores de Leaflet
    map.setView([0, 0], 0);

    const LAYOUT_URL = "https://izbjauurioyavlpmbgzy.supabase.co/storage/v1/object/public/assets/layo240725.png";
    const img = new Image();
    img.src = LAYOUT_URL;

    img.onload = function() {
        const bounds = [[0, 0], [this.height, this.width]];
        L.imageOverlay(LAYOUT_URL, bounds).addTo(map);
        map.fitBounds(bounds);
        
        // Creamos la capa de marcadores una sola vez
        markersLayer = L.layerGroup().addTo(map);
        renderMapa(); // Dibujar lo existente
    };

    configurarEventosMapa();
}

/**
 * Dibuja los pines guardados respetando los filtros
 */
function renderMapa() {
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // Obtenemos fechas para la lógica de alertas
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();
    
    // Calcular el último día del mes en curso
    const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0);

    const busqueda = (document.getElementById('search-id')?.value || "").toUpperCase();
    
    const filtrados = equipos.filter(eq => {
        const cumpleFiltro = (filtroActual === 'todos' || eq.estatus_color === filtroActual);
        const cumpleBusqueda = eq.id.toUpperCase().includes(busqueda);
        return cumpleFiltro && cumpleBusqueda;
    });

    filtrados.forEach((eq) => {
        if (!eq.latitud || !eq.longitud) return;

        const originalIndex = equipos.findIndex(e => e.id === eq.id);
        const colorKey = eq.estatus_color || 'gris';
        
        // --- LÓGICA DE ALERTAS DE VENCIMIENTO ---
        let iconoAlerta = '';
        if (eq.fecha_vencimiento) {
            // Normalizamos las fechas para comparar solo año/mes/día (sin horas)
            const fVenc = new Date(eq.fecha_vencimiento + "T00:00:00");
            const fHoy = new Date();
            fHoy.setHours(0, 0, 0, 0); // Resetear horas de hoy para comparación limpia

            if (fVenc < fHoy) {
                // CASO 1: Ya pasó la fecha (Rojo)
                iconoAlerta = `<i class="fa-solid fa-circle-exclamation pill-icon alert-danger"></i>`;
            } else if (
                fVenc.getMonth() === mesActual && 
                fVenc.getFullYear() === anioActual
            ) {
                // CASO 2: Vence dentro de este mes (Amarillo)
                // Quitamos la validación de "ultimoDiaMes" para que brille todo el mes
                iconoAlerta = `<i class="fa-solid fa-triangle-exclamation pill-icon alert-warning"></i>`;
            }
        }

        const elGlobo = L.divIcon({
            className: 'custom-marker-container',
            html: `
                <div class="marker-pill">
                    <div class="pill-content pill-${colorKey}">
                        ${iconoAlerta}
                        <span>${eq.id}</span>
                    </div>
                    <div class="pill-tip pill-${colorKey}-tip"></div>
                </div>`,
            iconSize: null,
            iconAnchor: [20, 25]
        });

        const m = L.marker([eq.latitud, eq.longitud], { icon: elGlobo });
        
        m.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openDetails(originalIndex);
        });
        
        m.addTo(markersLayer);
    });
}
/**
 * Mueve el marcador fantasma al centro exacto del mapa
 */
function actualizarGhostAlCentro() {
    if (!modoReubicacion || !map) return;

    const centro = map.getCenter();
    const eq = tempNuevoEquipo || (selectedIndex !== -1 ? equipos[selectedIndex] : null);
    if (!eq) return;

    const ghostIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div class="flex flex-col items-center">
                <div class="bg-orange-600 text-white px-4 py-2 rounded-xl shadow-2xl font-black text-xs border-2 border-white whitespace-nowrap mb-1">
                    📍 ${eq.id}
                </div>
                <div class="relative flex items-center justify-center">
                    <div class="w-8 h-8 border-2 border-orange-500 rounded-full animate-ping absolute"></div>
                    <i class="fa-solid fa-plus text-orange-500 text-xl"></i>
                </div>
            </div>`,
        iconSize: [120, 60],
        iconAnchor: [60, 50] // Ajustado para que la cruz quede al centro
    });

    if (!ghostMarker) {
        ghostMarker = L.marker(centro, { icon: ghostIcon, zIndexOffset: 20000 }).addTo(map);
    } else {
        ghostMarker.setLatLng(centro);
    }
}

// Variable temporal para guardar la coordenada del clic antes de confirmar
let nuevaCoordenadaTemp = null;

/**
 * Mueve el pin naranja al lugar donde el usuario hizo clic
 */
// --- Código para el Indicador de Ubicación con Efecto Pulse ---

window.posicionarPinEnClic = function(latlng) {
  if (!window.map) return;

  const eq = tempNuevoEquipo || (selectedIndex !== -1 ? equipos[selectedIndex] : null);

  // --- 1. Definir los estilos CSS necesarios para la animación y el diseño ---
  const estiloPinPulse = `
    /* Contenedor principal del marcador para asegurar posicionamiento */
    .contenedor-pin-pulse {
      position: relative;
      width: 40px;
      height: 50px;
      /* Asegura que el punto de anclaje sea la punta del pin */
      transform: translate(-50%, -100%); 
    }

    /* El Pin principal (forma de gota) hecho con SVG para nitidez */
    .pin-forma {
      width: 40px;
      height: 40px;
      position: absolute;
      top: 0;
      left: 0;
      filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));
    }

    /* El efecto 'pulse' que sale de la punta del pin */
    .punto-pulse {
      background: rgba(249, 115, 22, 0.8); /* Naranja vivo con transparencia */
      border-radius: 50%;
      height: 14px;
      width: 14px;
      position: absolute;
      left: 50%;
      bottom: -7px; /* Posicionado exactamente en la punta inferior */
      transform: translateX(-50%);
      animation: pulse-onda 1.5s infinite;
      pointer-events: none; /* No interfiere con clics */
    }

    /* Definición de la animación de onda expansiva */
    @keyframes pulse-onda {
      0% {
        transform: translateX(-50%) scale(0.1);
        opacity: 0.8;
      }
      80% {
        transform: translateX(-50%) scale(2.5);
        opacity: 0;
      }
      100% {
        transform: translateX(-50%) scale(3);
        opacity: 0;
      }
    }

    /* Estilo para la etiqueta flotante "¿AQUÍ?" */
    .etiqueta-pin {
      position: absolute;
      top: -35px; /* Flota sobre el pin */
      left: 50%;
      transform: translateX(-50%);
      background-color: #ea580c; /* Orange 600 */
      color: white;
      padding: 4px 10px;
      border-radius: 8px;
      font-family: sans-serif;
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      white-space: nowrap;
      border: 2px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      z-index: 1;
    }
  `;

  // --- 2. Inyectar los estilos CSS si no existen ---
  if (!document.getElementById('estilo-pin-pulse')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'estilo-pin-pulse';
    styleElement.innerHTML = estiloPinPulse;
    document.head.appendChild(styleElement);
  }

  // --- 3. Definir el HTML del Pin (usando un SVG de pin real) ---
  const htmlPin = `
    <div class="contenedor-pin-pulse" style="pointer-events: none;">
      
      <div class="etiqueta-pin">
        ¿AQUÍ? ${eq ? eq.id : ''}
      </div>

      <div class="punto-pulse"></div>

      <svg class="pin-forma" viewBox="0 0 365 560" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path fill="#f97316" d="M182.9,551.7c0,0.1,0.2,0.3,0.3,0.3S183.4,551.8,182.9,551.7z M183.1,519.8c-0.2,0-0.3-0.1-0.4-0.1
          C182.8,519.7,183,519.8,183.1,519.8z M183.2,0.3C82.1,0.3,0,82.4,0,183.5c0,42.4,14.6,81.3,38.9,112.2
          c0.3,0.4,0.6,0.7,0.9,1.1l137,222.1l0,0c1.6,2.6,4.4,4.1,7.4,4.1s5.8-1.6,7.4-4.1l137-222.1c0.3-0.4,0.6-0.7,0.9-1.1
          c24.3-30.9,38.9-69.8,38.9-112.2C366.4,82.4,284.3,0.3,183.2,0.3z M183.2,271.8c-48.7,0-88.2-39.5-88.2-88.2
          s39.5-88.2,88.2-88.2s88.2,39.5,88.2,88.2S231.9,271.8,183.2,271.8z" />
        <circle fill="white" cx="183.2" cy="183.5" r="58" />
      </svg>

    </div>
  `;

  // --- 4. Configurar el DivIcon de Leaflet ---
  const iconPulse = L.divIcon({
    className: '', // Vaciamos para usar nuestras clases personalizadas
    html: htmlPin,
    iconSize: [40, 60], // Tamaño visual aproximado
    iconAnchor: [0, 0] // El anclaje se maneja vía CSS transform en .contenedor-pin-pulse
  });

  // --- 5. Crear o mover el marcador en el mapa ---
  if (typeof ghostMarker !== 'undefined' && ghostMarker) {
    ghostMarker.setLatLng(latlng);
  } else {
    ghostMarker = L.marker(latlng, {
      icon: iconPulse,
      zIndexOffset: 99999, // Siempre encima
      interactive: false // Deja pasar los clics al mapa
    }).addTo(window.map);
  }
};
// --- Fin del Código para el Indicador de Ubicación ---
/**
 * Eventos: Solo detectar el clic para mover el marcador naranja
 */
function configurarEventosMapa() {
    if (!map) return;

    // 1. Obtener el contenedor HTML del mapa
    const mapDiv = document.getElementById('map');

    // 2. Escuchar el clic directamente del DOM (Nivel Navegador)
    mapDiv.addEventListener('click', (e) => {
        if (!modoReubicacion) return;

        // Convertir el clic del mouse (píxeles de pantalla) a coordenadas del mapa (Lat/Lng)
        const puntoLatLng = map.mouseEventToLatLng(e);
        
        console.log("Toque detectado vía DOM:", puntoLatLng);
        
        // Guardar en la global para que app.js la vea
        window.nuevaCoordenadaTemp = puntoLatLng; 
        
        // Dibujar el pin naranja
        if (typeof window.posicionarPinEnClic === 'function') {
            window.posicionarPinEnClic(puntoLatLng);
        }
    }, true); // El 'true' activa la fase de captura, priorizando este clic sobre otros
}
