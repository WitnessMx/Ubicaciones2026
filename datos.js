/**
 * MÓDULO: DATOS (CORE)
 * Maneja credenciales, Supabase, IndexedDB y sincronización de registros.
 */

// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================
const SB_URL = "https://izbjauurioyavlpmbgzy.supabase.co"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmphdXVyaW95YXZscG1iZ3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTg1MDQsImV4cCI6MjA4ODA3NDUwNH0.XMWtUt6WKWE2I1GxUwVmbzXdEFv-IEnX7lkMB4LQSqI";
var supabaseClient; // Usamos var para asegurar que sea global
// FORZAR ASIGNACIÓN GLOBAL
window.supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const DB_NAME = "GeoEquiposDB";
const DB_VERSION = 1;

let db;             // Conexión IndexedDB
let equipos = [];   // Array global de registros
var modoReubicacion = false; // Debe ser accesible por app.js y mapa.js
let selectedIndex = -1;
let selectedColor = 'gris';
let filtroActual = 'todos';
var tempNuevoEquipo = null; // Esta es la clave para los registros nuevos

// ==========================================
// 2. INICIALIZACIÓN DE BASE DE DATOS LOCAL
// ==========================================

/**
 * Abre y configura la base de datos local IndexedDB.
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.error("Tu navegador no soporta IndexedDB.");
            return reject("No soportado");
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains("instrumentos")) {
                dbInstance.createObjectStore("instrumentos", { keyPath: "id" });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            console.log("IndexedDB: Conexión establecida.");
            resolve(db);
        };

        request.onerror = (e) => reject(e.target.error);
    });
}

// ==========================================
// 3. CARGA Y SINCRONIZACIÓN
// ==========================================

/**
 * Carga datos locales primero y luego intenta sincronizar con Supabase.
 */
async function cargarDatosLocales() {
    if (!db) return;

    // 1. Cargar lo que hay en el celular (IndexedDB) para mostrar algo rápido
    const tx = db.transaction("instrumentos", "readonly");
    const store = tx.objectStore("instrumentos");
    const req = store.getAll();

    req.onsuccess = async () => {
        equipos = req.result;
        renderLista(); // Mostramos lo que tenemos localmente primero

        // 2. Intentar traer lo de Supabase
        if (navigator.onLine && supabaseClient) {
            try {
                const { data: dataCloud, error } = await supabaseClient
                    .from('instrumentos')
                    .select('*');

                if (error) throw error;

                if (dataCloud) {
                    // ESTO ES PARA TI: Abre la consola (F12) y verás si llegan las fotos
                    console.log("DATOS RECIBIDOS DE SUPABASE:");
                    //console.table(dataCloud); 

                    const saveTx = db.transaction("instrumentos", "readwrite");
                    const saveStore = saveTx.objectStore("instrumentos");
                    
                    dataCloud.forEach(item => {
                        // Normalizamos nombres de columnas de Supabase a la App
                        const equipoNormalizado = {
                            id: item.id,
                            nombre: item.nombre,
                            fecha: item.fecha,
                            status: 'Sincronizado',
                            latitud: item.lat || item.latitud || 0,
                            longitud: item.lng || item.longitud || 0,
                            fotos_urls: item.fotos_urls || [], // <--- CLAVE: Si es null en Supabase, ponemos []
                            estatus_color: item.estatus_color || 'gris',
                            motivo: item.motivo || '',
                            fecha_vencimiento: item.fecha_vencimiento || '',
                            ubicacion: item.ubicacion || ''
                        };

                        saveStore.put(equipoNormalizado);
                    });

                    saveTx.oncomplete = () => {
                        // 3. Una vez guardado en IndexedDB, volvemos a leer para refrescar la pantalla
                        const finalReq = db.transaction("instrumentos", "readonly")
                                           .objectStore("instrumentos").getAll();
                        finalReq.onsuccess = () => {
                            equipos = finalReq.result;
                            console.log("App actualizada con datos de la nube.");
                            if (typeof renderLista === 'function') renderLista();
                            if (typeof renderMapa === 'function') renderMapa();
                            if (typeof actualizarContadores === 'function') actualizarContadores();
                        };
                    };
                }
            } catch (err) {
                console.error("Error al descargar de Supabase:", err);
            }
        }
    };
}
/**
 * Función para subir un registro específico a la nube.
 */
