/**
 * MÓDULO: UI, NAVEGACIÓN Y CONTROL DE VISTAS
 * Maneja el intercambio de pantallas, filtros y apertura de paneles.
 */

// --- 1. GESTIÓN DE VISTAS PRINCIPALES ---

function showView(view) {
    try {
        const inventoryEl = document.getElementById('inventory-view');
        const mapEl = document.getElementById('map-view');
        const navInv = document.getElementById('nav-inv');
        const navMap = document.getElementById('nav-map');

        if (!inventoryEl || !mapEl) throw new Error("Contenedores de vista no encontrados");

        if (view === 'map') {
            inventoryEl.classList.add('hidden');
            mapEl.classList.remove('hidden');
            if (navMap) navMap.classList.add('text-orange-500');
            if (navInv) navInv.classList.remove('text-orange-500');

            // Intento seguro de inicializar mapa
            if (typeof initMap === 'function') {
                initMap();
                renderMapa();
            } else {
                console.warn("initMap no definida: La interfaz cambió pero el mapa no cargará.");
            }
        } else {
            inventoryEl.classList.remove('hidden');
            mapEl.classList.add('hidden');
            if (navInv) navInv.classList.add('text-orange-500');
            if (navMap) navMap.classList.remove('text-orange-500');
        }
    } catch (err) {
        console.error("Error en showView:", err.message);
    }
}

// --- 2. CONTROL DE PANELES (BOTTOM SHEETS) ---

function closeAllPanels() {
    const panels = ['detail-sheet', 'edit-sheet', 'login-sheet'];
    panels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('open');
    });

    // Desactivamos el overlay y lo escondemos totalmente
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.pointerEvents = 'none';
        }, 300);
    }
}

// --- 3. FILTROS Y BÚSQUEDA ---

function filtrarEquipos(tipo) {
    try {
        filtroActual = tipo; // Variable global requerida
        
        // Actualización visual de botones de filtro
        const filtros = {
            'todos': 'filter-all',
            'Sincronizado': 'filter-sync',
            'Pendiente': 'filter-local'
        };

        Object.values(filtros).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.replace('border-orange-500', 'border-transparent');
        });

        const activeId = filtros[tipo];
        const activeEl = document.getElementById(activeId);
        if (activeEl) activeEl.classList.replace('border-transparent', 'border-orange-500');

        // Llamada segura al render
        if (typeof renderLista === 'function') {
            renderLista();
        }
        if (typeof renderMapa === 'function') renderMapa();
    } catch (err) {
        console.warn("Filtro aplicado, pero renderLista no está lista.");
    }
}

function buscarPorID() {
    // Esta función es disparada por oninput en el HTML
    if (typeof renderLista === 'function') {
        renderLista();
    }
    if (typeof renderMapa === 'function') renderMapa();
}

// --- 4. ACTUALIZACIÓN DE ESTADO (AUTH & CLOUD) ---

async function actualizarPermisosUI() {
    try {
        // Verificamos si Supabase está cargado
        if (!window.supabase || !supabaseClient) return;

        const { data: { session } } = await supabaseClient.auth.getSession();
        const isLoggedIn = !!session;

        const icon = document.getElementById('login-icon');
        const fabAdd = document.getElementById('fab-add');
        const adminElements = document.querySelectorAll('.admin-only');

        if (icon) icon.className = isLoggedIn ? 'fa-solid fa-lock-open text-blue-500' : 'fa-solid fa-lock text-gray-400';
        if (fabAdd) fabAdd.style.display = isLoggedIn ? 'flex' : 'none';
        
        adminElements.forEach(el => {
            el.classList.toggle('hidden', !isLoggedIn);
        });
    } catch (err) {
        console.warn("Manejo de permisos: Fallo silencioso (posible falta de conexión o Supabase).");
    }
}

// --- 5. UTILIDADES DE CONTEO ---

function actualizarContadores() {
    try {
        // Usamos optional chaining y default values por si 'equipos' no existe todavía
        const lista = Array.isArray(equipos) ? equipos : [];
        
        const countAll = document.getElementById('count-all');
        const countSync = document.getElementById('count-sync');
        const countLocal = document.getElementById('count-local');

        if (countAll) countAll.innerText = lista.length;
        if (countSync) countSync.innerText = lista.filter(e => e.status === 'Sincronizado').length;
        if (countLocal) countLocal.innerText = lista.filter(e => e.status === 'Pendiente').length;
    } catch (err) {
        console.log("Contadores esperando datos...");
    }
}

/**
 * MÓDULO: RENDERIZADO DE INTERFAZ
 * Se encarga de transformar los datos de datos.js en elementos visuales.
 */

function renderLista() {
    // 1. Localizar el contenedor en el HTML
    const contenedor = document.getElementById('lista-equipos');
    if (!contenedor) return;

    // 2. Limpiar el contenedor (evita duplicados al refrescar)
    contenedor.innerHTML = "";

    // 3. Verificación de seguridad: ¿Hay datos en el array global?
    // 'equipos' viene de datos.js
    if (!equipos || equipos.length === 0) {
        contenedor.innerHTML = `
            <div class="flex flex-col items-center justify-center p-10 text-gray-400">
                <i class="fa-solid fa-box-open text-4xl mb-4 opacity-20"></i>
                <p class="text-xs font-bold uppercase tracking-widest">Sin registros disponibles</p>
            </div>`;
        actualizarContadores();
        return;
    }

    // 4. Obtener el texto de búsqueda del input (si existe)
    const busqueda = (document.getElementById('search-id')?.value || "").toUpperCase();

    // 5. Filtrar y Dibujar
    const filtrados = equipos.filter(eq => {
        const cumpleFiltro = (filtroActual === 'todos' || eq.status === filtroActual);
        const cumpleBusqueda = eq.id.toUpperCase().includes(busqueda);
        return cumpleFiltro && cumpleBusqueda;
    });

    filtrados.forEach((eq) => {
        // Buscamos el índice original para la función de detalles
        const originalIndex = equipos.findIndex(e => e.id === eq.id);
        
        // Mapeo de colores (Consistente con tu diseño)
        const colorMap = { 
            verde: 'bg-green-500', 
            amarillo: 'bg-yellow-400', 
            rojo: 'bg-red-500', 
            gris: 'bg-gray-400' 
        };
        const statusColor = colorMap[eq.estatus_color] || 'bg-gray-400';

        const statusMap = {
            'verde': 'Activo',
            'amarillo': 'Incompleto',
            'rojo': 'Bloqueado',
            'gris': 'Inactivo'
        };
        const nombreEstatus = statusMap[eq.estatus_color] || 'Desconocido';

        // Crear el elemento visual (Tarjeta)
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-[2rem] shadow-sm flex items-center gap-4 active:scale-95 transition-all cursor-pointer border-2 border-transparent hover:border-orange-100";
        
        // Al hacer clic, llamamos a openDetails (que definiremos luego)
        card.onclick = () => {
            if (typeof openDetails === 'function') openDetails(originalIndex);
        };

        card.innerHTML = `
            <div class="w-12 h-12 ${statusColor} rounded-2xl flex items-center justify-center text-white shadow-lg">
                <i class="fa-solid fa-microscope text-lg"></i>
            </div>
            <div class="flex-1">
                <h3 class="font-black text-gray-800 text-sm uppercase leading-none">${eq.id}</h3>
                <p class="text-[10px] font-bold text-gray-400 uppercase truncate mt-1" style="max-width: 150px;">
                    ${eq.nombre}
                </p>
            </div>
            <div class="text-right">
                <p class="text-[8px] font-black ${eq.status === 'Sincronizado' ? 'text-blue-500' : 'text-orange-500'} uppercase mb-1">
                    ${eq.status}
                </p>
                <i class="fa-solid ${eq.status === 'Sincronizado' ? 'fa-cloud-check' : 'fa-clock-rotate-left'} text-xs text-gray-200"></i>
            </div>
        `;
        
        contenedor.appendChild(card);
    });

    // 6. Actualizar los números de la parte superior
    if (typeof actualizarContadores === 'function') {
        actualizarContadores();
    }
}
/**
 * MÓDULO: DETALLES Y MULTIMEDIA
 * Abre el panel de información y gestiona la galería de imágenes.
 */