async function sincronizarACloud(equipo) {
    if (!navigator.onLine || !supabaseClient) return;

    try {
        // Aseguramos que fotos_urls sea un array antes de enviar
        const fotosParaSubir = Array.isArray(equipo.fotos_urls) ? equipo.fotos_urls : [];

        const { error } = await supabaseClient.from('instrumentos').upsert({
            id: equipo.id,
            nombre: equipo.nombre,
            fecha: equipo.fecha,
            status: 'Sincronizado', 
            lat: equipo.latitud,
            lng: equipo.longitud,
            fotos_urls: fotosParaSubir, // Aquí se envían todas (viejas y nuevas)
            estatus_color: equipo.estatus_color, 
            motivo: equipo.motivo,
            fecha_vencimiento: equipo.fecha_vencimiento,
            ubicacion: equipo.ubicacion || ''
        });

        if (error) throw error;

        // Actualizamos el objeto localmente a "Sincronizado"
        equipo.status = 'Sincronizado';
        const tx = db.transaction("instrumentos", "readwrite");
        tx.objectStore("instrumentos").put(equipo);
        
        console.log("Sincronización exitosa:", equipo.id);
        if (typeof actualizarContadores === 'function') actualizarContadores();
        if (typeof renderLista === 'function') renderLista();
    } catch (err) {
        console.error("Fallo al subir a Supabase:", err.message);
    }
}

// ==========================================
// 4. ARRANQUE DEL SISTEMA (LIFECYCLE)
// ==========================================

/**
 * Punto de entrada inicial para la carga de datos.
 */
async function inicializarAppDatos() {
    try {
        await initDB();
        await cargarDatosLocales();
        
        // Verificación de conexión constante
        if (typeof verificarConexionSupabase === 'function') {
            verificarConexionSupabase();
        }
    } catch (err) {
        console.error("Fallo crítico al inicializar datos:", err);
    }
}
/**
 * Elimina un registro de IndexedDB y Supabase.
 */
async function borrarRegistro(id) {
    if (!db) return;
    
    // 1. Borrar de Local
    const tx = db.transaction("instrumentos", "readwrite");
    tx.objectStore("instrumentos").delete(id);
    
    // 2. Borrar de Nube (si hay internet)
    if (navigator.onLine && supabaseClient) {
        await supabaseClient.from('instrumentos').delete().eq('id', id);
    }
    
    // 3. Actualizar array global y UI
    equipos = equipos.filter(e => e.id !== id);
    if (typeof renderLista === 'function') renderLista();
    if (typeof renderMapa === 'function') renderMapa();
    closeAllPanels();
}

/**
 * Guarda o actualiza un registro en local y prepara sincronización.
 */
function guardarEnLocal(equipo) {
    if (!db) return;
    
    const transaction = db.transaction(["instrumentos"], "readwrite");
    const store = transaction.objectStore("instrumentos");
    
    // Cambiamos el estatus a Pendiente para que el usuario sepa que aún no llega a la nube
    // (A menos que la función que la llame ya lo haya marcado como Sincronizado)
    if (!equipo.status) equipo.status = 'Pendiente';

    const request = store.put(equipo);

    request.onsuccess = () => {
        // Actualizar el array en memoria
        const index = equipos.findIndex(e => e.id === equipo.id);
        if (index !== -1) {
            equipos[index] = { ...equipo }; // Copia profunda para evitar referencias
        } else {
            equipos.push(equipo);
        }
        
        console.log("Local storage actualizado para:", equipo.id);
        if (typeof actualizarContadores === 'function') actualizarContadores();
    };
    
    request.onerror = (e) => console.error("Error al guardar en IndexedDB", e);
}