function openDetails(index) {
    try {
        selectedIndex = index;
        const eq = equipos[index];
        if (!eq) return;

        // 1. Mapeo de Colores y Textos de Estatus
        const statusMap = {
            'verde': { bg: 'bg-green-500', text: 'Activo' },
            'amarillo': { bg: 'bg-yellow-400', text: 'Falta Documentos' },
            'rojo': { bg: 'bg-red-500', text: 'Bloqueado' },
            'gris': { bg: 'bg-gray-500', text: 'Inactivo' }
        };
        const st = statusMap[eq.estatus_color] || statusMap['gris'];

        // 2. Aplicar Color al Encabezado
        const header = document.getElementById('det-header-color');
        header.className = `p-8 pt-10 transition-colors duration-500 ${st.bg}`;

        // 3. Llenado de Datos Críticos
        document.getElementById('det-id').innerText = eq.id;
        document.getElementById('det-title').innerText = eq.nombre;
        document.getElementById('det-status-text').innerText = st.text;
        document.getElementById('det-fecha-venc').innerText = eq.fecha_vencimiento || '---';

        // 4. Llenado de Datos Secundarios
        document.getElementById('det-motivo').innerText = eq.motivo || 'Sin observaciones.';
        document.getElementById('det-fecha-reg').innerText = eq.fecha || '---';
        document.getElementById('det-ubicacion-fisica').innerText = eq.ubicacion || 'No especificada';

        const coordsEl = document.getElementById('det-coords');
        if (coordsEl) {
            coordsEl.innerText = `${(eq.latitud || 0).toFixed(2)}, ${(eq.longitud || 0).toFixed(2)}`;
        }

        // 5. Multimedia y UI
        renderGallery(eq.fotos_urls || []);
        document.getElementById('detail-sheet').classList.add('open');
        document.getElementById('overlay').classList.add('active');
        
        if (typeof actualizarPermisosUI === 'function') actualizarPermisosUI();

    } catch (err) {
        console.error("Error al abrir detalles:", err);
    }
}

/**
 * Renderiza las imágenes adjuntas en el contenedor de galería.
 */
function renderGallery(urls) {
    const gallery = document.getElementById('det-gallery');
    if (!gallery) {
        console.error("Error: No se encontró el contenedor 'det-gallery' en el HTML.");
        return;
    }
    
    // Limpiamos la galería antes de dibujar
    gallery.innerHTML = "";

    // VALIDACIÓN CRÍTICA: 
    // Si 'urls' es una cadena de texto (a veces sucede por la base de datos), la convertimos en array
    let listaUrls = urls;
    if (typeof urls === 'string') {
        try {
            listaUrls = JSON.parse(urls);
        } catch (e) {
            listaUrls = [urls]; // Si no es JSON, lo metemos en un array de un solo elemento
        }
    }

    if (!listaUrls || !Array.isArray(listaUrls) || listaUrls.length === 0) {
        gallery.innerHTML = `
            <div class="flex flex-col items-center justify-center w-full py-6 border-2 border-dashed border-gray-100 rounded-2xl">
                <i class="fa-solid fa-image text-gray-200 text-3xl mb-2"></i>
                <p class="text-[10px] font-bold text-gray-400 uppercase">Sin evidencias adjuntas</p>
            </div>`;
        return;
    }

    // Dibujamos cada imagen
    listaUrls.forEach((url, idx) => {
        if (!url) return; // Saltamos si la url es nula o vacía

        const imgDiv = document.createElement('div');
        imgDiv.className = "relative flex-shrink-0";
        imgDiv.innerHTML = `
            <img src="${url}" 
                 onclick="window.open('${url}', '_blank')" 
                 onerror="this.src='https://via.placeholder.com/150?text=Error+Imagen'"
                 class="w-32 h-32 object-cover rounded-2xl shadow-md border-2 border-white cursor-pointer hover:scale-105 transition-transform">
            <button onclick="eliminarFoto(${idx})" 
                    class="admin-only hidden absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-[10px] shadow-lg border-2 border-white flex items-center justify-center">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        gallery.appendChild(imgDiv);
    });

    // Forzamos a que se muestren los botones de borrar si el admin está logeado
    if (typeof actualizarPermisosUI === 'function') {
        actualizarPermisosUI();
    }
}



// --- AGREGAR NUEVO ---
function prepareAdd() {
    const idInput = document.getElementById('inp-id');
    idInput.disabled = false;
    idInput.value = "";
    document.getElementById('form-equipo').reset();
    document.getElementById('inp-ubicacion').value = "";
    document.getElementById('edit-panel-title').innerText = "Nuevo Registro";
    document.getElementById('btn-borrar').classList.add('hidden');
    
    // Primero pedimos los datos, luego la ubicación
    document.getElementById('edit-sheet').classList.add('open');
    document.getElementById('overlay').classList.add('active');
}

// --- EDITAR EXISTENTE ---
function prepararEdicionDesdeDetalle() {
    const eq = equipos[selectedIndex];
    if (!eq) return;

    document.getElementById('edit-panel-title').innerText = "Editando: " + eq.id;
    const idInput = document.getElementById('inp-id');
    idInput.value = eq.id;
    idInput.disabled = true; // No se puede editar ID

    document.getElementById('inp-nombre').value = eq.nombre;
    document.getElementById('inp-venc').value = eq.fecha_vencimiento || "";
    document.getElementById('inp-color').value = eq.estatus_color;
    document.getElementById('inp-motivo').value = eq.motivo;
    document.getElementById('inp-ubicacion').value = eq.ubicacion || "";
    document.getElementById('btn-borrar').classList.remove('hidden');
    document.getElementById('edit-sheet').classList.add('open');
}

/**
 * Procesa el formulario y decide si requiere mapa o guarda directo
 */
function guardarCambios() {
    const id = document.getElementById('inp-id').value;
    if (!id) return alert("El ID es obligatorio");

    const esNuevo = !document.getElementById('inp-id').disabled;
    const actual = equipos.find(e => e.id === id);

    // Recuperamos las fotos que se subieron al panel (están en el temp)
    const fotosNuevas = (tempNuevoEquipo && tempNuevoEquipo.fotos_urls) ? tempNuevoEquipo.fotos_urls : [];
    // Recuperamos las fotos que ya existían en la base de datos
    const fotosExistentes = actual ? (actual.fotos_urls || []) : [];

    // Combinamos ambas sin duplicar
    const todasLasFotos = [...fotosExistentes, ...fotosNuevas];

    tempNuevoEquipo = {
        id: id,
        nombre: document.getElementById('inp-nombre').value,
        // AÑADE ESTA LÍNEA:
        ubicacion: document.getElementById('inp-ubicacion').value, 
        fecha_vencimiento: document.getElementById('inp-venc').value,
        estatus_color: document.getElementById('inp-color').value,
        motivo: document.getElementById('inp-motivo').value,
        fecha: actual ? actual.fecha : new Date().toLocaleDateString(),
        latitud: actual ? actual.latitud : null,
        longitud: actual ? actual.longitud : null,
        fotos_urls: todasLasFotos
    };

    if (esNuevo || !tempNuevoEquipo.latitud) {
        // Ir al mapa (tempNuevoEquipo conserva las fotos para confirmarPosicionClic)
        closeAllPanels();
        showView('map');
        modoReubicacion = true;
        document.getElementById('reubicacion-hint').classList.remove('hidden');
        prepararMapaParaClic();
    } else {
        // Guardado directo (Edición)
        guardarEnLocal(tempNuevoEquipo);

        const idx = equipos.findIndex(e => e.id === tempNuevoEquipo.id);
        if (idx !== -1) equipos[idx] = {...tempNuevoEquipo};
        if (typeof sincronizarACloud === 'function') {
            sincronizarACloud(tempNuevoEquipo);
        }
        
        tempNuevoEquipo = null; 
        closeAllPanels();
        renderLista();
        if (typeof renderMapa === 'function') renderMapa();
    }
}

/**
 * Activa el modo para mover un equipo EXISTENTE
 */
function activarModoReubicacion() {
    if (selectedIndex === -1) return alert("Selecciona un equipo primero.");
    const eq = equipos[selectedIndex];

    modoReubicacion = true;
    tempNuevoEquipo = null; 
    window.nuevaCoordenadaTemp = null; 

    document.getElementById('txt-reubicar').innerText = `Selecciona la nueva ubicación de ${eq.id}`;
    
    showView('map');
    closeAllPanels();
    
    prepararMapaParaClic(); // Llamamos a la nueva función limpiadora
}
// En mapa.js, actualiza configurarEventosMapa para que responda a esto:
// (Modificar en mapa.js)
function configurarEventosMapa() {
    map.on('click', (e) => {
        if (!modoReubicacion) return;

        if (tempNuevoEquipo) {
            tempNuevoEquipo.latitud = e.latlng.lat;
            tempNuevoEquipo.longitud = e.latlng.lng;
            
            guardarEnLocal(tempNuevoEquipo);
            
            modoReubicacion = false;
            document.getElementById('reubicacion-hint').classList.add('hidden');
            tempNuevoEquipo = null;
            alert("Ubicación guardada con éxito.");
        }
    });
}

// --- BORRAR ---
function confirmarBorrado() {
    const id = document.getElementById('inp-id').value;
    if (confirm(`¿Estás seguro de eliminar el equipo ${id}? Esta acción no se puede deshacer.`)) {
        borrarRegistro(id);
    }
}
/**
 * Cancela cualquier edición
 */
function cancelarReubicacion() {
    modoReubicacion = false;
    tempNuevoEquipo = null;
    window.nuevaCoordenadaTemp = null;

    if (window.map) {
        window.map.off('click'); // Apagamos el escuchador
        if (typeof ghostMarker !== 'undefined' && ghostMarker) {
            window.map.removeLayer(ghostMarker);
            ghostMarker = null;
        }
    }

    document.getElementById('reubicacion-hint').classList.add('hidden');
    showView('inventory'); 
}
/**
 * Abre el panel de login o cierra sesión si ya está logeado.
 */
async function toggleLogin() {
    // 1. Verificamos la variable global forzada
    const client = window.supabaseClient;

    if (!client) {
        console.error("Supabase Client no encontrado en window");
        alert("Error crítico: No se pudo establecer conexión con el servidor.");
        return;
    }

    try {
        const { data: { session } } = await client.auth.getSession();
        
        if (session) {
            if (confirm("¿Cerrar sesión de administrador?")) {
                await client.auth.signOut();
                actualizarPermisosUI();
                alert("Sesión cerrada.");
            }
        } else {
            document.getElementById('login-sheet').classList.add('open');
            document.getElementById('overlay').classList.add('active');
        }
    } catch (err) {
        console.error("Error en auth:", err);
    }
}
/**
 * Procesa el inicio de sesión con Supabase.
 */
async function ejecutarLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) return alert("Completa todos los campos.");

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        alert("¡Bienvenido, Administrador!");
        closeAllPanels();
        actualizarPermisosUI(); // Esta función activará los botones ocultos
        
    } catch (err) {
        alert("Error de acceso: " + err.message);
    }
}

/**
 * Controla la visibilidad de elementos admin según la sesión.
 */
async function actualizarPermisosUI() {
    const client = window.supabaseClient;
    if (!client) return;

    try {
        const { data: { session } } = await client.auth.getSession();
        const isLoggedIn = !!session;

        // Candado
        const icon = document.getElementById('login-icon');
        if (icon) {
            icon.className = isLoggedIn ? 'fa-solid fa-lock-open text-orange-500' : 'fa-solid fa-lock text-gray-400';
        }

        // Elementos .admin-only
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.toggle('hidden', !isLoggedIn);
        });

        // Botón +
        const fabAdd = document.getElementById('fab-add');
        if (fabAdd) {
            fabAdd.classList.toggle('hidden', !isLoggedIn);
            if (isLoggedIn) fabAdd.classList.add('flex');
        }
    } catch (err) {
        console.warn("Error al verificar sesión");
    }
}
/**
 * Toma la coordenada del centro del mapa y guarda el registro
 */
/**
 * Guarda el cambio solo si se presionó el botón de confirmar
 */
/**
 * Guarda la posición seleccionada directamente al presionar el botón.
 * Se eliminaron los mensajes de confirmación para agilizar el proceso.
 */
function confirmarPosicionClic() {
    console.log("click en confirmar");
    const coord = window.nuevaCoordenadaTemp;

    if (!coord) {
        alert("Primero toca el mapa para indicar la posición.");
        return;
    }

    let equipoAActualizar = null;
    let esNuevo = false;

    if (tempNuevoEquipo) {
        equipoAActualizar = tempNuevoEquipo;
        esNuevo = true;
    } else if (selectedIndex !== -1 && equipos[selectedIndex]) {
        equipoAActualizar = equipos[selectedIndex];
    }

    if (equipoAActualizar) {
        // Actualizamos las coordenadas
        equipoAActualizar.latitud = coord.lat;
        equipoAActualizar.longitud = coord.lng;
        equipoAActualizar.status = 'Pendiente'; 

        // --- EL CAMBIO CRÍTICO ESTÁ AQUÍ ---
        // Si es nuevo, lo agregamos al array global inmediatamente para que la UI lo vea
        if (esNuevo) {
            const existeYa = equipos.find(e => e.id === equipoAActualizar.id);
            if (!existeYa) {
                equipos.push(equipoAActualizar);
            }
        }
        // ------------------------------------

        // 1. Guardar en IndexedDB
        guardarEnLocal(equipoAActualizar);
        
        // 2. Sincronizar a Supabase
        if (typeof sincronizarACloud === 'function' && navigator.onLine) {
            sincronizarACloud(equipoAActualizar);
        }
        
        // 3. Limpiar UI del mapa
        if (window.ghostMarker) {
            window.map.removeLayer(window.ghostMarker);
            window.ghostMarker = null;
        }
        
        // 4. Resetear estados
        modoReubicacion = false;
        document.getElementById('reubicacion-hint').classList.add('hidden');
        
        // 5. Refrescar visualización AHORA que el array global está actualizado
        if (typeof renderMapa === 'function') renderMapa();
        if (typeof renderLista === 'function') renderLista();
        
        // Limpiamos los temporales
        tempNuevoEquipo = null;
        window.nuevaCoordenadaTemp = null;
        
        alert(esNuevo ? "Equipo registrado y ubicado con éxito." : "Ubicación actualizada correctamente.");
    } else {
        alert("Hubo un error al identificar el equipo.");
    }
}

/**
 * Prepara el mapa eliminando obstáculos invisibles y activando el clic nativo
 */
function prepararMapaParaClic() {
    // 1. ELIMINAR EL MURO INVISIBLE: Ocultamos completamente el overlay
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'none'; 
        overlay.style.pointerEvents = 'none';
    }

    // Mostramos el letrero superior
    document.getElementById('reubicacion-hint').classList.remove('hidden');

    setTimeout(() => {
        if (window.map) {
            window.map.invalidateSize();
            
            // 2. Apagamos clics viejos para no duplicar
            window.map.off('click');
            
            // 3. Encendemos el clic nativo de Leaflet directamente aquí
            window.map.on('click', function(e) {
                if (modoReubicacion) {
                    window.nuevaCoordenadaTemp = e.latlng;
                    if (typeof window.posicionarPinEnClic === 'function') {
                        window.posicionarPinEnClic(e.latlng);
                    }
                }
            });
        }
    }, 400);
}
/**
 * PROCESAR IMAGEN: Busca elementos relativos al input que se tocó
 */
async function procesarImagenDinamica(input) {
    // 1. Validaciones iniciales
    if (!input.files || !input.files[0] || selectedIndex === -1) {
        console.warn("No hay archivo seleccionado o no hay un equipo seleccionado.");
        return;
    }

    const file = input.files[0];
    const equipo = equipos[selectedIndex];
    const BUCKET_NAME = 'fotos_equipos'; // Nombre actualizado

    console.log("Iniciando subida a:", BUCKET_NAME);

    try {
        // 2. Preparar nombre de archivo único para evitar sobrescrituras
        const fileExt = file.name.split('.').pop();
        const fileName = `${equipo.id}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`; // Ruta dentro del bucket

        // 3. Subida directa al Storage de Supabase
        const { data, error } = await window.supabaseClient
            .storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // 4. Obtener la URL Pública generada
        const { data: { publicUrl } } = window.supabaseClient
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        // 5. Actualizar el registro en memoria y local
        if (!equipo.fotos_urls) equipo.fotos_urls = [];
        equipo.fotos_urls.push(publicUrl);

        // 6. Persistencia Total (Local + Nube)
        // Esto actualiza la columna 'fotos_urls' en la tabla 'instrumentos'
        guardarEnLocal(equipo);
        
        if (navigator.onLine) {
            await sincronizarACloud(equipo);
            console.log("Base de datos actualizada con la nueva URL.");
        }

        // 7. Refrescar la UI de la galería inmediatamente
        renderGallery(equipo.fotos_urls);
        if (typeof renderMapa === 'function') renderMapa();
    } catch (err) {
        console.error("Error crítico en la subida:", err.message);
        alert("Error: Asegúrate de que el bucket '" + BUCKET_NAME + "' exista y sea PÚBLICO en Supabase.");
    } finally {
        input.value = ""; // Resetear el input para permitir subir la misma foto si se desea
    }
}

/**
 * ELIMINAR FOTO: Busca elementos relativos al botón "X"
 */
function quitarFotoDinamica(boton) {
    const container = boton.closest('.container-evidencia');
    const input = container.querySelector('input[type="file"]');
    const previewDiv = container.querySelector('.preview-foto-clase');
    const imgElement = container.querySelector('.img-preview-clase');
    const placeholder = container.querySelector('.placeholder-clase');

    if (input) input.value = "";
    if (previewDiv) previewDiv.style.display = 'none';
    if (imgElement) imgElement.src = "";
    if (placeholder) placeholder.style.display = 'block';

    // NOTA: No limpies tempNuevoEquipo aquí, 
    // deja que se limpie solo hasta que el usuario guarde o cancele todo.
}
// Primero, crea esta función de apoyo si no la tienes
function eliminarFoto(idx) {
    const eq = equipos[selectedIndex];
    if (!eq) return;

    if (confirm("¿Eliminar esta imagen de la evidencia?")) {
        // Eliminar del array local
        eq.fotos_urls.splice(idx, 1);
        
        // Guardar en IndexedDB
        guardarEnLocal(eq);
        
        // Sincronizar cambio a Supabase (Enviamos el objeto con el array reducido)
        if (typeof sincronizarACloud === 'function') {
            sincronizarACloud(eq);
        }
        
        // Refrescar la galería visualmente
        renderGallery(eq.fotos_urls);
    }
}