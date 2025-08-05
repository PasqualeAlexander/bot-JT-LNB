/* 
* ██████╗  ██████╗ ████████╗   ██╗     ███╗   ██╗██████╗         ██╗████████╗
* ██╔══██╗██╔═══██╗╚══██╔══╝   ██║     ████╗  ██║██╔══██╗        ██║╚══██╔══╝
* ██████╔╝██║   ██║   ██║      ██║     ██╔██╗ ██║██████╔╝        ██║   ██║   
* ██╔══██╗██║   ██║   ██║      ██║     ██║╚██╗██║██╔══██╗   ██   ██║   ██║   
* ██████╔╝╚██████╔╝   ██║      ███████╗██║ ╚████║██████╔╝   ╚█████╔╝   ██║   
* ╚═════╝  ╚═════╝    ╚═╝      ╚══════╝╚═╝  ╚═══╝╚═════╝     ╚════╝    ╚═╝    

BOT LIGA NACIONAL DE BIGGER LNB - VERSION HEADLESS
   Compatible con HaxBall Headless Host
   ============================== */

// ==================== DETECCIÓN DE ENTORNO Y COMPATIBILIDAD ====================
const isNode = typeof window === 'undefined';

// Polyfill para fetch en Node.js si no está disponible
if (isNode && typeof fetch === 'undefined') {
    try {
        global.fetch = require('node-fetch');
        global.FormData = require('form-data');
    } catch (error) {
        // node-fetch no disponible - funciones de Discord deshabilitadas
    }
}

// Importar sistema de desbaneo
let ejecutarDesbaneo = null;
if (isNode) {
    try {
        const unbanSystem = require('./unban_system.js');
        ejecutarDesbaneo = unbanSystem.ejecutarDesbaneo;
        console.log('✅ Sistema de desbaneo importado correctamente');
    } catch (error) {
        console.warn('⚠️ No se pudo importar el sistema de desbaneo:', error.message);
    }
}

// ==================== SISTEMA DE ALMACENAMIENTO CON BASE DE DATOS ====================
// Funciones para manejo de almacenamiento usando SQLite a través de Node.js

// ==================== SISTEMA DE BACKUP AUTOMÁTICO ====================
class SistemaBackup {
    constructor() {
        this.intervaloBackup = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
        this.maxBackupsGuardados = 7; // Mantener últimos 7 backups
        this.rutaBackups = 'backups/'; // Carpeta de backups
        this.ultimoBackup = null;
        this.timerBackup = null;
        
        // Inicializar sistema de backup
        this.inicializar();
    }
    
    inicializar() {
        console.log('🔄 Inicializando sistema de backup automático...');
        
        // Verificar si existe la carpeta de backups
        this.verificarCarpetaBackups();
        
        // Cargar información del último backup
        this.cargarInfoUltimoBackup();
        
        // Programar próximo backup
        this.programarProximoBackup();
        
        // Realizar backup inicial si no hay ninguno reciente
        this.verificarBackupInicial();
        
        console.log('✅ Sistema de backup automático inicializado');
    }
    
    verificarCarpetaBackups() {
        try {
            if (typeof nodeVerificarCarpeta === 'function') {
                nodeVerificarCarpeta(this.rutaBackups);
                console.log(`📁 Carpeta de backups verificada: ${this.rutaBackups}`);
            } else {
                console.warn('⚠️ Función nodeVerificarCarpeta no disponible - usando localStorage como respaldo');
            }
        } catch (error) {
            console.error('❌ Error verificando carpeta de backups:', error);
        }
    }
    
    async crearBackupCompleto(motivo = 'Backup automático') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const nombreArchivo = `backup_lnb_${timestamp}.json`;
        
        try {
            console.log(`🔄 Creando backup: ${motivo}`);
            
            // Recopilar todos los datos importantes
            const datosBackup = {
                metadata: {
                    version: '1.0',
                    fecha: new Date().toISOString(),
                    motivo: motivo,
                    bot_version: 'LNB v4.0',
                    total_jugadores: Object.keys(estadisticasGlobales?.jugadores || {}).length,
                    total_partidos: estadisticasGlobales?.totalPartidos || 0
                },
                
                // Datos principales
                estadisticas_globales: estadisticasGlobales || {},
                
                // Configuraciones importantes
                configuracion: {
                    mapa_actual: mapaActual,
                    auto_start_enabled: autoStartEnabled,
                    auto_stop_enabled: autoStopEnabled,
                    cambios_camiseta_red: cambiosCamisetaRed,
                    cambios_camiseta_blue: cambiosCamisetaBlue,
                    contraseña_actual: contraseñaActual ? '[PROTEGIDA]' : null,
                    ultimo_cambio_contraseña: ultimoCambioContraseña
                },
                
                // Datos de sesión importantes (sin datos sensibles)
                datos_sesion: {
                    jugadores_roles: Array.from(jugadoresConRoles.entries()).map(([id, rol]) => ({
                        id: id,
                        rol: rol.role,
                        asignado: rol.assignedAt
                    })),
                    
                    mensajes_personalizados: Array.from(mensajesPersonalizados.entries()).map(([id, msgs]) => ({
                        id: id,
                        mensajes: msgs,
                        ultimo_uso: msgs.ultimoUso
                    })),
                    
                    cooldown_llamar_admin: cooldownLlamarAdmin
                },
                
                // Estadísticas del sistema
                estadisticas_sistema: {
                    tiempo_actividad: Date.now() - (estadisticasGlobales?.fechaCreacion ? new Date(estadisticasGlobales.fechaCreacion).getTime() : Date.now()),
                    partidos_hoy: this.contarPartidosHoy(),
                    jugadores_activos_7_dias: this.contarJugadoresActivos7Dias()
                }
            };
            
            // Intentar guardar usando función de Node.js si está disponible
            if (typeof nodeGuardarBackup === 'function') {
                const resultado = await nodeGuardarBackup(this.rutaBackups + nombreArchivo, datosBackup);
                
                if (resultado.success) {
                    console.log(`✅ Backup creado exitosamente: ${nombreArchivo}`);
                    console.log(`📊 Estadísticas del backup:`);
                    console.log(`   - Jugadores: ${datosBackup.metadata.total_jugadores}`);
                    console.log(`   - Partidos: ${datosBackup.metadata.total_partidos}`);
                    console.log(`   - Tamaño: ${this.formatearTamaño(JSON.stringify(datosBackup).length)}`);
                    
                    // Actualizar información del último backup
                    this.ultimoBackup = {
                        fecha: new Date().toISOString(),
                        archivo: nombreArchivo,
                        motivo: motivo,
                        tamaño: JSON.stringify(datosBackup).length
                    };
                    
                    // Guardar info del último backup
                    this.guardarInfoUltimoBackup();
                    
                    // Limpiar backups antiguos
                    await this.limpiarBackupsAntiguos();
                    
                    // Anunciar en el juego si hay jugadores conectados
                    if (typeof room !== 'undefined' && room && room.getPlayerList) {
                        const jugadores = room.getPlayerList();
                        if (jugadores.length > 1) { // Solo si hay jugadores (más que el bot)
                            anunciarInfo(`💾 Backup automático completado - ${datosBackup.metadata.total_jugadores} jugadores guardados`);
                        }
                    }
                    
                    return {
                        success: true,
                        archivo: nombreArchivo,
                        datos: datosBackup.metadata
                    };
                } else {
                    throw new Error(resultado.error || 'Error desconocido en nodeGuardarBackup');
                }
            } else {
                // Respaldo usando localStorage/sessionStorage
                console.warn('⚠️ nodeGuardarBackup no disponible, usando localStorage como respaldo');
                
                const backupComprimido = this.comprimirDatos(datosBackup);
                localStorage.setItem(`backup_${timestamp}`, backupComprimido);
                
                console.log(`✅ Backup guardado en localStorage: backup_${timestamp}`);
                
                // Limpiar backups antiguos del localStorage
                this.limpiarBackupsLocalStorage();
                
                return {
                    success: true,
                    archivo: `backup_${timestamp}`,
                    storage: 'localStorage'
                };
            }
            
        } catch (error) {
            console.error('❌ Error creando backup:', error);
            
            // Anunciar error si hay jugadores conectados
            if (typeof room !== 'undefined' && room && room.getPlayerList) {
                const jugadores = room.getPlayerList();
                if (jugadores.length > 1) {
                    anunciarAdvertencia('⚠️ Error en backup automático - contactar administrador');
                }
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    contarPartidosHoy() {
        if (!estadisticasGlobales || !estadisticasGlobales.jugadores) return 0;
        
        const hoy = new Date().toISOString().split('T')[0];
        let partidosHoy = 0;
        
        // Estimar partidos de hoy basado en actividad de jugadores
        Object.values(estadisticasGlobales.jugadores).forEach(jugador => {
            if (jugador.fechaUltimoPartido && jugador.fechaUltimoPartido.startsWith(hoy)) {
                partidosHoy++;
            }
        });
        
        return Math.floor(partidosHoy / 6); // Aproximación (6 jugadores promedio por partido)
    }
    
    contarJugadoresActivos7Dias() {
        if (!estadisticasGlobales || !estadisticasGlobales.jugadores) return 0;
        
        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        
        let jugadoresActivos = 0;
        
        Object.values(estadisticasGlobales.jugadores).forEach(jugador => {
            if (jugador.fechaUltimoPartido) {
                const fechaUltimoPartido = new Date(jugador.fechaUltimoPartido);
                if (fechaUltimoPartido >= hace7Dias) {
                    jugadoresActivos++;
                }
            }
        });
        
        return jugadoresActivos;
    }
    
    comprimirDatos(datos) {
        // Comprimir datos para localStorage (simple)
        try {
            return JSON.stringify(datos);
        } catch (error) {
            console.error('❌ Error comprimiendo datos:', error);
            return '{}';
        }
    }
    
    formatearTamaño(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    programarProximoBackup() {
        // Limpiar timer anterior si existe
        if (this.timerBackup) {
            clearTimeout(this.timerBackup);
        }
        
        // Calcular tiempo hasta el próximo backup
        let tiempoHastaProximoBackup = this.intervaloBackup;
        
        if (this.ultimoBackup && this.ultimoBackup.fecha) {
            const tiempoTranscurrido = Date.now() - new Date(this.ultimoBackup.fecha).getTime();
            tiempoHastaProximoBackup = Math.max(0, this.intervaloBackup - tiempoTranscurrido);
        }
        
        console.log(`⏰ Próximo backup automático en: ${this.formatearTiempo(tiempoHastaProximoBackup)}`);
        
        // Programar el próximo backup
        this.timerBackup = setTimeout(() => {
            this.ejecutarBackupAutomatico();
        }, tiempoHastaProximoBackup);
    }
    
    async ejecutarBackupAutomatico() {
        console.log('🕐 Ejecutando backup automático programado...');
        
        const resultado = await this.crearBackupCompleto('Backup automático diario');
        
        if (resultado.success) {
            console.log('✅ Backup automático completado exitosamente');
        } else {
            console.error('❌ Backup automático falló:', resultado.error);
        }
        
        // Programar el siguiente backup
        this.programarProximoBackup();
    }
    
    formatearTiempo(milisegundos) {
        const horas = Math.floor(milisegundos / (1000 * 60 * 60));
        const minutos = Math.floor((milisegundos % (1000 * 60 * 60)) / (1000 * 60));
        
        if (horas > 0) {
            return `${horas}h ${minutos}m`;
        } else {
            return `${minutos}m`;
        }
    }
    
    verificarBackupInicial() {
        // Si no hay backup reciente (últimas 25 horas), crear uno inmediatamente
        if (!this.ultimoBackup || 
            (Date.now() - new Date(this.ultimoBackup.fecha).getTime()) > (25 * 60 * 60 * 1000)) {
            
            console.log('📝 No hay backup reciente, creando backup inicial...');
            
            // Crear backup inicial después de 30 segundos (dar tiempo a que se carguen los datos)
            setTimeout(() => {
                this.crearBackupCompleto('Backup inicial al iniciar');
            }, 30000);
        }
    }
    
    cargarInfoUltimoBackup() {
        try {
            const info = localStorage.getItem('ultimo_backup_info');
            if (info) {
                this.ultimoBackup = JSON.parse(info);
                console.log(`📄 Último backup: ${this.ultimoBackup.archivo} (${new Date(this.ultimoBackup.fecha).toLocaleString()})`);
            }
        } catch (error) {
            console.warn('⚠️ No se pudo cargar info del último backup:', error.message);
        }
    }
    
    guardarInfoUltimoBackup() {
        try {
            localStorage.setItem('ultimo_backup_info', JSON.stringify(this.ultimoBackup));
        } catch (error) {
            console.warn('⚠️ No se pudo guardar info del último backup:', error.message);
        }
    }
    
    async limpiarBackupsAntiguos() {
        try {
            if (typeof nodeLimpiarBackupsAntiguos === 'function') {
                const resultado = await nodeLimpiarBackupsAntiguos(this.rutaBackups, this.maxBackupsGuardados);
                if (resultado.success) {
                    console.log(`🧹 Backups antiguos limpiados: ${resultado.eliminados} archivos`);
                }
            }
        } catch (error) {
            console.warn('⚠️ Error limpiando backups antiguos:', error.message);
        }
    }
    
    limpiarBackupsLocalStorage() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('backup_'));
            
            // Mantener solo los últimos 3 backups en localStorage
            if (keys.length > 3) {
                const backupsOrdenados = keys
                    .map(key => ({ key, fecha: key.replace('backup_', '') }))
                    .sort((a, b) => b.fecha.localeCompare(a.fecha));
                
                // Eliminar los más antiguos
                for (let i = 3; i < backupsOrdenados.length; i++) {
                    localStorage.removeItem(backupsOrdenados[i].key);
                }
                
                console.log(`🧹 Limpiados ${backupsOrdenados.length - 3} backups antiguos de localStorage`);
            }
        } catch (error) {
            console.warn('⚠️ Error limpiando backups de localStorage:', error.message);
        }
    }
    
    // Método para crear backup manual
    async crearBackupManual(motivo = 'Backup manual') {
        return await this.crearBackupCompleto(motivo);
    }
    
    // Método para obtener estadísticas de backups
    obtenerEstadisticasBackup() {
        return {
            ultimo_backup: this.ultimoBackup,
            proximo_backup: this.timerBackup ? new Date(Date.now() + this.intervaloBackup).toISOString() : null,
            intervalo_horas: this.intervaloBackup / (1000 * 60 * 60),
            max_backups_guardados: this.maxBackupsGuardados,
            ruta_backups: this.rutaBackups
        };
    }
}

// Instancia global del sistema de backup
let sistemaBackup = null;

async function cargarEstadisticasGlobalesDB() {
    try {
        // Buscar función expuesta desde Node.js en el contexto global
        if (typeof cargarEstadisticasGlobales !== 'undefined') {
            console.log('🔄 Cargando estadísticas desde base de datos...');
            const datos = await cargarEstadisticasGlobales();
            console.log('✅ Estadísticas cargadas desde base de datos:', datos ? Object.keys(datos.jugadores || {}).length + ' jugadores' : 'null');
            return datos;
        } else if (typeof window !== 'undefined' && typeof window.cargarEstadisticasGlobales !== 'undefined') {
            console.log('🔄 Cargando estadísticas desde window.cargarEstadisticasGlobales...');
            const datos = await window.cargarEstadisticasGlobales();
            return datos;
        } else if (typeof global !== 'undefined' && typeof global.cargarEstadisticasGlobales !== 'undefined') {
            console.log('🔄 Cargando estadísticas desde global.cargarEstadisticasGlobales...');
            const datos = await global.cargarEstadisticasGlobales();
            return datos;
        } else {
            console.warn('⚠️ Sistema de base de datos no disponible');
            return null;
        }
    } catch (error) {
        console.error("❌ Error al cargar datos:", error);
        return null;
    }
}

function guardarEstadisticasGlobalesDB(datos) {
    try {
        // Buscar función expuesta desde Node.js en el contexto global
        if (typeof guardarEstadisticasGlobales !== 'undefined') {
            return guardarEstadisticasGlobales(datos);
        } else if (typeof window !== 'undefined' && typeof window.guardarEstadisticasGlobales !== 'undefined') {
            return window.guardarEstadisticasGlobales(datos);
        } else if (typeof global !== 'undefined' && typeof global.guardarEstadisticasGlobales !== 'undefined') {
            return global.guardarEstadisticasGlobales(datos);
        } else {
            console.warn('⚠️ Sistema de base de datos no disponible');
            return false;
        }
    } catch (error) {
        console.error("❌ Error al guardar datos:", error);
        return false;
    }
}

function inicializarBaseDatos() {
    // La inicialización se maneja desde Node.js con SQLite
    // Esta función mantiene compatibilidad con el código existente
    return {
        jugadores: {},
        records: {
            mayorGoles: {jugador: "", cantidad: 0, fecha: ""},
            mayorAsistencias: {jugador: "", cantidad: 0, fecha: ""},
            partidoMasLargo: {duracion: 0, fecha: "", equipos: ""},
            goleadaMasGrande: {diferencia: 0, resultado: "", fecha: ""},
            hatTricks: [],
            vallasInvictas: []
        },
        totalPartidos: 0,
        fechaCreacion: new Date().toISOString(),
        contadorJugadores: 0
    };
}

async function obtenerEstadisticasJugador(nombre) {
    try {
        if (typeof nodeObtenerJugador !== 'undefined') {
            return await nodeObtenerJugador(nombre);
        } else {
            console.warn('⚠️ Sistema de base de datos no disponible');
            return null;
        }
    } catch (error) {
        console.error("❌ Error al obtener estadísticas del jugador:", error);
        return null;
    }
}

async function registrarJugador(nombre) {
    try {
        const jugadorExistente = await obtenerEstadisticasJugador(nombre);
        
        if (!jugadorExistente && typeof nodeGuardarJugador !== 'undefined') {
            const nuevoJugador = {
                nombre: nombre,
                partidos: 0,
                victorias: 0,
                derrotas: 0,
                goles: 0,
                asistencias: 0,
                autogoles: 0,
                mejorRachaGoles: 0,
                mejorRachaAsistencias: 0,
                hatTricks: 0,
                vallasInvictas: 0,
                tiempoJugado: 0,
                promedioGoles: 0.0,
                promedioAsistencias: 0.0,
                fechaPrimerPartido: new Date().toISOString(),
                fechaUltimoPartido: new Date().toISOString(),
                xp: 40,
                nivel: 1
            };
            
            await nodeGuardarJugador(nombre, nuevoJugador);
            console.log(`✅ Nuevo jugador registrado: ${nombre}`);
        }
    } catch (error) {
        console.error("❌ Error al registrar jugador:", error);
    }
}

// HBInit y fetch están disponibles globalmente en el navegador

// ==================== CONFIGURACIÓN DE LA SALA ====================
// Variables de configuración (estas deben coincidir con bot.js)
const roomName = "⚡🔵 LNB JUEGAN TODOS BIGGER X7 🔵⚡";
const maxPlayers = 23;
const roomPublic = false;
const roomPassword = null;
const token = "thr1.AAAAAGiShuTYaMh7_El59A.7D6ARjIknzE";
const geo = { code: 'AR', lat: -34.6118, lon: -58.3960 };

// Variable para almacenar el objeto room
let room = null;

// Variables para sistema AFK
let advertenciasAFK = new Map();
let comandoCooldown = new Map();

// SISTEMA DE OPTIMIZACIÓN DE RENDIMIENTO
// Función debounce para optimizar funciones que se ejecutan frecuentemente
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Variables para cambio de camisetas (separado por equipos)
let cambiosCamisetaRed = 0;
let cambiosCamisetaBlue = 0;
let maxCambiosCamiseta = 4;

// Variables para rastrear camisetas actuales de cada equipo
let camisetaActualRed = null;
let camisetaActualBlue = null;

// Variables para contraseñas automáticas
let contraseñaActual = null;
let ultimoCambioContraseña = null;

// Variable para almacenar el enlace real de la sala
let enlaceRealSala = "https://www.haxball.com/play?c=abcd1234"; // Valor por defecto
let enlaceRealConfirmado = false; // Flag para indicar que el enlace real ya fue enviado exitosamente

// Variable para almacenar el ID del último mensaje enviado a Discord
let ultimoMensajeDiscordId = null;
// Objeto para almacenar IDs de diferentes tipos de mensajes de Discord
const MENSAJE_IDS_DISCORD = {
    reportesSala: null,    // ID del último mensaje de reportes de sala
    estadoSala: null,      // ID del último mensaje de estado de sala
    partidoReporte: null   // ID del último mensaje de reporte de partido
};

// Variable para controlar el throttling de reportes de sala
let ultimoReporteSala = 0;
const INTERVALO_MINIMO_REPORTE = 5000; // 5 segundos mínimo entre reportes
// Flag para controlar si el mapa inicial ya fue aplicado
let mapaInicialAplicado = false;
// WEBHOOK PARA INFORMES DE SALA (diferente al de reportes de partidos)
const discordWebhookUrl = "https://discord.com/api/webhooks/1389450191396143265/JxHRCmfNCFooAr3YjynXPmihlVSjnGw-FLql4VUHNUx15Yl8d8BipjaRd51uXpcXfiXv";

// WEBHOOK PARA NOTIFICACIONES DE BAN/KICK
const webhookBanKick = "https://discord.com/api/webhooks/1392211274888122529/c8c1N6c4pWCIL9WyO3GLOPafo_lcbl3ae1E6CoZc-hzVc54_za4yqdNg3wRLGFuTyDPm";

// Función throttle para limitar la frecuencia de ejecución
function throttle(func, delay) {
    let lastExecution = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastExecution >= delay) {
            lastExecution = now;
            func.apply(this, args);
        }
    };
}

// Cache para resultados de funciones costosas
const funcionesCache = new Map();

// Función para limpiar cache expirado
function limpiarCacheExpirado() {
    const ahora = Date.now();
    for (const [key, value] of funcionesCache.entries()) {
        if (ahora - value.timestamp > 30000) { // TTL de 30 segundos
            funcionesCache.delete(key);
        }
    }
}

// Función para cachear resultados con limpieza automática
function cache(func, cacheKey, ttl = 30000) {
    limpiarCacheExpirado(); // Limpiar antes de cachear
    const cached = funcionesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.result;
    }
    
    const result = func();
    funcionesCache.set(cacheKey, {
        result: result,
        timestamp: Date.now()
    });
    
    return result;
}

// SISTEMA DE GESTIÓN DE MEMORIA
function limpiarDatosExpirados() {
    const ahora = Date.now();
    
    // Limpiar cache de funciones expirado
    for (const [key, value] of funcionesCache.entries()) {
        if (ahora - value.timestamp > 300000) { // 5 minutos
            funcionesCache.delete(key);
        }
    }
    
    // Limpiar desafíos PPT expirados
    for (const [key, desafio] of desafiosPPT.entries()) {
        if (ahora - desafio.tiempoInicio > 60000) { // 1 minuto
            if (desafio.timeout) clearTimeout(desafio.timeout);
            desafiosPPT.delete(key);
        }
    }
    
    // Limpiar datos AFK de jugadores desconectados solo si room está disponible
    if (typeof room !== 'undefined' && room && room.getPlayerList) {
        const jugadoresActuales = new Set(room.getPlayerList().map(j => j.id));
        for (const [playerId] of jugadoresAFK.entries()) {
            if (!jugadoresActuales.has(playerId)) {
                jugadoresAFK.delete(playerId);
            }
        }
        
        // Limpiar advertencias AFK de jugadores desconectados
        for (const [playerId] of advertenciasAFK.entries()) {
            if (!jugadoresActuales.has(playerId)) {
                advertenciasAFK.delete(playerId);
            }
        }
    }
    
    // Limpiar mensajes personalizados antiguos (opcional, después de 24 horas sin uso)
    if (typeof room !== 'undefined' && room && room.getPlayerList) {
        const jugadoresActuales2 = new Set(room.getPlayerList().map(j => j.id));
        for (const [playerId, messages] of mensajesPersonalizados.entries()) {
            if (!jugadoresActuales2.has(playerId) && messages.ultimoUso && 
                ahora - messages.ultimoUso > 86400000) { // 24 horas
                mensajesPersonalizados.delete(playerId);
            }
        }
    }
    
    // Limitar tamaño de records de hat-tricks (mantener solo últimos 50)
    if (estadisticasGlobales.records.hatTricks.length > 50) {
        estadisticasGlobales.records.hatTricks = estadisticasGlobales.records.hatTricks
            .slice(-50);
    }
    
    // Limitar tamaño de records de vallas invictas (mantener solo últimos 50)
    if (estadisticasGlobales.records.vallasInvictas.length > 50) {
        estadisticasGlobales.records.vallasInvictas = estadisticasGlobales.records.vallasInvictas
            .slice(-50);
    }
}

// SISTEMA ANTI-SPAM MEJORADO
let spamControl = new Map(); // {playerID: {count, lastMessage, timestamp, warnings}}
let cooldownGlobal = new Map(); // {playerID: timestamp}
let jugadoresSilenciadosPorSpam = new Map(); // {playerID: {finSilencio: timestamp, razon: string}}

function verificarSpam(jugador, mensaje) {
    // EXCEPCIÓN PARA ADMINISTRADORES - Los admins no pueden ser silenciados por spam
    if (esAdminBasico(jugador)) {
        return false; // Los administradores están exentos del sistema anti-spam
    }
    
    const ahora = Date.now();
    const control = spamControl.get(jugador.id) || {
        count: 0, 
        lastMessage: '', 
        timestamp: 0, 
        warnings: 0,
        messageHistory: []
    };
    
    // Resetear contador si ha pasado tiempo suficiente (cambiar a 3 segundos)
    if (ahora - control.timestamp > 3000) {
        control.count = 0;
        control.warnings = 0;
        control.messageHistory = [];
    }
    
    // Agregar mensaje al historial
    control.messageHistory.push({mensaje, timestamp: ahora});
    if (control.messageHistory.length > 5) {
        control.messageHistory.shift(); // Mantener solo últimos 5 mensajes
    }
    
    // Contar mensajes en los últimos 3 segundos
    const mensajesEn3Segundos = control.messageHistory.filter(m => ahora - m.timestamp <= 3000);
    
    // Si hay 5 o más mensajes en 3 segundos, aplicar silencio
    if (mensajesEn3Segundos.length >= 5) {
        aplicarSilencioPorSpam(jugador, 30000, "Spam: 5+ mensajes en 3 segundos");
        spamControl.delete(jugador.id); // Limpiar control después del silencio
        return true;
    }
    
    // Verificar mensaje repetido exacto
    if (control.lastMessage === mensaje && ahora - control.timestamp < 2000) {
        control.count += 2; // Penalizar mensajes idénticos
        control.warnings++;
        
        if (control.warnings === 1) {
            // Mensaje de advertencia removido
        } else if (control.warnings >= 2) {
            anunciarAdvertencia("🚫 Último aviso por spam. Próxima infracción = silencio", jugador);
        }
    } else {
        control.count++;
    }
    
    // Verificar patrones de spam adicionales
    const mensajesRecientes = control.messageHistory.filter(m => ahora - m.timestamp < 10000);
    const mensajesCortos = mensajesRecientes.filter(m => m.mensaje.length < 3);
    
    // Penalizar mensajes muy cortos frecuentes
    if (mensajesCortos.length >= 3) {
        control.count += 2;
    }
    
    // Verificar flood de comandos
    const comandosRecientes = mensajesRecientes.filter(m => m.mensaje.startsWith('!'));
    if (comandosRecientes.length >= 4) {
        control.count += 2;
        anunciarAdvertencia("⚠️ Evita usar muchos comandos seguidos", jugador);
    }
    
    control.lastMessage = mensaje;
    control.timestamp = ahora;
    spamControl.set(jugador.id, control);
    
    return false; // No es spam
}

// Función para aplicar silencio por spam
function aplicarSilencioPorSpam(jugador, duracion, razon) {
    const finSilencio = Date.now() + duracion;
    
    // Registrar en el mapa de silenciados por spam
    jugadoresSilenciadosPorSpam.set(jugador.id, {
        finSilencio: finSilencio,
        razon: razon
    });
    
    const segundos = Math.floor(duracion / 1000);
    anunciarAdvertencia(`🔇 ${jugador.name} ha sido silenciado por ${segundos} segundos. Razón: ${razon}`);
    
    // Programar remoción automática del silencio
    setTimeout(() => {
        if (typeof room !== 'undefined' && room && room.getPlayerList) {
            const jugadorActual = room.getPlayerList().find(j => j.id === jugador.id);
            if (jugadorActual && jugadoresSilenciadosPorSpam.has(jugador.id)) {
                jugadoresSilenciadosPorSpam.delete(jugador.id);
                // Mensaje privado al jugador que fue desmutado
                room.sendAnnouncement("ℹ️ ✅ Finalizó tu muteo", jugador.id, parseInt(CELESTE_LNB, 16), "normal", 0);
            }
        }
    }, duracion);
}

// Función para verificar si un jugador está silenciado por spam
function estaSilenciadoPorSpam(jugador) {
    const silencio = jugadoresSilenciadosPorSpam.get(jugador.id);
    if (silencio && Date.now() < silencio.finSilencio) {
        const tiempoRestante = Math.ceil((silencio.finSilencio - Date.now()) / 1000);
        anunciarAdvertencia(`🔇 Estás silenciado por ${tiempoRestante} segundos más (${silencio.razon})`, jugador);
        return true;
    } else if (silencio) {
        // El silencio ha expirado, eliminarlo
        jugadoresSilenciadosPorSpam.delete(jugador.id);
    }
    return false;
}

// Función para verificar si un jugador está muteado por admin
function estaMuteadoPorAdmin(jugador) {
    // Verificar mute permanente
    if (jugadoresMuteados.has(jugador.id)) {
        anunciarAdvertencia(`🔇 Estás silenciado permanentemente. Contacta a un admin.`, jugador);
        return true;
    }
    
    // Verificar mute temporal
    const muteTemp = jugadoresMuteadosTemporales.get(jugador.id);
    if (muteTemp && Date.now() < muteTemp.finMute) {
        const tiempoRestante = Math.ceil((muteTemp.finMute - Date.now()) / (60 * 1000));
        anunciarAdvertencia(`🔇 Estás silenciado por ${tiempoRestante} minutos más (${muteTemp.razon})`, jugador);
        return true;
    } else if (muteTemp) {
        // El mute temporal ha expirado, eliminarlo
        clearTimeout(muteTemp.timeoutId);
        jugadoresMuteadosTemporales.delete(jugador.id);
    }
    
    return false;
}

// Función para verificar si un jugador está en timeout (mantenida para compatibilidad)
function estaEnTimeout(jugador) {
    const timeout = cooldownGlobal.get(jugador.id);
    if (timeout && Date.now() < timeout) {
        const tiempoRestante = Math.ceil((timeout - Date.now()) / 1000);
        anunciarAdvertencia(`⏰ Estás en timeout por ${tiempoRestante} segundos más`, jugador);
        return true;
    }
    return false;
}

// Función para limpiar datos de spam de jugadores desconectados
function limpiarDatosSpam() {
    if (typeof room === 'undefined' || !room || !room.getPlayerList) return;
    
    const jugadoresActuales = new Set(room.getPlayerList().map(j => j.id));
    
    for (const [playerId] of spamControl.entries()) {
        if (!jugadoresActuales.has(playerId)) {
            spamControl.delete(playerId);
        }
    }
    
    for (const [playerId] of cooldownGlobal.entries()) {
        if (!jugadoresActuales.has(playerId)) {
            cooldownGlobal.delete(playerId);
        }
    }
    
    for (const [playerId] of jugadoresSilenciadosPorSpam.entries()) {
        if (!jugadoresActuales.has(playerId)) {
            jugadoresSilenciadosPorSpam.delete(playerId);
        }
    }
    
    // Limpiar mutes temporales de jugadores desconectados
    for (const [playerId, muteData] of jugadoresMuteadosTemporales.entries()) {
        if (!jugadoresActuales.has(playerId)) {
            clearTimeout(muteData.timeoutId);
            jugadoresMuteadosTemporales.delete(playerId);
        }
    }
}

// POSICIONES AFK Y ESPERA
const posicionEsperando = {x: 0, y: 0};
const posicionAFK = {x: 200, y: 0};

// CONFIGURACIÓN DEL BOT
const adminPassword = "lnbnotgenio";
const duracionPartido = 3; // 3 minutos
const scoreLimitPartido = 3; // 3 goles
const guardarReplaysEnPC = false; // ❌ DESACTIVADO - No descargar replays automáticamente en PC
const guardarAmistosos = true;
const segundosMinimoPartido = 178; // 2 minutos 58 segundos para considerar válido
const enviarReplaysDiscord = true; // Enviar replays automáticamente a Discord
const guardarReplaysOficiales = true; // Guardar replays de partidos oficiales
const guardarReplaysAmistosos = true; // Guardar replays de partidos amistosos

// SISTEMA DE ROLES Y PERMISOS
const ROLES = {
    SUPER_ADMIN: {
        level: 4,
        nombre: "Super Administrador",
        color: "FF0000",
        permisos: ["*"], // Todos los permisos
        prefix: "👑"
    },
    ADMIN_FULL: {
        level: 3,
        nombre: "Admin Full",
        color: "FF6B6B",
        permisos: [
            "admin.claim", "admin.password", "admin.bans", 
            "admin.swap", "admin.pause", "admin.stop", "admin.autostart", 
            "admin.autostop", "admin.balance", "admin.replay_config", 
            "admin.kick", "admin.mute", "moderation.warn", "moderation.timeout"
        ],
        prefix: "🛡️"
    },
    ADMIN_BASICO: {
        level: 2,
        nombre: "Admin Básico",
        color: "FFA500",
        permisos: [
            "moderation.warn", "moderation.timeout", "moderation.mute", 
            "room.colors", "room.maps", "stats.view_all", "admin.kick"
        ],
        prefix: "⚖️"
    },
    VIP: {
        level: 1.5,
        nombre: "VIP",
        color: "FFD700",
        permisos: [
            "basic.stats", "basic.help", "basic.replay", "basic.chat", 
            "basic.team_chat", "basic.whisper", "basic.afk", "vip.commands", "vip.priority_join"
        ],
        prefix: "⭐"
    },
    PLAYER: {
        level: 1,
        nombre: "Jugador",
        color: "87CEEB",
        permisos: [
            "basic.stats", "basic.help", "basic.replay", "basic.chat", 
            "basic.team_chat", "basic.whisper", "basic.afk"
        ],
        prefix: ""
    }
};

const PERMISOS = {
    // Permisos de administración
    "admin.claim": "Reclamar administrador",
    "admin.password": "Gestionar contraseña de sala",
    "admin.bans": "Gestionar baneos",
    "admin.swap": "Intercambiar equipos",
    "admin.pause": "Pausar/reanudar partidos",
    "admin.stop": "Detener partidos",
    "admin.autostart": "Configurar auto-start",
    "admin.autostop": "Configurar auto-stop",
    "admin.balance": "Balance manual de equipos",
    "admin.replay_config": "Configurar sistema de replays",
    "admin.kick": "Expulsar jugadores",
    "admin.mute": "Silenciar jugadores",
    
    // Permisos de moderación
    "moderation.warn": "Advertir jugadores",
    "moderation.timeout": "Timeout temporal",
    "moderation.mute": "Silenciar temporalmente",
    
    // Permisos de sala
    "room.colors": "Cambiar colores de equipos",
    "room.maps": "Cambiar mapas",
    "room.priority_join": "Unirse con prioridad",
    
    // Permisos de estadísticas
    "stats.view_all": "Ver estadísticas de cualquier jugador",
    "stats.detailed": "Ver estadísticas detalladas",
    
    // Permisos de replay
    "replay.download": "Descargar replays",
    
    // Permisos de mensajes
    "messages.custom": "Mensajes personalizados",
    
    // Permisos básicos
    "basic.stats": "Ver estadísticas propias",
    "basic.help": "Ver ayuda",
    "basic.replay": "Ver enlace de replay",
    "basic.chat": "Chat público",
    "basic.team_chat": "Chat de equipo",
    "basic.whisper": "Mensajes privados",
    "basic.afk": "Comando AFK"
};

// Contraseñas para roles especiales
const ROLE_PASSWORDS = {
    SUPER_ADMIN: "lnbsuperadmin2025",
    ADMIN_FULL: "lnbnotgenio", 
    ADMIN_BASICO: "lnbmod2025"
};

// SISTEMA DE XP (EXPERIENCIA)
const XP_POR_ACCION = {
    gol: 10,
    asistencia: 5,
    victoria: 20,
    partido_completo: 5,
    hat_trick: 25,
    valla_invicta: 15
};

// Función para calcular y otorgar XP
function otorgarXP(nombreJugador, accion, cantidad = null) {
    // Verificar que estadisticasGlobales y jugadores existan
    if (!estadisticasGlobales || !estadisticasGlobales.jugadores) {
        console.error('❌ Error: estadisticasGlobales no inicializado en otorgarXP');
        return;
    }
    
    if (!estadisticasGlobales.jugadores[nombreJugador]) {
        registrarJugadorGlobal(nombreJugador);
    }
    
    const stats = estadisticasGlobales.jugadores[nombreJugador];
    if (!stats) {
        console.error(`❌ Error: No se pudo crear/obtener estadísticas para ${nombreJugador}`);
        return;
    }
    
    if (!stats.xp) stats.xp = 0;
    if (!stats.nivel) stats.nivel = 1;
    
    const xpGanada = cantidad || XP_POR_ACCION[accion] || 0;
    const xpAnterior = stats.xp;
    const nivelAnterior = stats.nivel;
    
    stats.xp += xpGanada;
    
    // Calcular nuevo nivel (cada 100 XP = 1 nivel)
    const nuevoNivel = Math.floor(stats.xp / 100) + 1;
    
    if (nuevoNivel > nivelAnterior) {
        stats.nivel = nuevoNivel;
        anunciarGeneral(`🎉 ¡${nombreJugador} subió a NIVEL ${nuevoNivel}!`, "FFD700", "bold");
        
        // Recompensas por subir de nivel
        if (nuevoNivel % 5 === 0) {
            anunciarGeneral(`👑 ¡${nombreJugador} alcanzó el NIVEL ${nuevoNivel}! ¡Felicitaciones!`, "FF6B6B", "bold");
        }
        
        // Actualizar nombre con nuevo nivel
        setTimeout(() => {
            actualizarTodosLosNombres();
        }, 1000);
    }
    
    // XP se actualiza silenciosamente - solo se notifica cuando sube de nivel
    
    guardarEstadisticasGlobalesCompletas();
}

// Función para calcular rango basado en XP
function calcularRango(xp) {
    if (xp >= 5000) return '🏆 Leyenda';
    if (xp >= 3000) return '💎 Diamante';
    if (xp >= 2000) return '🥇 Oro';
    if (xp >= 1000) return '🥈 Plata';
    if (xp >= 500) return '🥉 Bronce';
    if (xp >= 100) return '⚡ Hierro';
    return '🔰 Novato';
}

// Función para obtener emoji según el nivel
function obtenerEmojiNivel(nivel) {
    if (nivel >= 100) return '👑'; // Rey (nivel 100+)
    if (nivel >= 90) return '💫'; // Estrella fugaz (nivel 90-99)
    if (nivel >= 80) return '🌟'; // Estrella brillante (nivel 80-89)
    if (nivel >= 70) return '⭐'; // Estrella (nivel 70-79)
    if (nivel >= 60) return '🔥'; // Fuego (nivel 60-69)
    if (nivel >= 50) return '💎'; // Diamante (nivel 50-59)
    if (nivel >= 40) return '🏆'; // Trofeo (nivel 40-49)
    if (nivel >= 30) return '⚡'; // Rayo (nivel 30-39)
    if (nivel >= 20) return '🚀'; // Cohete (nivel 20-29)
    if (nivel >= 10) return '🌙'; // Luna (nivel 10-19)
    return '🌟'; // Estrella básica (nivel 1-9)
}

// Sistema para actualizar nombres con niveles
let nombresOriginales = new Map(); // {playerID: nombreOriginal}
let ultimaActualizacionNombres = 0;

// Función para obtener el nivel de un jugador
function obtenerNivelJugador(nombreJugador) {
    const stats = estadisticasGlobales.jugadores[nombreJugador];
    if (!stats || !stats.xp) return 1;
    return stats.nivel || Math.floor(stats.xp / 100) + 1;
}

// Función para actualizar el nombre de un jugador con su nivel
function actualizarNombreConNivel(jugador) {
    // Guardar nombre original si no existe
    if (!nombresOriginales.has(jugador.id)) {
        nombresOriginales.set(jugador.id, jugador.name);
    }
    
    const nombreOriginal = nombresOriginales.get(jugador.id);
    
    // Solo actualizar si el nombre ha cambiado (mantener nombre original sin nivel)
    if (jugador.name !== nombreOriginal) {
        try {
            room.setPlayerAvatar(jugador.id, nombreOriginal);
        } catch (error) {
            // No se pudo actualizar el nombre
        }
    }
}

// Función para actualizar todos los nombres con niveles
function actualizarTodosLosNombres() {
    const ahora = Date.now();
    // Evitar actualizaciones muy frecuentes
    if (ahora - ultimaActualizacionNombres < 2000) return;
    
    ultimaActualizacionNombres = ahora;
    
    const jugadores = room.getPlayerList();
    jugadores.forEach(jugador => {
        actualizarNombreConNivel(jugador);
    });
}

// Función para obtener el nombre original de un jugador
function obtenerNombreOriginal(jugador) {
    return nombresOriginales.get(jugador.id) || jugador.name.replace(/^\[\d+\]\s/, '');
}

// Función para actualizar el nombre de un jugador con su rol
function actualizarNombreConRol(jugador) {
    try {
        const rolInfo = jugadoresConRoles.get(jugador.id);
        if (rolInfo && ROLES[rolInfo.role]) {
            const rol = ROLES[rolInfo.role];
            const nombreOriginal = obtenerNombreOriginal(jugador);
            const nuevoNombre = `${rol.prefix} ${nombreOriginal}`;
            
            // Solo actualizar si el nombre ha cambiado
            if (jugador.name !== nuevoNombre) {
                room.setPlayerAvatar(jugador.id, nuevoNombre);
            }
        }
    } catch (error) {
        // Error al actualizar nombre con rol
    }
}

// Sistema de jugadores con roles
let jugadoresConRoles = new Map(); // {playerID: {role: "ADMIN", assignedBy: "SuperAdmin", timestamp: Date}}

// DISCORD WEBHOOK PARA REPORTES DE PARTIDOS Y REPLAYS
const discordWebhook = "https://discord.com/api/webhooks/1389450191396143265/JxHRCmfNCFooAr3YjynXPmihlVSjnGw-FLql4VUHNUx15Yl8d8BipjaRd51uXpcXfiXv";

// WEBHOOK PARA LLAMAR ADMIN
const webhookLlamarAdmin = "https://discord.com/api/webhooks/1389648292987666662/0fn4qY2ITwfTzKvPt19fC3MPUjXuxGZvJUZHLSVZ9l3lFQe2s2vt-crhx7DOT6ogx8aF";

// WEBHOOK PARA REPORTES DE SALA (ESTADO ACTUAL)
const webhookReportesSala = "https://discord.com/api/webhooks/1390368471577133187/-QKunqo71mOgK_op4dZxP4lK3HVA7Utqs9bFP5dRyyexKUdOUCSV573sz1eZvirS8JUA";
const webhookModeracion = "https://discord.com/api/webhooks/1392211274888122529/c8c1N6c4pWCIL9WyO3GLOPafo_lcbl3ae1E6CoZc-hzVc54_za4yqdNg3wRLGFuTyDPm";

// WEBHOOK PARA REPORTES DE PARTIDO OFICIAL

// SISTEMA DE COLORES CONSISTENTE LNB
const COLORES = {
    // Colores principales LNB
    PRIMARIO: "87CEEB",      // Celeste LNB principal
    SECUNDARIO: "87CEEB",    // Celeste LNB secundario
    
    // Colores de estado
    EXITO: "00FF00",         // Verde para éxitos
    ERROR: "FF0000",         // Rojo para errores
    ADVERTENCIA: "FFA500",   // Naranja para advertencias
    INFO: "87CEEB",          // Celeste para información
    
    // Colores especiales
    DORADO: "FFD700",        // Oro para destacados/premios
    PLATINO: "E5E4E2",       // Platino para elementos premium
    GRIS: "888888",          // Gris para mensajes secundarios
    ROSA: "FF69B4",          // Rosa para ship/diversión
    
    // Colores de equipos
    ROJO: "FF0000",          // Equipo rojo
    AZUL: "87CEEB",          // Equipo azul
    
    // Colores de chat
    CHAT_TEAM_ROJO: "FF6B6B", // Chat de equipo rojo (mismo color que el archivo de referencia)
    CHAT_TEAM_AZUL: "87CEEB", // Chat de equipo azul
    CHAT_PRIVADO: "FFD700",   // Mensajes privados
    CHAT_NIVEL: "FFFFFF",     // Color base para niveles
    
    // Colores de moderación
    TIMEOUT: "FF8C00",       // Color para timeouts
    MUTE: "696969",          // Color para silenciados
    BAN: "8B0000",           // Color para baneos
    
    // Colores de estadísticas
    STATS_HEADER: "87CEEB",  // Encabezados de stats
    STATS_VALOR: "87CEEB",   // Valores de stats
    RECORD: "FFD700",        // Récords
    
    // Transparente para casos especiales
    TRANSPARENTE: null
};

// Mantener compatibilidad con código existente
const AZUL_LNB = COLORES.PRIMARIO;
const CELESTE_LNB = COLORES.SECUNDARIO;

// MAPAS DE LNB
const mapas = {
    biggerx7: {
        nombre: "Bigger x7 LNB",
        minJugadores: 10,
        maxJugadores: 14,
        hbs: `{"name":"Bigger x7","width":1300,"height":670,"bg":{"width":1150,"height":600,"kickOffRadius":180,"color":"444444"},"vertexes":[{"x":0,"y":600,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-600,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":1150,"y":320,"cMask":[]},{"x":840,"y":320,"cMask":[]},{"x":1150,"y":-320,"cMask":[]},{"x":840,"y":-320,"cMask":[]},{"x":1150,"y":180,"cMask":[]},{"x":1030,"y":180,"cMask":[]},{"x":1150,"y":-180,"cMask":[]},{"x":1030,"y":-180,"cMask":[]},{"x":840,"y":-130,"cMask":[]},{"x":840,"y":130,"cMask":[]},{"x":-1150,"y":-320,"cMask":[]},{"x":-840,"y":-320,"cMask":[]},{"x":-1150,"y":320,"cMask":[]},{"x":-840,"y":320,"cMask":[]},{"x":-1150,"y":-180,"cMask":[]},{"x":-1030,"y":-180,"cMask":[]},{"x":-1150,"y":180,"cMask":[]},{"x":-1030,"y":180,"cMask":[]},{"x":-840,"y":130,"cMask":[]},{"x":-840,"y":-130,"cMask":[]},{"x":935,"y":3,"cMask":[]},{"x":935,"y":-3,"cMask":[]},{"x":-935,"y":3,"cMask":[]},{"x":-935,"y":-3,"cMask":[]},{"x":0,"y":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":-180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":-1150,"y":-130,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-1215,"y":-80,"bCoef":0,"cMask":["ball"]},{"x":-1150,"y":130,"bCoef":0,"cMask":["red","blue","ball"]},{"x":-1215,"y":80,"bCoef":0,"cMask":["ball"]},{"x":1150,"y":130,"bCoef":0,"cMask":["red","blue","ball"]},{"x":1215,"y":80,"bCoef":0,"cMask":["ball"]},{"x":1150,"y":-130,"bCoef":0,"cMask":["red","blue","ball"]},{"x":1215,"y":-80,"bCoef":0,"cMask":["ball"]},{"x":-1150,"y":600,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":1150,"y":600,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-1150,"y":130,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-1150,"y":-600,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":1150,"y":-600,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":1150,"y":-130,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":1150,"y":130,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":1160,"y":130,"cMask":["ball"],"cGroup":["ball"]},{"x":-1160,"y":130,"cMask":["ball"],"cGroup":["ball"]},{"x":-1160,"y":-130,"cMask":["ball"],"cGroup":["ball"]},{"x":1160,"y":-130,"cMask":["ball"],"cGroup":["ball"]},{"x":-1215,"y":-3,"bCoef":0,"cMask":["ball"]},{"x":-1215,"y":10,"bCoef":0,"cMask":["ball"]},{"x":1215,"y":10,"bCoef":0,"cMask":["ball"]},{"x":1215,"y":-10,"bCoef":0,"cMask":["ball"]},{"x":-1150,"y":-130,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":1150,"y":130},{"x":1150,"y":-130},{"x":1150,"y":130,"cMask":[]},{"x":1150,"y":-130,"cMask":[]},{"x":0,"y":180,"cMask":[]},{"x":0,"y":-180,"cMask":[]},{"x":0,"y":-670,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":670,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]}],"segments":[{"v0":0,"v1":1,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":2,"v1":3,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":4,"v1":5,"cMask":[]},{"v0":5,"v1":7,"cMask":[]},{"v0":6,"v1":7,"cMask":[]},{"v0":8,"v1":9,"cMask":[]},{"v0":9,"v1":11,"cMask":[]},{"v0":10,"v1":11,"cMask":[]},{"v0":13,"v1":12,"curve":130,"cMask":[],"curveF":0.4663076581549986},{"v0":14,"v1":15,"cMask":[]},{"v0":15,"v1":17,"cMask":[]},{"v0":16,"v1":17,"cMask":[]},{"v0":18,"v1":19,"cMask":[]},{"v0":19,"v1":21,"cMask":[]},{"v0":20,"v1":21,"cMask":[]},{"v0":23,"v1":22,"curve":130,"cMask":[],"curveF":0.4663076581549986},{"v0":25,"v1":24,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":27,"v1":26,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":24,"v1":25,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":26,"v1":27,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":24,"v1":25,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":26,"v1":27,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":25,"v1":24,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":27,"v1":26,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":24,"v1":25,"color":"C7E6BD","cMask":[]},{"v0":26,"v1":27,"color":"C7E6BD","cMask":[]},{"v0":28,"v1":29,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"],"curveF":6.123233995736766e-17},{"v0":29,"v1":30,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO"],"curveF":6.123233995736766e-17},{"v0":32,"v1":31,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":33,"v1":34,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":34,"v1":32,"color":"000000","bCoef":0,"cMask":["red","blue","ball"]},{"v0":36,"v1":35,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":37,"v1":38,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":36,"v1":38,"color":"000000","bCoef":0,"cMask":["red","blue","ball"]},{"v0":39,"v1":40,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":60},{"v0":39,"v1":41,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-65},{"v0":31,"v1":42,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-65},{"v0":42,"v1":43,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-60},{"v0":43,"v1":44,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-65},{"v0":40,"v1":45,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":65},{"v0":50,"v1":51,"color":"000000","bCoef":0,"cMask":["ball"]},{"v0":52,"v1":53,"color":"000000","bCoef":0,"cMask":["ball"]},{"v0":41,"v1":54,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"v0":57,"v1":58,"cMask":[]},{"v0":3,"v1":61,"vis":false,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":0,"v1":62,"vis":false,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]}],"planes":[{"normal":[0,1],"dist":-670,"bCoef":0},{"normal":[1,0],"dist":-1300,"bCoef":0},{"normal":[-1,0],"dist":-1300,"bCoef":0}],"goals":[{"p0":[-1161.3,130],"p1":[-1161.3,-130],"team":"red"},{"p0":[1161.3,130],"p1":[1161.3,-130],"team":"blue"}],"discs":[{"radius":8.75,"invMass":1.11,"pos":[0,0],"color":"FFFFFF","cGroup":["ball","kick","score"],"damping":0.991},{"radius":0,"invMass":0,"pos":[-1311,-19],"color":"transparent","bCoef":0,"cMask":["red"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-1310,29],"color":"transparent","bCoef":0,"cMask":["blue"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-1308,62],"color":"transparent","bCoef":0,"cMask":["red","blue"],"cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[-1150,130],"color":"e56e56","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[1150,-130],"color":"5689e5","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[1150,130],"color":"5689e5","cGroup":["ball"]},{"radius":0,"pos":[-1149,-485],"cMask":[]},{"radius":0,"pos":[-1149,-485],"cMask":[]},{"radius":0,"pos":[1150,-130],"cMask":[]},{"radius":0,"pos":[-1149,485],"cMask":[]},{"radius":0,"pos":[1149,485],"cMask":[]},{"radius":0,"pos":[-1149,485],"cMask":[]},{"radius":0,"pos":[1149,485],"cMask":[]},{"radius":8,"invMass":0,"pos":[-1150,-130],"color":"e56e56","cGroup":["ball"]},{"radius":2.003390790792821,"pos":[-0.3579305730959277,599.1800461283714],"color":"5689e5","cMask":[]}],"playerPhysics":{"bCoef":0.4,"damping":0.9605,"acceleration":0.12,"kickStrength":5.75,"cGroup":["red","blue"]},"ballPhysics":"disc0","spawnDistance":300,"canBeStored":false}`
    },
    biggerx5: {
        nombre: "Bigger x5 LNB",
        minJugadores: 5,
        maxJugadores: 10,
        hbs: `{"name":"Bigger x5","width":870,"height":445,"bg":{"width":750,"height":400,"kickOffRadius":180,"color":"444444"},"vertexes":[{"x":0,"y":400,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-400,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":750,"y":215,"cMask":[]},{"x":560,"y":215,"cMask":[]},{"x":750,"y":-215,"cMask":[]},{"x":560,"y":-215,"cMask":[]},{"x":750,"y":140,"cMask":[]},{"x":665,"y":140,"cMask":[]},{"x":750,"y":-140,"cMask":[]},{"x":665,"y":-140,"cMask":[]},{"x":560,"y":-130,"cMask":[]},{"x":560,"y":130,"cMask":[]},{"x":-750,"y":-215,"cMask":[]},{"x":-560,"y":-215,"cMask":[]},{"x":-750,"y":215,"cMask":[]},{"x":-560,"y":215,"cMask":[]},{"x":-750,"y":-140,"cMask":[]},{"x":-665,"y":-140,"cMask":[]},{"x":-750,"y":140,"cMask":[]},{"x":-665,"y":140,"cMask":[]},{"x":-560,"y":130,"cMask":[]},{"x":-560,"y":-130,"cMask":[]},{"x":615,"y":3,"cMask":[]},{"x":615,"y":-3,"cMask":[]},{"x":-615,"y":3,"cMask":[]},{"x":-615,"y":-3,"cMask":[]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":-120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":-750,"y":-100,"cMask":["ball"],"cGroup":["red","blue","wall"],"color":"000000"},{"x":-805,"y":-70,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-750,"y":100,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":-805,"y":70,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":750,"y":100,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":805,"y":70,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":750,"y":-100,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":805,"y":-70,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-750,"y":400,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":750,"y":400,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-750,"y":100,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-750,"y":-400,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":750,"y":-400,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":750,"y":-100,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":750,"y":100,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-805,"y":-10,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-805,"y":10,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":805,"y":10,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":805,"y":-10,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-750,"y":-100,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":750,"y":100,"cMask":[]},{"x":750,"y":-100,"cMask":[]},{"x":0,"y":120,"cMask":[]},{"x":0,"y":-120,"cMask":[]},{"x":0,"y":-445,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":445,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]}],"segments":[{"v0":0,"v1":1,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":2,"v1":3,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":4,"v1":5,"cMask":[]},{"v0":5,"v1":7,"cMask":[]},{"v0":6,"v1":7,"cMask":[]},{"v0":8,"v1":9,"cMask":[]},{"v0":9,"v1":11,"cMask":[]},{"v0":10,"v1":11,"cMask":[]},{"v0":13,"v1":12,"curve":130,"cMask":[],"curveF":0.4663076581549986},{"v0":14,"v1":15,"cMask":[]},{"v0":15,"v1":17,"cMask":[]},{"v0":16,"v1":17,"cMask":[]},{"v0":18,"v1":19,"cMask":[]},{"v0":19,"v1":21,"cMask":[]},{"v0":20,"v1":21,"cMask":[]},{"v0":23,"v1":22,"curve":130,"cMask":[],"curveF":0.4663076581549986},{"v0":25,"v1":24,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":27,"v1":26,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":24,"v1":25,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":26,"v1":27,"curve":180,"color":"C7E6BD","cMask":[],"curveF":6.123233995736766e-17},{"v0":24,"v1":25,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":26,"v1":27,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":25,"v1":24,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":27,"v1":26,"curve":89.99999999999999,"color":"C7E6BD","cMask":[],"curveF":1.0000000000000002},{"v0":24,"v1":25,"color":"C7E6BD","cMask":[]},{"v0":26,"v1":27,"color":"C7E6BD","cMask":[]},{"v0":28,"v1":29,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"],"curveF":6.123233995736766e-17},{"v0":29,"v1":30,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO"],"curveF":6.123233995736766e-17},{"v0":32,"v1":31,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":33,"v1":34,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":34,"v1":32,"color":"000000","bCoef":0,"cMask":["red","blue","ball"]},{"v0":36,"v1":35,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":37,"v1":38,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":36,"v1":38,"color":"000000","bCoef":0,"cMask":["red","blue","ball"]},{"v0":39,"v1":40,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50},{"v0":39,"v1":41,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-60},{"v0":31,"v1":42,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-60},{"v0":42,"v1":43,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-50},{"v0":43,"v1":44,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-60},{"v0":40,"v1":45,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":60},{"v0":46,"v1":47,"color":"000000","bCoef":0,"cMask":["ball"]},{"v0":48,"v1":49,"color":"000000","bCoef":0,"cMask":["ball"]},{"v0":41,"v1":50,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"v0":51,"v1":52,"cMask":[]},{"v0":3,"v1":55,"vis":false,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":0,"v1":56,"vis":false,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]}],"planes":[{"normal":[0,1],"dist":-445,"bCoef":0},{"normal":[0,-1],"dist":-445,"bCoef":0},{"normal":[1,0],"dist":-870,"bCoef":0},{"normal":[-1,0],"dist":-870,"bCoef":0}],"goals":[{"p0":[-761.3,100],"p1":[-761.3,-100],"team":"red"},{"p0":[761.3,100],"p1":[761.3,-100],"team":"blue"}],"discs":[{"radius":8.75,"invMass":1.11,"pos":[0,0],"color":"FFFFFF","cGroup":["ball","kick","score"],"damping":0.991},{"radius":0,"invMass":0,"pos":[-1311,-19],"color":"transparent","bCoef":0,"cMask":["red"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-1310,29],"color":"transparent","bCoef":0,"cMask":["blue"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-1308,62],"color":"transparent","bCoef":0,"cMask":["red","blue"],"cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[-750,100],"color":"e56e56","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[750,-100],"color":"5689e5","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[750,100],"color":"5689e5","cGroup":["ball"]},{"radius":0,"pos":[-1149,-485],"cMask":[]},{"radius":0,"pos":[-1149,-485],"cMask":[]},{"radius":0,"pos":[1155.671526641948,-102.2725364171434],"cMask":[]},{"radius":0,"pos":[-1149,485],"cMask":[]},{"radius":0,"pos":[1149,485],"cMask":[]},{"radius":0,"pos":[-1149,485],"cMask":[]},{"radius":0,"pos":[1149,485],"cMask":[]},{"radius":8,"invMass":0,"pos":[-750,-100],"color":"e56e56","cGroup":["ball"]}],"playerPhysics":{"bCoef":0.4,"damping":0.9605,"acceleration":0.12,"kickStrength":5.75,"cGroup":["red","blue"]},"ballPhysics":"disc0","spawnDistance":400,"canBeStored":false}`
    },
    biggerx3: {
        nombre: "Bigger x3 LNB",
        minJugadores: 2,
        maxJugadores: 6,
        hbs: `{"name":"Bigger x3 LNB","width":600,"height":270,"bg":{"width":550,"height":240,"kickOffRadius":180,"color":"444444"},"vertexes":[{"x":0,"y":240,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-240,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":750,"y":215,"cMask":[]},{"x":750,"y":140,"cMask":[]},{"x":750,"y":-140,"cMask":[]},{"x":-750,"y":215,"cMask":[]},{"x":-750,"y":140,"cMask":[]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":-120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":-556.8105676799998,"y":-108.16293376,"cMask":["ball"],"cGroup":["red","blue","wall"],"color":"000000","curve":89.99999999999999},{"x":-550,"y":90,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":550,"y":90,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":605,"y":65,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":550,"y":-90,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":605,"y":-60,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-550,"y":240,"cMask":["ball"],"cGroup":["red","blue","wall"],"curve":0},{"x":550,"y":240,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-550,"y":90,"cMask":["ball"],"cGroup":["red","blue","wall"],"curve":0},{"x":-550,"y":-240,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":550,"y":-240,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":550,"y":-90,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":550,"y":90,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":605,"y":10,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":605,"y":-10,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-550,"y":-100,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":550,"y":90,"cMask":[]},{"x":550,"y":-90,"cMask":[]},{"x":0,"y":120,"cMask":[]},{"x":0,"y":-120,"cMask":[]},{"x":0,"y":-445,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":445,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":120,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":-550,"y":-240,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":550,"y":-240,"cMask":["ball"],"cGroup":["ball"],"color":"000000","bias":-60},{"x":550,"y":-90,"cMask":["ball"],"cGroup":["ball"],"color":"000000","bias":-60},{"x":550,"y":90,"cMask":[],"curve":0},{"x":550,"y":-90,"cMask":[],"curve":0},{"x":-550,"y":-90,"curve":-89.99999999,"color":"000000"},{"x":-550,"y":90,"curve":0,"color":"000000"},{"x":-605,"y":-65,"bCoef":0,"curve":0},{"x":-605,"y":65,"bCoef":0,"curve":-89.99999999},{"x":-550,"y":90,"curve":-89.99999999},{"x":-550,"y":90,"cMask":[],"curve":0},{"x":-550,"y":-90,"cMask":[],"curve":0},{"x":-550,"y":-240,"cMask":["ball"],"cGroup":["red","blue","wall"],"curve":0},{"x":-550,"y":-90,"cMask":["ball"],"cGroup":["red","blue","wall"],"color":"000000","curve":0},{"x":-550,"y":-240,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50},{"x":-550,"y":-90,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50}],"segments":[{"v0":0,"v1":1,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":2,"v1":3,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":9,"v1":10,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"],"curveF":6.123233995736766e-17},{"v0":10,"v1":11,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO"],"curveF":6.123233995736766e-17},{"v0":15,"v1":14,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":16,"v1":17,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":15,"v1":17,"color":"000000","bCoef":0,"cMask":["red","blue","ball"]},{"v0":18,"v1":19,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50},{"v0":18,"v1":20,"curve":0,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-60},{"v0":19,"v1":24,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":60},{"v0":25,"v1":26,"color":"000000","bCoef":0,"cMask":["ball"]},{"v0":28,"v1":29,"cMask":[]},{"v0":36,"v1":37,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-50},{"v0":37,"v1":38,"color":"000000","cMask":["ball"],"cGroup":["ball"],"bias":-60},{"v0":41,"v1":43,"curve":-89.99999999,"color":"000000"},{"v0":43,"v1":44,"curve":0,"color":"000000","bCoef":0},{"v0":44,"v1":45,"curve":-89.99999999,"color":"000000"},{"v0":46,"v1":47,"curve":0,"cMask":[]},{"v0":50,"v1":51,"curve":0,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50}],"planes":[{"normal":[0,1],"dist":-295.5069602335031,"bCoef":0},{"normal":[0,-1],"dist":-307.1558067516866,"bCoef":0},{"normal":[1,0],"dist":-608.1657367142399,"bCoef":0},{"normal":[-1,0],"dist":-604.9919880683518,"bCoef":0}],"goals":[{"p0":[-561.3,80],"p1":[-561.3,-80],"team":"red"},{"p0":[561.3,80],"p1":[561.3,-80],"team":"blue"}],"discs":[{"radius":8.75,"invMass":1.11,"pos":[0,0],"color":"FFFFFF","cGroup":["ball","kick","score"],"damping":0.991},{"radius":0,"invMass":0,"pos":[-1311,-19],"color":"transparent","bCoef":0,"cMask":["red"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-1310,29],"color":"transparent","bCoef":0,"cMask":["blue"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-1308,62],"color":"transparent","bCoef":0,"cMask":["red","blue"],"cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[-550,-90],"color":"e56e56","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[550,-90],"color":"5689e5","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[550,90],"color":"5689e5","cGroup":["ball"]},{"radius":0,"pos":[-1149,-485],"cMask":[]},{"radius":0,"pos":[-1149,-485],"cMask":[]},{"radius":0,"pos":[1155.671526641948,-102.2725364171434],"cMask":[]},{"radius":0,"pos":[-1149,485],"cMask":[]},{"radius":0,"pos":[1149,485],"cMask":[]},{"radius":0,"pos":[-1149,485],"cMask":[]},{"radius":0,"pos":[1149,485],"cMask":[]},{"radius":8,"invMass":0,"pos":[-550,90],"color":"e56e56","cGroup":["ball"]}],"playerPhysics":{"bCoef":0.4,"damping":0.9605,"acceleration":0.12,"kickStrength":5.75,"cGroup":["red","blue"]},"ballPhysics":"disc0","spawnDistance":400,"traits":{},"joints":[],"redSpawnPoints":[],"blueSpawnPoints":[],"canBeStored":false}`
    },
    biggerx1: {
        nombre: "Bigger x1 LNB",
        minJugadores: 2,
        maxJugadores: 6,
        hbs: `{"name":"Bigger x1 LNB","width":420,"height":200,"bg":{"width":380,"height":170,"kickOffRadius":120,"color":"444444"},"vertexes":[{"x":0,"y":170,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"],"vis":false},{"x":0,"y":85,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-85,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-170,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"],"bias":0,"curve":0,"vis":false},{"x":520,"y":150,"cMask":[]},{"x":520,"y":100,"cMask":[]},{"x":520,"y":-100,"cMask":[]},{"x":-520,"y":150,"cMask":[]},{"x":-520,"y":100,"cMask":[]},{"x":0,"y":85,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":-85,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":85,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":-384.8105676799998,"y":-76.16293376,"cMask":["ball"],"cGroup":["red","blue","wall"],"color":"000000","curve":89.99999999999999},{"x":-380,"y":65,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":380,"y":65,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":420,"y":45,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":380,"y":-65,"bCoef":0,"cMask":["red","blue","ball"],"color":"000000"},{"x":420,"y":-42,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-380,"y":170,"cMask":["ball"],"cGroup":["red","blue","wall"],"curve":0},{"x":380,"y":170,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":-380,"y":65,"cMask":["ball"],"cGroup":["red","blue","wall"],"curve":0},{"x":-380,"y":-170,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":380,"y":-170,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":380,"y":-65,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":380,"y":65,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":420,"y":7,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":420,"y":-7,"bCoef":0,"cMask":["ball"],"color":"000000"},{"x":-380,"y":-70,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":380,"y":65,"cMask":[]},{"x":380,"y":-65,"cMask":[]},{"x":0,"y":85,"cMask":[]},{"x":0,"y":-85,"cMask":[]},{"x":0,"y":-310,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":310,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-85,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":85,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":-380,"y":-170,"cMask":["ball"],"cGroup":["red","blue","wall"]},{"x":380,"y":-170,"cMask":["ball"],"cGroup":["ball"],"color":"000000","bias":-60},{"x":380,"y":-65,"cMask":["ball"],"cGroup":["ball"],"color":"000000","bias":-60},{"x":380,"y":65,"cMask":[],"curve":0},{"x":380,"y":-65,"cMask":[],"curve":0},{"x":-380,"y":-65,"curve":-89.99999999,"color":"000000"},{"x":-380,"y":65,"curve":0,"color":"000000"},{"x":-420,"y":-45,"bCoef":0,"curve":0},{"x":-420,"y":45,"bCoef":0,"curve":-89.99999999},{"x":-380,"y":65,"curve":-89.99999999},{"x":-380,"y":65,"cMask":[],"curve":0},{"x":-380,"y":-65,"cMask":[],"curve":0},{"x":-380,"y":-170,"cMask":["ball"],"cGroup":["red","blue","wall"],"curve":0},{"x":-380,"y":-65,"cMask":["ball"],"cGroup":["red","blue","wall"],"color":"000000","curve":0},{"x":-380,"y":-170,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50},{"x":-380,"y":-65,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50},{"x":0,"y":200,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"],"vis":false},{"x":0,"y":-200,"cMask":["red","blue"],"cGroup":["redKO","blueKO"],"bias":0,"curve":0,"vis":false}],"segments":[{"v0":0,"v1":1,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":2,"v1":3,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":9,"v1":10,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"],"curveF":6.123233995736766e-17},{"v0":10,"v1":11,"curve":180,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO"],"curveF":6.123233995736766e-17},{"v0":15,"v1":14,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":16,"v1":17,"curve":89.99999999999999,"color":"000000","bCoef":0,"cMask":["red","blue","ball"],"curveF":1.0000000000000002},{"v0":15,"v1":17,"color":"000000","bCoef":0,"cMask":["red","blue","ball"]},{"v0":18,"v1":19,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50},{"v0":18,"v1":20,"curve":0,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-60},{"v0":19,"v1":24,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":60},{"v0":25,"v1":26,"color":"000000","bCoef":0,"cMask":["ball"]},{"v0":28,"v1":29,"cMask":[]},{"v0":36,"v1":37,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":-50},{"v0":37,"v1":38,"color":"000000","cMask":["ball"],"cGroup":["ball"],"bias":-60},{"v0":41,"v1":43,"curve":-89.99999999,"color":"000000"},{"v0":43,"v1":44,"curve":0,"color":"000000","bCoef":0},{"v0":44,"v1":45,"curve":-89.99999999,"color":"000000"},{"v0":46,"v1":47,"curve":0,"cMask":[]},{"v0":50,"v1":51,"curve":0,"cMask":["ball"],"cGroup":["red","blue","wall"],"bias":50},{"v0":0,"v1":52,"vis":false,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":3,"v1":53,"curve":0,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"],"bias":0}],"planes":[{"normal":[0,1],"dist":-210,"bCoef":0},{"normal":[0,-1],"dist":-210,"bCoef":0},{"normal":[1,0],"dist":-430,"bCoef":0},{"normal":[-1,0],"dist":-430,"bCoef":0}],"goals":[{"p0":[-390,55],"p1":[-390,-55],"team":"red"},{"p0":[390,55],"p1":[390,-55],"team":"blue"}],"discs":[{"radius":8.75,"invMass":1.11,"pos":[0,0],"color":"FFFFFF","cGroup":["ball","kick","score"],"damping":0.991},{"radius":0,"invMass":0,"pos":[-900,-19],"color":"transparent","bCoef":0,"cMask":["red"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-900,29],"color":"transparent","bCoef":0,"cMask":["blue"],"cGroup":["ball"]},{"radius":0,"invMass":0,"pos":[-900,62],"color":"transparent","bCoef":0,"cMask":["red","blue"],"cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[-380,-65],"color":"e56e56","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[380,-65],"color":"5689e5","cGroup":["ball"]},{"radius":8,"invMass":0,"pos":[380,65],"color":"5689e5","cGroup":["ball"]},{"radius":0,"pos":[-800,-340],"cMask":[]},{"radius":0,"pos":[-800,-340],"cMask":[]},{"radius":0,"pos":[800,-72],"cMask":[]},{"radius":0,"pos":[-800,340],"cMask":[]},{"radius":0,"pos":[800,340],"cMask":[]},{"radius":0,"pos":[-800,340],"cMask":[]},{"radius":0,"pos":[800,340],"cMask":[]},{"radius":8,"invMass":0,"pos":[-380,65],"color":"e56e56","cGroup":["ball"]}],"playerPhysics":{"bCoef":0.4,"damping":0.9605,"acceleration":0.12,"kickStrength":5.75,"cGroup":["red","blue"]},"ballPhysics":"disc0","spawnDistance":280,"canBeStored":false}`
    }
};

// VARIABLES GLOBALES
let mapaActual = "biggerx1"; // Mapa inicial que será actualizado cuando se configure la sala
let mapaRealmenteAplicado = false; // Flag para verificar que el mapa inicial se haya aplicado correctamente
let adminActual = null;

// SISTEMA DE CONTRASEÑA AUTOMÁTICA (variables ya declaradas arriba)
const INTERVALO_CAMBIO_CONTRASEÑA = 30 * 24 * 60 * 60 * 1000; // 30 días en milisegundos
let timerCambioContraseña = null;

// ESTADO DE LA SALA
let salaEsPublica = roomPublic;
let ultimoEstadoSala = roomPublic;

// FUNCIÓN PARA GENERAR CONTRASEÑA ALEATORIA
function generarContraseñaAleatoria() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// FUNCIÓN PARA CAMBIAR CONTRASEÑA AUTOMÁTICAMENTE
function cambiarContraseñaAutomatica() {
    const nuevaContraseña = generarContraseñaAleatoria();
    contraseñaActual = nuevaContraseña;
    ultimoCambioContraseña = Date.now();
    
    // Cambiar la contraseña en la sala
    room.setPassword(nuevaContraseña);
    
            // Enviar reporte
            enviarOEditarReporteSala("Cambio automático de contraseña mensual", true);
    
    anunciarGeneral(`🔐 ⚠️ CONTRASEÑA CAMBIADA AUTOMÁTICAMENTE ⚠️ 🔐`, "FF6B6B", "bold");
    anunciarGeneral(`🔑 Nueva contraseña: ${nuevaContraseña}`, "FFD700", "bold");
}

// FUNCIÓN PARA PROGRAMAR PRÓXIMO CAMBIO DE CONTRASEÑA
function programarCambioContraseña() {
    const tiempoRestante = INTERVALO_CAMBIO_CONTRASEÑA - (Date.now() - ultimoCambioContraseña);
    
    if (tiempoRestante <= 0) {
        // Ya es hora de cambiar
        cambiarContraseñaAutomatica();
    } else {
        // Programar para el futuro
        if (timerCambioContraseña) {
            clearTimeout(timerCambioContraseña);
        }
        
        timerCambioContraseña = setTimeout(() => {
            cambiarContraseñaAutomatica();
            // Programar el siguiente cambio
            programarCambioContraseña();
        }, tiempoRestante);
        
        const diasRestantes = Math.ceil(tiempoRestante / (24 * 60 * 60 * 1000));
        // Próximo cambio de contraseña programado
    }
}

// FUNCIÓN PARA OBTENER INFORMACIÓN DE LA SALA
function obtenerInfoSala() {
    const jugadores = room.getPlayerList();
    const totalJugadores = jugadores.filter(j => !esBot(j)).length;
    const jugadoresEnJuego = jugadores.filter(j => j.team === 1 || j.team === 2).length;
    
    // Obtener enlace de la sala (simulado ya que no tenemos acceso directo)
    const enlaceSala = `[Enlace no disponible desde el bot]`;
    
    // Determinar estado del partido
    let estadoPartido = "En espera";
    let tiempoPartido = "--:--";
    let resultadoActual = "0 - 0";
    
    if (partidoEnCurso) {
        const scores = room.getScores();
        if (scores) {
            const minutos = Math.floor(scores.time / 60);
            const segundos = Math.floor(scores.time % 60);
            tiempoPartido = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
            resultadoActual = `${scores.red} - ${scores.blue}`;
            estadoPartido = "En partido";
        }
    }
    
    return {
        nombre: roomName,
        enlace: enlaceSala,
        jugadoresTotales: totalJugadores,
        jugadoresEnJuego: jugadoresEnJuego,
        maxJugadores: maxPlayers,
        contraseña: contraseñaActual,
        esPublica: salaEsPublica,
        estadoPartido,
        tiempoPartido,
        resultadoActual
    };
}

// FUNCIÓN PARA ENVIAR REPORTE DE SALA
function enviarReporteSala(razon = "Reporte automático", forzarEnvio = false) {
    if (!webhookReportesSala || webhookReportesSala.length === 0) {
        return;
    }
    
    const info = obtenerInfoSala();
    const estadoSala = info.esPublica ? "pública" : "privada";
    const iconoEstado = info.esPublica ? "🟢" : "🔴";
    
    // Emojis específicos para contraseña
    const iconoContraseña = info.contraseña ? "🔒" : "🔓";
    const contraseñaTexto = info.contraseña ? `"${info.contraseña}"` : "Sin contraseña";
    
    // Emoji para estado del partido
    let estadoEmoji = "⏳"; // Por defecto esperando jugadores
    let estadoTexto = "Esperando jugadores";
    
    if (info.jugadoresEnJuego >= 2 && !partidoEnCurso) {
        estadoEmoji = "🧍🧍‍♂️";
        estadoTexto = "Jugadores presentes, pero sin juego aún";
    } else if (partidoEnCurso) {
        estadoEmoji = "🕹️";
        estadoTexto = "Partido en juego";
    }
    
    // Formatear el mensaje según la sintaxis solicitada
    const mensaje = `:white_check_mark: La sala ${estadoSala} de LNB Bigger (Juegan Todos) X7 está abierta.

🏷️ Sala: "${info.nombre}"
🔗 Link: "${info.enlace}"
👥 Jugadores: ${info.jugadoresEnJuego}/${info.maxJugadores}
${iconoContraseña} Contraseña: ${contraseñaTexto}
${estadoEmoji} Estado: ${estadoTexto} » ["${info.tiempoPartido}"] 🔴 "${info.resultadoActual}" 🔵`;
    
    const embed = {
        title: `${iconoEstado} Reporte de Sala LNB`,
        description: mensaje,
        color: info.esPublica ? parseInt("00FF00", 16) : parseInt("FF6B6B", 16),
        fields: [
            {
                name: "📊 Detalles",
value: `**Mapa:** ${mapas[mapaActual] ? mapas[mapaActual].nombre : 'Desconocido'}\\n**Razón:** ${razon}`,
                inline: false
            }
        ],
        footer: {
            text: "Liga Nacional de Bigger LNB • " + new Date().toLocaleString() + " • Script by ИФT"
        },
        timestamp: new Date().toISOString()
    };
    
    const payload = {
        content: forzarEnvio ? "🔐 **CAMBIO AUTOMÁTICO DE CONTRASEÑA MENSUAL**" : "📊 **Reporte de Estado de Sala**",
        embeds: [embed]
    };
    
    fetch(webhookReportesSala, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
            if (forzarEnvio) {
                anunciarExito("📤 Reporte de cambio de contraseña enviado a Discord");
            }
        }
    })
    .catch(error => {
        // Error de conexión al enviar reporte de sala
    });
}

// FUNCIÓN PARA DETECTAR CAMBIOS EN EL ESTADO DE LA SALA
function verificarCambioEstadoSala() {
    const esPublicaAhora = room.getPassword() === null;
    
    if (esPublicaAhora !== salaEsPublica) {
        const estadoAnterior = salaEsPublica ? "pública" : "privada";
        const estadoNuevo = esPublicaAhora ? "pública" : "privada";
        
        salaEsPublica = esPublicaAhora;
        
        // Estado de sala cambió
        
        // Enviar reporte del cambio
        const razon = `Admin cambió sala de ${estadoAnterior} a ${estadoNuevo}`;
        enviarOEditarReporteSala(razon);
        
        anunciarGeneral(`🔄 La sala cambió de ${estadoAnterior} a ${estadoNuevo}`, "87CEEB", "bold");
    }
}
let estadisticasPartido = {
    jugadores: {},
    golesRed: 0,
    golesBlue: 0,
    iniciado: false,
    duracion: 0,
    mejorJugador: null,
    arqueroRed: null,
    arqueroBlue: null,
    tiempoVallaInvictaRed: 0,
    tiempoVallaInvictaBlue: 0
};
let replayActual = null;
let partidoEnCurso = false;
let replayData = null; // Datos del replay para enviar a Discord
let tiempoInicioPartido = null; // Timestamp de inicio del partido
let reporteEnviado = false; // Flag para evitar envíos duplicados

// SISTEMA DE ESTADÍSTICAS PERSISTENTES
let estadisticasGlobales = {
    jugadores: {}, // {identificadorUnico: {nombre, partidos, goles, etc}}
    records: {
        mayorGoles: {jugador: "", cantidad: 0, fecha: ""},
        mayorAsistencias: {jugador: "", cantidad: 0, fecha: ""},
        partidoMasLargo: {duracion: 0, fecha: "", equipos: ""},
        goleadaMasGrande: {diferencia: 0, resultado: "", fecha: ""},
        hatTricks: [], // [{jugador, fecha, goles}]
        vallasInvictas: [] // [{jugador, tiempo, fecha}]
    },
    totalPartidos: 0,
    fechaCreacion: new Date().toISOString(),
    contadorJugadores: 0 // Para generar IDs únicos
};

// Mapeo de jugadores activos en la sesión actual
let jugadoresActivos = new Map(); // {playerID: identificadorUnico}

// SISTEMA AUTO START/STOP
let autoStartEnabled = true;
let autoStopEnabled = true;
let minJugadoresParaIniciar = 2; // Mínimo de jugadores para auto start (se ajustará según el mapa)
let tiempoEsperaInicio = 800; // 0.8 segundos de espera antes de iniciar (optimizado)
let timeoutAutoStart = null;
let mensajeAutoStartMostrado = false; // Controla si ya se mostró el mensaje de auto-start

// SISTEMA DE BLOQUEO DE AUTO-START PARA REPLAY
let bloqueadoPorReplay = false; // Bloquea auto-start hasta completar envío de replay
let intentosAutoStartBloqueados = 0; // Contador de intentos bloqueados

// SISTEMA AFK
let jugadoresAFK = new Map(); // {id: {ultimaActividad: timestamp, posicionAnterior: {x, y}}}
const TIEMPO_AFK = 15000; // 15 segundos en milisegundos para mover a espectadores
const TIEMPO_AFK_SALA_LLENA = 120000; // 2 minutos en milisegundos para expulsar cuando sala está llena
const MINIMO_MOVIMIENTO_AFK = 2; // Distancia mínima para no ser considerado AFK
const COOLDOWN_COMANDO = 15000; // 15 segundos de cooldown para comandos
let intervalAFK = null;

// SISTEMA DE BLOQUEO DE MOVIMIENTO
let bloqueoMovimientoActivo = false; // Variable para bloquear movimiento después de mezcla
let equiposJugadoresAntesMovimiento = new Map(); // Para rastrear posiciones antes del movimiento
let mezclaProcesandose = false; // Variable para evitar múltiples llamadas durante la mezcla

// Variables para el seguimiento de la pelota
let ultimoTocador = null;
let penultimoTocador = null;
let tiempoUltimoToque = 0;

// Sistema de mensajes personalizados
let mensajesPersonalizados = new Map(); // {id: {gol: "mensaje", asistencia: "mensaje"}}

// Sistema de votación para llamar admin
let votacionLlamarAdmin = {
    activa: false,
    iniciador: null,
    mensaje: "",
    votos: new Set(), // IDs de jugadores que han votado
    tiempoInicio: 0,
    timeout: null
};

// Sistema de cooldown para llamar admin (30 minutos)
let cooldownLlamarAdmin = {
    ultimoUso: 0,
    duracionCooldown: 30 * 60 * 1000 // 30 minutos en milisegundos
};

// Sistema de Piedra, Papel o Tijeras
let desafiosPPT = new Map(); // {desafiadorID: {oponente, jugadaDesafiador, tiempoInicio, timeout}}

// SISTEMA DE MODERACIÓN
let jugadoresMuteados = new Set(); // IDs de jugadores silenciados permanentemente
let jugadoresMuteadosTemporales = new Map(); // {playerID: {finMute: timestamp, razon: string, timeoutId: timeoutId}}
let advertenciasJugadores = new Map(); // {playerID: cantidad_de_advertencias}

// SISTEMA DE UID PARA BANEOS
let jugadoresBaneadosUID = new Map(); // {auth: {nombre: string, razon: string, fecha: string, admin: string, duracion?: number}}
let jugadoresUID = new Map(); // {playerID: auth} - Mapeo temporal de IDs a UIDs

// SISTEMA DE PROTECCIÓN CONTRA MÚLTIPLES CONEXIONES DEL MISMO NAVEGADOR
const MAX_JUGADORES_POR_IP = 1; // Máximo 1 jugador por navegador/IP
let conexionesPorAuth = new Map(); // {auth: {jugadores: Set(playerIDs), timestamp: number}}
let jugadoresPorAuth = new Map(); // {playerID: auth} - Mapeo temporal de IDs a UIDs
let conexionesPorIP = new Map(); // {ip: {jugadores: Set(playerIDs), timestamp: number}}
let jugadoresPorIP = new Map(); // {playerID: ip} - Mapeo de jugador a IP
const TIEMPO_LIMITE_IP = 30 * 60 * 1000; // 30 minutos de gracia para la misma IP
let ipsBloqueadas = new Map(); // {ip: {razon: string, timestamp: number}} - IPs temporalmente bloqueadas

// ==================== FUNCIONES AUXILIARES PARA PROTECCIÓN IP ====================

/**
 * Obtiene un identificador único de conexión para el jugador
 * @param {Object} jugador - El objeto jugador
 * @returns {string|null} - El identificador único de conexión
 */
function obtenerIdentificadorConexion(jugador) {
    try {
        // Para detectar el mismo navegador, usamos solo factores que sean iguales entre pestañas
        let identificadores = [];
        
        // 1. Auth del jugador (MISMO para todas las pestañas del mismo navegador)
        if (jugador && jugador.auth) {
            identificadores.push(`auth:${jugador.auth}`);
        } else {
            // Si no hay auth, usar una combinación del nombre y conexión base
            if (jugador && jugador.name) {
                identificadores.push(`name:${jugador.name}`);
            }
            // Agregar un identificador por defecto para navegadores sin auth
            identificadores.push('noauth:default');
        }
        
        // NO incluir ID único ni timestamp para que sea igual entre pestañas
        
        // Crear identificador consistente para el mismo navegador
        const identificadorCompleto = identificadores.join('|');
        const hash = simpleHash(identificadorCompleto);
        
        // Generar "IP simulada" basada solo en factores consistentes
        return `192.168.${Math.floor(hash / 256) % 256}.${hash % 256}`;
        
    } catch (error) {
        console.error(`❌ Error obteniendo identificador para jugador ${jugador?.name}:`, error);
        return null;
    }
}

/**
 * Detecta si un jugador está usando múltiples pestañas/conexiones
 * @param {Object} jugador - El objeto jugador
 * @returns {boolean} - True si se detectan múltiples conexiones
 */
function detectarMultiplesConexiones(jugador) {
    try {
        if (!jugador) {
            return false;
        }
        
        console.log(`🔍 DEBUG: Verificando múltiples conexiones para ${jugador.name} (ID: ${jugador.id}, Auth: ${jugador.auth})`);
        
        // Obtener todos los jugadores conectados EXCLUYENDO al jugador actual
        const jugadoresConectados = room.getPlayerList().filter(j => j.id !== jugador.id);
        
        console.log(`🔍 DEBUG: Jugadores ya conectados: ${jugadoresConectados.length}`);
        jugadoresConectados.forEach(j => {
            console.log(`  - ${j.name} (ID: ${j.id}, Auth: ${j.auth})`);
        });
        
        // MÉTODO 1: Verificar por AUTH (más confiable)
        if (jugador.auth) {
            const jugadoresConMismoAuth = jugadoresConectados.filter(j => 
                j.auth && j.auth === jugador.auth
            );
            
            if (jugadoresConMismoAuth.length > 0) {
                console.log(`🚫 DEBUG: Detectadas ${jugadoresConMismoAuth.length} conexiones con el mismo AUTH: ${jugador.auth}`);
                jugadoresConMismoAuth.forEach(j => {
                    console.log(`  - Jugador duplicado: ${j.name} (ID: ${j.id})`);
                });
                return true;
            }
        }
        
        // MÉTODO 2: Verificar por IP simulada como respaldo
        const ipJugador = obtenerIdentificadorConexion(jugador);
        if (ipJugador) {
            const jugadoresConMismaIP = jugadoresConectados.filter(j => {
                const ipOtroJugador = obtenerIdentificadorConexion(j);
                return ipOtroJugador === ipJugador;
            });
            
            if (jugadoresConMismaIP.length > 0) {
                console.log(`🚫 DEBUG: Detectadas ${jugadoresConMismaIP.length} conexiones con la misma IP: ${ipJugador}`);
                jugadoresConMismaIP.forEach(j => {
                    console.log(`  - Jugador con misma IP: ${j.name} (ID: ${j.id})`);
                });
                return true;
            }
        }
        
        console.log(`✅ DEBUG: No se detectaron múltiples conexiones para ${jugador.name}`);
        return false;
        
    } catch (error) {
        console.error(`❌ Error detectando múltiples conexiones:`, error);
        return false;
    }
}

/**
 * Obtiene la IP de un jugador (mantenida para compatibilidad)
 * @param {Object} jugador - El objeto jugador
 * @returns {string|null} - La IP del jugador o null si no se puede obtener
 */
function obtenerIPJugador(jugador) {
    // Redirigir a la nueva función
    return obtenerIdentificadorConexion(jugador);
}

/**
 * Función hash simple para generar IPs consistentes
 * @param {string} str - String a hashear
 * @returns {number} - Valor hash
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Limpia las conexiones IP de un jugador específico
 * @param {Object} jugador - El jugador que se desconectó
 */
function limpiarConexionesIP(jugador) {
    try {
        const ipJugador = jugadoresPorIP.get(jugador.id);
        
        if (ipJugador) {
            console.log(`🧹 DEBUG IP: Limpiando conexión de ${jugador.name} (IP: ${ipJugador})`);
            
            // Remover el jugador del mapeo
            jugadoresPorIP.delete(jugador.id);
            
            // Actualizar la lista de conexiones de esta IP
            const conexionIP = conexionesPorIP.get(ipJugador);
            if (conexionIP) {
                conexionIP.jugadores.delete(jugador.id);
                
                // Si no quedan más jugadores de esta IP, eliminar la entrada
                if (conexionIP.jugadores.size === 0) {
                    conexionesPorIP.delete(ipJugador);
                    console.log(`🧹 DEBUG IP: IP ${ipJugador} completamente limpia`);
                    
                    // *** IMPORTANTE: Limpiar también el bloqueo temporal si no hay más conexiones ***
                    const bloqueIP = ipsBloqueadas.get(ipJugador);
                    if (bloqueIP) {
                        ipsBloqueadas.delete(ipJugador);
                        console.log(`🔓 DEBUG IP: Bloqueo temporal removido para IP ${ipJugador} (jugador desconectado)`);
                    }
                } else {
                    console.log(`🧹 DEBUG IP: IP ${ipJugador} aún tiene ${conexionIP.jugadores.size} conexiones`);
                }
            }
        } else {
            console.log(`⚠️ DEBUG IP: No se encontró IP para jugador ${jugador.name} al limpiar`);
        }
    } catch (error) {
        console.error(`❌ Error limpiando conexiones IP para ${jugador?.name}:`, error);
    }
}

/**
 * Envía notificación sobre IP bloqueada (Discord webhook si está disponible)
 * @param {string} ip - La IP bloqueada
 * @param {string} nombreJugador - Nombre del jugador que intentó conectarse
 * @param {string} jugadoresConectados - Lista de jugadores ya conectados desde esa IP
 */
function enviarNotificacionIPBloqueada(ip, nombreJugador, jugadoresConectados) {
    try {
        console.log(`🚫 NOTIFICACIÓN IP BLOQUEADA:`);
        console.log(`   IP: ${ip}`);
        console.log(`   Jugador rechazado: ${nombreJugador}`);
        console.log(`   Jugadores ya conectados: ${jugadoresConectados}`);
        console.log(`   Tiempo: ${new Date().toISOString()}`);
        
        // Si tienes webhook de Discord configurado, enviar notificación
        if (typeof enviarDiscordEmbed === 'function') {
            const embed = {
                title: "🚫 IP Bloqueada - Múltiples Conexiones",
                description: `Se bloqueó temporalmente la IP **${ip}** por intentos de múltiples conexiones.`,
                color: 0xFF0000, // Rojo
                fields: [
                    {
                        name: "Jugador Rechazado",
                        value: nombreJugador,
                        inline: true
                    },
                    {
                        name: "Ya Conectados",
                        value: jugadoresConectados || "Ninguno",
                        inline: true
                    },
                    {
                        name: "Límite",
                        value: `${MAX_JUGADORES_POR_IP} jugadores por red`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Sistema de Protección LNB"
                }
            };
            
            enviarDiscordEmbed(embed, "Protección IP activada");
        }
        
        // Log adicional para estadísticas
        console.log(`📊 ESTADÍSTICA IP: Bloqueo de IP registrado - Total IPs bloqueadas: ${ipsBloqueadas.size}`);
        
    } catch (error) {
        console.error(`❌ Error enviando notificación de IP bloqueada:`, error);
    }
}

/**
 * Limpia IPs bloqueadas que han expirado
 */
function limpiarIPsBloqueadasExpiradas() {
    try {
        const ahora = Date.now();
        let limpiezasRealizadas = 0;
        
        for (const [ip, bloqueo] of ipsBloqueadas.entries()) {
            if (ahora - bloqueo.timestamp >= TIEMPO_LIMITE_IP) {
                ipsBloqueadas.delete(ip);
                limpiezasRealizadas++;
                console.log(`🧹 DEBUG IP: Bloqueo expirado removido para IP ${ip}`);
            }
        }
        
        if (limpiezasRealizadas > 0) {
            console.log(`🧹 DEBUG IP: Se limpiaron ${limpiezasRealizadas} bloqueos de IP expirados`);
        }
    } catch (error) {
        console.error(`❌ Error limpiando IPs bloqueadas expiradas:`, error);
    }
}

/**
 * Obtiene estadísticas de conexiones IP
 * @returns {Object} - Estadísticas de las conexiones IP
 */
function obtenerEstadisticasIP() {
    try {
        const stats = {
            conexiones_activas: conexionesPorIP.size,
            ips_bloqueadas: ipsBloqueadas.size,
            total_jugadores_conectados: jugadoresPorIP.size,
            conexiones_multiples: 0,
            detalle_conexiones: []
        };
        
        // Analizar conexiones múltiples
        for (const [ip, conexion] of conexionesPorIP.entries()) {
            if (conexion.jugadores.size > 1) {
                stats.conexiones_multiples++;
                
                // Obtener nombres de jugadores
                const nombres = Array.from(conexion.jugadores).map(playerId => {
                    const jugador = room.getPlayerList().find(p => p.id === playerId);
                    return jugador ? jugador.name : `ID:${playerId}`;
                });
                
                stats.detalle_conexiones.push({
                    ip: ip,
                    cantidad: conexion.jugadores.size,
                    jugadores: nombres
                });
            }
        }
        
        return stats;
    } catch (error) {
        console.error(`❌ Error obteniendo estadísticas IP:`, error);
        return {
            conexiones_activas: 0,
            ips_bloqueadas: 0,
            total_jugadores_conectados: 0,
            conexiones_multiples: 0,
            detalle_conexiones: [],
            error: error.message
        };
    }
}

// Limpieza automática de IPs bloqueadas cada 10 minutos
setInterval(limpiarIPsBloqueadasExpiradas, 10 * 60 * 1000);

// ==================== FIN FUNCIONES AUXILIARES PARA PROTECCIÓN IP ====================


// FUNCIÓN AUXILIAR PARA OBTENER JUGADORES SIN HOST
function obtenerJugadoresSinHost() {
    return room.getPlayerList().filter(j => j.id !== 0); // Filtrar Host (ID 0)
}

// FUNCIÓN PARA VERIFICAR SI UN JUGADOR ES EL BOT
function esBot(jugador) {
    if (!jugador) return false;
    return jugador.name === "HOST LNB" || jugador.id === 0;
}

// FUNCIÓN DE PROTECCIÓN CONTRA MOVIMIENTO DEL BOT
function protegerBot(jugadorAMover, accion = "mover") {
    if (esBot(jugadorAMover)) {
        return true; // Permitir la acción si es el bot
    }
    // Protección silenciosa para jugadores normales
    return false; // Bloquear la acción
}

// FUNCIÓN AUXILIAR PARA BUSCAR JUGADORES
function obtenerJugadorPorNombre(nombre) {
    const jugadores = obtenerJugadoresSinHost(); // Usar función sin Host
    
    // Limpiar el nombre de entrada
    const nombreLimpio = nombre.trim().replace(/^@/, '');
    const nombreBusqueda = nombreLimpio.toLowerCase();
    
    console.log(`🔍 DEBUG búsqueda: Buscando jugador "${nombreLimpio}" (original: "${nombre}")`);
    
    // 1. Buscar coincidencia exacta primero
    let jugadorEncontrado = jugadores.find(j => {
        const nombreJugador = j.name.toLowerCase();
        const nombreOriginal = obtenerNombreOriginal(j).toLowerCase();
        
        return nombreJugador === nombreBusqueda || nombreOriginal === nombreBusqueda;
    });
    
    if (jugadorEncontrado) {
        console.log(`✅ DEBUG búsqueda: Coincidencia exacta encontrada: ${jugadorEncontrado.name}`);
        return jugadorEncontrado;
    }
    
    // 2. Buscar con includes (parcial)
    jugadorEncontrado = jugadores.find(j => {
        const nombreJugador = j.name.toLowerCase();
        const nombreOriginal = obtenerNombreOriginal(j).toLowerCase();
        
        return nombreJugador.includes(nombreBusqueda) || nombreOriginal.includes(nombreBusqueda);
    });
    
    if (jugadorEncontrado) {
        console.log(`✅ DEBUG búsqueda: Coincidencia parcial encontrada: ${jugadorEncontrado.name}`);
        return jugadorEncontrado;
    }
    
    // 3. Buscar reemplazando guiones bajos con espacios (solo si no se encontró antes)
    const nombreConEspacios = nombreBusqueda.replace(/_/g, ' ');
    if (nombreConEspacios !== nombreBusqueda) {
        console.log(`🔄 DEBUG búsqueda: Probando con espacios en lugar de guiones bajos: "${nombreConEspacios}"`);
        
        jugadorEncontrado = jugadores.find(j => {
            const nombreJugador = j.name.toLowerCase();
            const nombreOriginal = obtenerNombreOriginal(j).toLowerCase();
            
            return nombreJugador.includes(nombreConEspacios) || nombreOriginal.includes(nombreConEspacios);
        });
        
        if (jugadorEncontrado) {
            console.log(`✅ DEBUG búsqueda: Encontrado con espacios: ${jugadorEncontrado.name}`);
            return jugadorEncontrado;
        }
    }
    
    // 4. Buscar reemplazando espacios con guiones bajos
    const nombreConGuiones = nombreBusqueda.replace(/ /g, '_');
    if (nombreConGuiones !== nombreBusqueda) {
        console.log(`🔄 DEBUG búsqueda: Probando con guiones bajos en lugar de espacios: "${nombreConGuiones}"`);
        
        jugadorEncontrado = jugadores.find(j => {
            const nombreJugador = j.name.toLowerCase();
            const nombreOriginal = obtenerNombreOriginal(j).toLowerCase();
            
            return nombreJugador.includes(nombreConGuiones) || nombreOriginal.includes(nombreConGuiones);
        });
        
        if (jugadorEncontrado) {
            console.log(`✅ DEBUG búsqueda: Encontrado con guiones bajos: ${jugadorEncontrado.name}`);
            return jugadorEncontrado;
        }
    }
    
    // 5. Buscar de forma más flexible (sin caracteres especiales)
    const nombreSinEspeciales = nombreBusqueda.replace(/[^a-zA-Z0-9ΐ-ϿЀ-ӿ٠-ۿ]/g, '');
    if (nombreSinEspeciales.length >= 3) {
        console.log(`🔄 DEBUG búsqueda: Probando sin caracteres especiales: "${nombreSinEspeciales}"`);
        
        jugadorEncontrado = jugadores.find(j => {
            const nombreJugadorSinEspeciales = j.name.toLowerCase().replace(/[^a-zA-Z0-9ΐ-ϿЀ-ӿ٠-ۿ]/g, '');
            const nombreOriginalSinEspeciales = obtenerNombreOriginal(j).toLowerCase().replace(/[^a-zA-Z0-9ΐ-ϿЀ-ӿ٠-ۿ]/g, '');
            
            return nombreJugadorSinEspeciales.includes(nombreSinEspeciales) || nombreOriginalSinEspeciales.includes(nombreSinEspeciales);
        });
        
        if (jugadorEncontrado) {
            console.log(`✅ DEBUG búsqueda: Encontrado sin caracteres especiales: ${jugadorEncontrado.name}`);
            return jugadorEncontrado;
        }
    }
    
    // 6. Mostrar jugadores disponibles para debug
    console.log(`❌ DEBUG búsqueda: Jugador "${nombreLimpio}" no encontrado.`);
    console.log(`📋 DEBUG jugadores disponibles:`);
    jugadores.forEach(j => {
        console.log(`  - "${j.name}" (original: "${obtenerNombreOriginal(j)}", ID: ${j.id})`);
    });
    
    return null;
}

// FUNCIÓN AUXILIAR PARA BUSCAR JUGADORES POR NOMBRE O UID
function obtenerJugadorPorNombreOUID(identificador) {
    const jugadores = obtenerJugadoresSinHost();
    
    // Primero intentar por nombre
    let jugador = jugadores.find(j => 
        j.name.toLowerCase().includes(identificador.toLowerCase()) ||
        obtenerNombreOriginal(j).toLowerCase().includes(identificador.toLowerCase())
    );
    
    if (jugador) {
        return jugador;
    }
    
    // Si no se encuentra por nombre, intentar por UID (auth)
    if (identificador.length >= 8) { // Los UIDs suelen ser largos
        jugador = jugadores.find(j => j.auth && j.auth.includes(identificador));
        if (jugador) {
            return jugador;
        }
    }
    
    return null;
}

// FUNCIÓN MEJORADA PARA OBTENER UID DE UN JUGADOR CON VERIFICACIÓN ROBUSTA DE DUPLICADOS
function obtenerUID(jugador) {
    try {
        // Validación inicial más robusta
        if (!jugador) {
            console.error('❌ obtenerUID: jugador es null o undefined');
            return null;
        }
        
        if (jugador.id === undefined || jugador.id === null) {
            console.error('❌ obtenerUID: jugador.id es null o undefined para jugador:', jugador.name || 'sin nombre');
            return null;
        }
        
        // Verificar si ya tenemos un UID generado para este jugador
        const uidExistente = jugadoresUID.get(jugador.id);
        if (uidExistente && uidExistente.length > 0) {
            // VERIFICACIÓN ADICIONAL: Asegurar que este UID no esté duplicado en otros jugadores
            const otrosJugadoresConMismoUID = Array.from(jugadoresUID.entries()).filter(
                ([otroId, otroUID]) => otroId !== jugador.id && otroUID === uidExistente
            );
            
            if (otrosJugadoresConMismoUID.length > 0) {
                console.warn(`🚨 DUPLICADO DETECTADO: UID ${uidExistente} ya existe en otros jugadores, regenerando...`);
                jugadoresUID.delete(jugador.id); // Eliminar UID duplicado
            } else {
                console.log(`✅ UID existente verificado para ${jugador.name}: ${uidExistente}`);
                return uidExistente;
            }
        }
        
        // PRIORIDAD 1: Verificar auth (propiedad principal de HaxBall para UID)
        if (jugador.auth && typeof jugador.auth === 'string' && jugador.auth.length > 0) {
            // Verificar que este auth no esté ya asignado a otro jugador
            const jugadorConMismoAuth = Array.from(jugadoresUID.entries()).find(
                ([otroId, otroUID]) => otroId !== jugador.id && otroUID === jugador.auth
            );
            
            if (!jugadorConMismoAuth) {
                console.log(`✅ UID obtenido de jugador.auth: ${jugador.auth}`);
                jugadoresUID.set(jugador.id, jugador.auth);
                return jugador.auth;
            } else {
                console.warn(`⚠️ Auth ${jugador.auth} ya está asignado al jugador ID ${jugadorConMismoAuth[0]}`);
            }
        }
        
        // PRIORIDAD 2: Verificar si el conn (connection ID) puede servir como UID temporal
        if (jugador.conn && typeof jugador.conn === 'string' && jugador.conn.length > 8) {
            // Verificar que este conn no esté ya asignado a otro jugador
            const jugadorConMismoConn = Array.from(jugadoresUID.entries()).find(
                ([otroId, otroUID]) => otroId !== jugador.id && otroUID === jugador.conn
            );
            
            if (!jugadorConMismoConn) {
                console.log(`✅ UID temporal obtenido de jugador.conn: ${jugador.conn}`);
                jugadoresUID.set(jugador.id, jugador.conn);
                return jugador.conn;
            } else {
                console.warn(`⚠️ Conn ${jugador.conn} ya está asignado al jugador ID ${jugadorConMismoConn[0]}`);
            }
        }
        
        // Debug detallado: mostrar todas las propiedades del jugador
        console.warn('⚠️ obtenerUID: No se encontró UID natural único en el jugador');
        console.log('🔍 DEBUG UID - Propiedades del jugador:', {
            id: jugador.id,
            name: jugador.name,
            auth: jugador.auth ? `${jugador.auth} (${typeof jugador.auth}, length: ${jugador.auth.length})` : 'null/undefined',
            conn: jugador.conn ? `${jugador.conn} (${typeof jugador.conn}, length: ${jugador.conn.length})` : 'null/undefined',
            team: jugador.team,
            admin: jugador.admin,
            position: jugador.position ? 'tiene posición' : 'sin posición',
            allProperties: Object.keys(jugador)
        });
        
        // PRIORIDAD 3: Generar UID único y robusto con verificación exhaustiva
        let uidGenerado = null;
        let intentos = 0;
        const maxIntentos = 10;
        
        while (intentos < maxIntentos) {
            uidGenerado = generarUIDUnicoMejorado(jugador, intentos);
            
            // Verificar que el UID no esté duplicado
            const existeUID = Array.from(jugadoresUID.values()).includes(uidGenerado);
            
            if (!existeUID && uidGenerado && uidGenerado.length > 0) {
                console.log(`✅ UID único generado para ${jugador.name} en intento ${intentos + 1}: ${uidGenerado}`);
                break;
            }
            
            console.warn(`⚠️ Intento ${intentos + 1}/${maxIntentos} - UID duplicado o inválido: ${uidGenerado}`);
            intentos++;
            uidGenerado = null;
        }
        
        // Validar que el UID generado sea válido
        if (!uidGenerado || uidGenerado.length === 0) {
            console.error(`❌ Error crítico: No se pudo generar UID único para ${jugador.name} después de ${maxIntentos} intentos`);
            return null;
        }
        
        // Verificación final de duplicados antes de asignar
        const verificacionFinal = Array.from(jugadoresUID.values()).filter(uid => uid === uidGenerado);
        if (verificacionFinal.length > 0) {
            console.error(`❌ VERIFICACIÓN FINAL FALLIDA: UID ${uidGenerado} sigue estando duplicado`);
            // Generar UID de emergencia con timestamp
            uidGenerado = `emergency_${jugador.id}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
            console.warn(`🆘 UID de emergencia generado: ${uidGenerado}`);
        }
        
        // Guardar el UID generado
        jugadoresUID.set(jugador.id, uidGenerado);
        console.log(`📝 UID asignado definitivamente para ${jugador.name}: ${uidGenerado}`);
        
        return uidGenerado;
        
    } catch (error) {
        console.error(`❌ Error crítico en obtenerUID para jugador ${jugador?.name || 'desconocido'}:`, error);
        console.error(`📊 Stack trace:`, error.stack);
        return null;
    }
}

// FUNCIÓN PARA GENERAR UID ÚNICO Y CONSISTENTE
function generarUIDUnico(jugador) {
    try {
        // Usar crypto si está disponible (Node.js)
        if (typeof require !== 'undefined') {
            try {
                const crypto = require('crypto');
                // Generar hash basado en nombre + timestamp + datos únicos
                const data = `${jugador.name}_${jugador.id}_${Date.now()}_${Math.random()}`;
                return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
            } catch (e) {
                console.warn('❌ Crypto no disponible, usando generador alternativo');
            }
        }
        
        // Fallback: generador usando hash simple
        const data = `${jugador.name}_${jugador.id}_${Date.now()}_${Math.random()}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit integer
        }
        
        // Convertir a string hexadecimal y asegurar que tenga al menos 16 caracteres
        const uidBase = Math.abs(hash).toString(16).padStart(8, '0');
        const timestamp = Date.now().toString(16);
        return `${uidBase}${timestamp}`.substring(0, 16);
        
    } catch (error) {
        console.error('❌ Error generando UID único:', error);
        // Fallback final
        return `uid_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }
}

// FUNCIÓN MEJORADA PARA GENERAR UID ÚNICO ESPECÍFICO POR JUGADOR CON ANTI-DUPLICADOS
function generarUIDUnicoMejorado(jugador, intentoNumero = 0) {
    try {
        console.log(`🔧 DEBUG UID: Generando UID para ${jugador.name} - intento ${intentoNumero + 1}`);
        
        // Crear un identificador único basado en múltiples propiedades del jugador
        let datosJugador = '';
        
        // 1. Nombre del jugador (limpio)
        const nombreLimpio = jugador.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        datosJugador += nombreLimpio;
        
        // 2. ID del jugador (único en la sesión)
        datosJugador += `_id${jugador.id}`;
        
        // 3. NUEVO: Agregar timestamp actual para unicidad temporal
        const timestamp = Date.now();
        datosJugador += `_ts${timestamp}`;
        
        // 4. NUEVO: Agregar número de intento para generar UIDs diferentes en cada intento
        datosJugador += `_att${intentoNumero}`;
        
        // 5. Información adicional si está disponible
        if (jugador.admin !== undefined) {
            datosJugador += `_adm${jugador.admin ? '1' : '0'}`;
        }
        
        // 6. NUEVO: Agregar información de auth y conn si están disponibles
        if (jugador.auth) {
            const authHash = simpleHash(jugador.auth);
            datosJugador += `_auth${authHash}`;
        }
        
        if (jugador.conn) {
            const connHash = simpleHash(jugador.conn);
            datosJugador += `_conn${connHash}`;
        }
        
        // 7. NUEVO: Agregar factor aleatorio para evitar patrones predecibles
        const factorAleatorio = Math.floor(Math.random() * 10000);
        datosJugador += `_rand${factorAleatorio}`;
        
        console.log(`🔍 DEBUG UID: Datos base para ${jugador.name}: ${datosJugador.substring(0, 50)}...`);
        
        // Usar crypto si está disponible para mejor hashing
        if (typeof require !== 'undefined') {
            try {
                const crypto = require('crypto');
                const hash = crypto.createHash('sha256').update(datosJugador).digest('hex');
                const uidFinal = hash.substring(0, 32); // UID más largo y único
                console.log(`✅ DEBUG UID: UID generado con crypto para ${jugador.name}: ${uidFinal}`);
                return uidFinal;
            } catch (e) {
                console.warn('⚠️ Crypto no disponible para UID mejorado, usando alternativo');
            }
        }
        
        // Fallback: Sistema de hash múltiple mejorado
        const hashCombinado = generarHashCombinado(datosJugador);
        
        // Generar UID final usando timestamp y número de intento para unicidad
        const timestampHex = timestamp.toString(16).substring(-8); // Últimos 8 caracteres del timestamp en hex
        const intentoHex = intentoNumero.toString(16).padStart(2, '0');
        const aleatorioHex = factorAleatorio.toString(16).padStart(4, '0');
        
        const uidFinal = `${hashCombinado}${timestampHex}${intentoHex}${aleatorioHex}`.substring(0, 32);
        
        console.log(`✅ DEBUG UID: UID generado con fallback para ${jugador.name}: ${uidFinal}`);
        return uidFinal;
        
    } catch (error) {
        console.error('❌ Error en generarUIDUnicoMejorado:', error);
        // Fallback final usando la función original con timestamp
        const emergencyUID = `emergency_${jugador.id}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
        console.warn(`🆘 DEBUG UID: UID de emergencia generado para ${jugador.name}: ${emergencyUID}`);
        return emergencyUID;
    }
}

// FUNCIÓN AUXILIAR PARA GENERAR HASH COMBINADO
function generarHashCombinado(datos) {
    console.log(`🔧 DEBUG HASH: Generando hash combinado para datos de longitud ${datos.length}`);
    
    // Hash 1: Algoritmo estándar
    let hash1 = 5381; // Usar constante DJB2
    for (let i = 0; i < datos.length; i++) {
        hash1 = ((hash1 << 5) + hash1) + datos.charCodeAt(i);
        hash1 = hash1 & hash1; // Convertir a 32bit
    }
    
    // Hash 2: Algoritmo FNV-1a simplificado
    let hash2 = 2166136261; // FNV offset basis
    for (let i = 0; i < datos.length; i++) {
        hash2 ^= datos.charCodeAt(i);
        hash2 *= 16777619; // FNV prime
        hash2 = hash2 & hash2; // Convertir a 32bit
    }
    
    // Hash 3: Algoritmo personalizado con datos invertidos
    let hash3 = 0;
    const datosInvertidos = datos.split('').reverse().join('');
    for (let i = 0; i < datosInvertidos.length; i++) {
        const char = datosInvertidos.charCodeAt(i);
        hash3 = ((hash3 << 7) - hash3) + char;
        hash3 = hash3 & hash3;
    }
    
    // Combinar los tres hashes
    const hashFinal = (Math.abs(hash1) ^ Math.abs(hash2) ^ Math.abs(hash3)).toString(16).padStart(16, '0');
    
    console.log(`✅ DEBUG HASH: Hash combinado generado: ${hashFinal}`);
    return hashFinal;
}

// FUNCIONES DE ANUNCIO CON VERIFICACIÓN DE SEGURIDAD
function anunciarGeneral(mensaje, color = AZUL_LNB, estilo = "normal") {
    // Cambiar color a crema si el mensaje es un número rápido
    if (/^\d{2}$/.test(mensaje)) {
        color = "F5DEB3"; // Código hexadecimal para color crema
    }
    if (typeof room !== 'undefined' && room && room.sendAnnouncement) {
        room.sendAnnouncement(mensaje, null, parseInt(color, 16), estilo, 1);
    } else {
        // Anuncio general enviado
    }
}

function anunciarExito(mensaje) {
    if (typeof room !== 'undefined' && room && room.sendAnnouncement) {
        room.sendAnnouncement("✅ " + mensaje, null, parseInt("00FF00", 16), "bold", 1);
    } else {
        // Mensaje de éxito enviado
    }
}

function anunciarError(mensaje, jugador) {
    if (typeof room !== 'undefined' && room && room.sendAnnouncement) {
        if (jugador && jugador.id !== undefined) {
            room.sendAnnouncement("❌ " + mensaje, jugador.id, parseInt("FF0000", 16), "bold", 0);
        } else {
            // Si no hay jugador válido, enviar como mensaje general
            room.sendAnnouncement("❌ " + mensaje, null, parseInt("FF0000", 16), "bold", 1);
        }
    } else {
        // Mensaje de error enviado
    }
}

function anunciarAdvertencia(mensaje, jugador = null) {
    if (typeof room !== 'undefined' && room && room.sendAnnouncement) {
        const targetId = jugador ? jugador.id : null;
        room.sendAnnouncement("⚠️ " + mensaje, targetId, parseInt("FFA500", 16), "bold", targetId ? 0 : 1);
    } else {
        // Mensaje de advertencia enviado
    }
}

function anunciarInfo(mensaje) {
    if (typeof room !== 'undefined' && room && room.sendAnnouncement) {
        room.sendAnnouncement("ℹ️ " + mensaje, null, parseInt(CELESTE_LNB, 16), "normal", 1);
    } else {
        // Mensaje de información enviado
    }
}

function agregarJugadorAEquipo(jugador) {
    // Agregar jugador al equipo con menos jugadores
    const jugadoresRed = room.getPlayerList().filter(j => j.team === 1).length;
    const jugadoresBlue = room.getPlayerList().filter(j => j.team === 2).length;
    const equipo = jugadoresRed > jugadoresBlue ? 2 : 1;
    room.setPlayerTeam(jugador.id, equipo);
    
    // Mensaje de unión al equipo removido para evitar spam
    
    // Llamar al auto balance después de agregar jugador
    setTimeout(() => {
        autoBalanceEquipos();
        verificarAutoStart();
    }, 500);
}

// FUNCIÓN DE AUTO BALANCE DE EQUIPOS
function autoBalanceEquipos() {
    const jugadores = room.getPlayerList();
    const jugadoresRed = jugadores.filter(j => j.team === 1);
    const jugadoresBlue = jugadores.filter(j => j.team === 2);
    const diferencia = Math.abs(jugadoresRed.length - jugadoresBlue.length);

    // Durante partidos, solo balancear si hay una diferencia muy grande (2 o más)
    // Fuera de partidos, balancear con diferencia de 2 o más
    const umbralBalance = partidoEnCurso ? 2 : 2;
    
    if (diferencia >= umbralBalance) {
        const jugadoresAMover = Math.floor(diferencia / 2);
        const equipoMayor = jugadoresRed.length > jugadoresBlue.length ? jugadoresRed : jugadoresBlue;
        const equipoMenorEnum = jugadoresRed.length > jugadoresBlue.length ? 2 : 1;

        // Jugadores candidatos a ser movidos (excluyendo al bot si es necesario)
        const candidatos = equipoMayor.filter(p => !esBot(p));

        // Mezclar aleatoriamente los candidatos
        for (let i = candidatos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]];
        }
        
        // Mover el número necesario de jugadores
        for (let i = 0; i < jugadoresAMover; i++) {
            if (candidatos[i]) {
                const jugador = candidatos[i];
                room.setPlayerTeam(jugador.id, equipoMenorEnum);
                const equipoDestinoNombre = equipoMenorEnum === 1 ? '🔴 ROJO' : '🔵 AZUL';
                
                if (partidoEnCurso) {
                    anunciarGeneral(`⚖️ 🔄 Balance: ${jugador.name} → ${equipoDestinoNombre} 🔄`, "FFD700", "bold");
                } else {
                    anunciarGeneral(`⚖️ 🔄 Auto Balance: ${jugador.name} → ${equipoDestinoNombre} 🔄`, "87CEEB", "bold");
                }
            }
        }
    }
}

// Variables para controlar la frecuencia de verificarAutoStart
let ultimaVerificacionAutoStart = 0;
let verificandoAutoStart = false;
const INTERVALO_MINIMO_VERIFICACION = 1000; // 1 segundo mínimo entre verificaciones

// FUNCIÓN PARA VERIFICAR AUTO START
function verificarAutoStart() {
    const ahora = Date.now();
    
    // Evitar llamadas muy frecuentes
    if (ahora - ultimaVerificacionAutoStart < INTERVALO_MINIMO_VERIFICACION) {
        return;
    }
    
    // Evitar ejecuciones simultáneas
    if (verificandoAutoStart) {
        return;
    }
    
    // NUEVO: Bloquear auto-start si hay un reporte de replay pendiente
    if (bloqueadoPorReplay) {
        intentosAutoStartBloqueados++;
        console.log(`🎬 DEBUG: Auto-start bloqueado por envío de replay pendiente (intento #${intentosAutoStartBloqueados})`);
        
        // Mostrar mensaje solo en el primer intento bloqueado
        // if (intentosAutoStartBloqueados === 1) {
        //     anunciarInfo("⏳ Esperando completar envío de replay antes de iniciar próximo partido...");
        // }
        
        // TIMEOUT DE SEGURIDAD: Solo 8 intentos = 8 segundos máximo
        if (intentosAutoStartBloqueados >= 8) {
            console.log(`⚠️ DEBUG: TIMEOUT - Liberando bloqueo después de ${intentosAutoStartBloqueados} intentos`);
            // anunciarAdvertencia("⚠️ Timeout: Liberando bloqueo (8s)");
            liberarBloqueoReplay("Timeout de seguridad");
            // No retornar, continuar con la verificación normal
        } else {
            // Reintentar verificación en 1 segundo
            setTimeout(() => {
                verificarAutoStart();
            }, 1000);
            return;
        }
    }
    
    verificandoAutoStart = true;
    ultimaVerificacionAutoStart = ahora;
    
    console.log(`🔍 DEBUG verificarAutoStart: autoStartEnabled=${autoStartEnabled}, partidoEnCurso=${partidoEnCurso}, bloqueadoPorReplay=${bloqueadoPorReplay}`);
    
    if (!autoStartEnabled || partidoEnCurso) {
        console.log(`❌ DEBUG: Saliendo de verificarAutoStart - autoStart: ${autoStartEnabled}, partido: ${partidoEnCurso}`);
        verificandoAutoStart = false;
        return;
    }
    
    const jugadores = room.getPlayerList();
    const jugadoresRed = jugadores.filter(j => j.team === 1).length;
    const jugadoresBlue = jugadores.filter(j => j.team === 2).length;
    const totalJugadores = jugadoresRed + jugadoresBlue;
    
    console.log(`🔍 DEBUG equipos: Rojo=${jugadoresRed}, Azul=${jugadoresBlue}, Total=${totalJugadores}`);
    
    // Obtener mínimo de jugadores según el mapa actual
    const minJugadoresActual = mapas[mapaActual] ? mapas[mapaActual].minJugadores : 2;
    console.log(`🔍 DEBUG: minJugadores=${minJugadoresActual}, diferencia=${Math.abs(jugadoresRed - jugadoresBlue)}`);
    
    // Verificar si hay suficientes jugadores y equipos balanceados
    if (totalJugadores >= minJugadoresActual && Math.abs(jugadoresRed - jugadoresBlue) <= 1) {
        console.log(`✅ DEBUG: Condiciones cumplidas, configurando timeout...`);
        
        if (timeoutAutoStart) {
            clearTimeout(timeoutAutoStart);
        }
        
        timeoutAutoStart = setTimeout(() => {
            console.log(`⏰ DEBUG: Ejecutando timeout de autostart...`);
            
            // Verificar nuevamente antes de iniciar
            const jugadoresActuales = room.getPlayerList();
            const redActuales = jugadoresActuales.filter(j => j.team === 1).length;
            const blueActuales = jugadoresActuales.filter(j => j.team === 2).length;
            const totalActuales = redActuales + blueActuales;
            const minActual = mapas[mapaActual] ? mapas[mapaActual].minJugadores : 2;
            
            console.log(`🔍 DEBUG final: Rojo=${redActuales}, Azul=${blueActuales}, Total=${totalActuales}, partidoEnCurso=${partidoEnCurso}`);
            
            if (totalActuales >= minActual && Math.abs(redActuales - blueActuales) <= 1 && !partidoEnCurso) {
                console.log(`🚀 DEBUG: ¡Iniciando partido!`);
                anunciarGeneral(`🚀 ⭐ ¡INICIANDO PARTIDO AUTOMÁTICAMENTE! ⭐ 🚀`, "00FF00", "bold");
                room.startGame();
                // Resetear la variable para permitir el mensaje en el próximo partido
                mensajeAutoStartMostrado = false;
            } else {
                console.log(`❌ DEBUG: Condiciones no cumplidas en timeout final`);
                if (totalActuales < minActual) console.log(`❌ Pocos jugadores: ${totalActuales} < ${minActual}`);
                if (Math.abs(redActuales - blueActuales) > 1) console.log(`❌ Equipos desbalanceados: diferencia ${Math.abs(redActuales - blueActuales)}`);
                if (partidoEnCurso) console.log(`❌ Partido ya en curso`);
            }
        }, tiempoEsperaInicio);
        
        // Solo mostrar el mensaje una vez por intento de inicio
        if (!mensajeAutoStartMostrado) {
            // Mensaje removido para evitar spam
            mensajeAutoStartMostrado = true;
        }
    } else {
        console.log(`❌ DEBUG: Condiciones iniciales no cumplidas`);
        if (totalJugadores < minJugadoresActual) console.log(`❌ Pocos jugadores: ${totalJugadores} < ${minJugadoresActual}`);
        if (Math.abs(jugadoresRed - jugadoresBlue) > 1) console.log(`❌ Equipos desbalanceados: diferencia ${Math.abs(jugadoresRed - jugadoresBlue)}`);
        
        // Cancelar auto start si las condiciones no se cumplen
        if (timeoutAutoStart) {
            clearTimeout(timeoutAutoStart);
            timeoutAutoStart = null;
        }
        // Resetear la variable cuando las condiciones no se cumplen
        mensajeAutoStartMostrado = false;
    }
    
    // IMPORTANTE: Desactivar flag al final
    verificandoAutoStart = false;
}

// FUNCIÓN PARA MEZCLAR EQUIPOS AL FINAL DEL PARTIDO (SIN VERIFICAR AUTO START INMEDIATAMENTE)
function mezclarEquiposAleatoriamenteFinPartido() {
    // Activar la variable de control para evitar múltiples verificaciones
    mezclaProcesandose = true;
    
    const todosJugadores = room.getPlayerList().filter(j => !esBot(j)); // Excluir el bot
    
    // Solo considerar jugadores que están actualmente en equipos (no en espectadores/AFK)
    const jugadoresEnEquipos = todosJugadores.filter(j => j.team === 1 || j.team === 2);
    
    console.log(`🔄 DEBUG mezcla fin partido: ${jugadoresEnEquipos.length} jugadores en equipos de ${todosJugadores.length} totales`);
    
    if (jugadoresEnEquipos.length < 2) {
        anunciarInfo("⚠️ Se necesitan al menos 2 jugadores en equipos para mezclar");
        console.log(`❌ DEBUG mezcla fin partido: No hay suficientes jugadores (${jugadoresEnEquipos.length})`);
        mezclaProcesandose = false; // Desactivar control
        return;
    }
    
    // Paso 1: Mover SOLO a los jugadores que están en equipos a espectadores temporalmente
    anunciarGeneral("🔄 ⚡ MEZCLANDO EQUIPOS PARA PRÓXIMO PARTIDO... ⚡ 🔄", "FFD700", "bold");
    
    // Guardar los IDs de los jugadores que vamos a mezclar
    const idsJugadoresAMezclar = jugadoresEnEquipos.map(j => j.id);
    console.log(`📋 DEBUG mezcla fin partido: IDs a mezclar: [${idsJugadoresAMezclar.join(', ')}]`);
    
    jugadoresEnEquipos.forEach(jugador => {
        console.log(`➡️ DEBUG fin partido: Moviendo ${jugador.name} (ID: ${jugador.id}) a espectadores`);
        room.setPlayerTeam(jugador.id, 0);
    });
    
    // Paso 2: Esperar un momento y luego mezclar aleatoriamente SOLO a los que estaban en equipos
    setTimeout(() => {
        console.log(`⏰ DEBUG fin partido: Ejecutando mezcla después del timeout...`);
        
        // Obtener solo los jugadores que estaban en equipos antes de la mezcla
        const jugadoresParaMezclar = room.getPlayerList().filter(j => 
            !esBot(j) && idsJugadoresAMezclar.includes(j.id)
        );
        
        console.log(`👥 DEBUG mezcla fin partido: ${jugadoresParaMezclar.length} jugadores encontrados para mezclar`);
        jugadoresParaMezclar.forEach(j => {
            console.log(`  - ${j.name} (ID: ${j.id}, equipo actual: ${j.team})`);
        });
        
        if (jugadoresParaMezclar.length < 2) {
            anunciarInfo("⚠️ No hay suficientes jugadores para mezclar");
            console.log(`❌ DEBUG fin partido: No hay suficientes jugadores después del timeout`);
            mezclaProcesandose = false; // Desactivar control
            return;
        }
        
        // Crear una copia del array de jugadores y mezclarlo
        const jugadoresMezclados = [...jugadoresParaMezclar];
        
        // Algoritmo Fisher-Yates para mezclar aleatoriamente
        for (let i = jugadoresMezclados.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [jugadoresMezclados[i], jugadoresMezclados[j]] = [jugadoresMezclados[j], jugadoresMezclados[i]];
        }
        
        // Dividir los jugadores mezclados entre los dos equipos
        const mitad = Math.ceil(jugadoresMezclados.length / 2);
        console.log(`⚖️ DEBUG distribución fin partido: ${mitad} al rojo, ${jugadoresMezclados.length - mitad} al azul`);
        
        // Desactivar bloqueo de movimiento ANTES de asignar equipos
        const bloqueoAnterior = bloqueoMovimientoActivo;
        bloqueoMovimientoActivo = false;
        console.log(`🔓 DEBUG fin partido: Bloqueo desactivado temporalmente para mezcla`);
        
        // Asignar primera mitad al equipo rojo (1)
        for (let i = 0; i < mitad && i < jugadoresMezclados.length; i++) {
            console.log(`🔴 DEBUG fin partido: Asignando ${jugadoresMezclados[i].name} (ID: ${jugadoresMezclados[i].id}) al equipo ROJO`);
            room.setPlayerTeam(jugadoresMezclados[i].id, 1);
        }
        
        // Asignar segunda mitad al equipo azul (2)
        for (let i = mitad; i < jugadoresMezclados.length; i++) {
            console.log(`🔵 DEBUG fin partido: Asignando ${jugadoresMezclados[i].name} (ID: ${jugadoresMezclados[i].id}) al equipo AZUL`);
            room.setPlayerTeam(jugadoresMezclados[i].id, 2);
        }
        
        
        
        // Mostrar los equipos formados y verificar que se hicieron correctamente
        setTimeout(() => {
            console.log(`🔍 DEBUG fin partido: Verificando equipos después de 300ms...`);
            
            const jugadoresActualizados = room.getPlayerList();
            const equipoRojo = jugadoresActualizados.filter(j => j.team === 1);
            const equipoAzul = jugadoresActualizados.filter(j => j.team === 2);
            const espectadores = jugadoresActualizados.filter(j => j.team === 0);
            
            console.log(`✅ DEBUG equipos fin partido formados:`);
            console.log(`  🔴 Equipo Rojo (${equipoRojo.length}): ${equipoRojo.map(j => `${j.name}(${j.id})`).join(', ')}`);
            console.log(`  🔵 Equipo Azul (${equipoAzul.length}): ${equipoAzul.map(j => `${j.name}(${j.id})`).join(', ')}`);
            console.log(`  ⚪ Espectadores (${espectadores.length}): ${espectadores.map(j => `${j.name}(${j.id})`).join(', ')}`);
            
                // Verificar auto start después de formar equipos con delay adicional
                setTimeout(() => {
                    console.log(`🚀 DEBUG fin partido: Llamando a verificarAutoStart después de espera...`);
                    mezclaProcesandose = false; // Desactivar control ANTES de verificar auto start
                    
                    // CORRECCIÓN: Llamar múltiples veces a verificarAutoStart para asegurar que se ejecute
                    verificarAutoStart();
                    
                    // Llamada adicional después de 1 segundo para asegurar que el auto-start funcione
                    setTimeout(() => {
                        console.log(`🚀 DEBUG fin partido: Segunda llamada a verificarAutoStart...`);
                        verificarAutoStart();
                    }, 1000);
                    
                    // Tercera llamada como respaldo
                    setTimeout(() => {
                        console.log(`🚀 DEBUG fin partido: Tercera llamada a verificarAutoStart (respaldo)...`);
                        verificarAutoStart();
                    }, 2000);
                    
                }, 500); // Aumentado a 500ms para dar más tiempo
        }, 30); // Optimizado a 30ms
        
    }, 150); // Optimizado a 150ms
}

// FUNCIÓN PARA MEZCLAR EQUIPOS ALEATORIAMENTE
function mezclarEquiposAleatoriamente() {
    const todosJugadores = room.getPlayerList().filter(j => !esBot(j)); // Excluir el bot
    
    // Solo considerar jugadores que están actualmente en equipos (no en espectadores/AFK)
    const jugadoresEnEquipos = todosJugadores.filter(j => j.team === 1 || j.team === 2);
    
    console.log(`🔄 DEBUG mezcla: ${jugadoresEnEquipos.length} jugadores en equipos de ${todosJugadores.length} totales`);
    
    if (jugadoresEnEquipos.length < 2) {
        anunciarInfo("⚠️ Se necesitan al menos 2 jugadores en equipos para mezclar");
        console.log(`❌ DEBUG mezcla: No hay suficientes jugadores (${jugadoresEnEquipos.length})`);
        return;
    }
    
    // Paso 1: Mover SOLO a los jugadores que están en equipos a espectadores temporalmente
    anunciarGeneral("🔄 ⚡ MEZCLANDO EQUIPOS... ⚡ 🔄", "FFD700", "bold");
    
    // Guardar los IDs de los jugadores que vamos a mezclar
    const idsJugadoresAMezclar = jugadoresEnEquipos.map(j => j.id);
    console.log(`📋 DEBUG mezcla: IDs a mezclar: [${idsJugadoresAMezclar.join(', ')}]`);
    
    jugadoresEnEquipos.forEach(jugador => {
        console.log(`➡️ DEBUG: Moviendo ${jugador.name} (ID: ${jugador.id}) a espectadores`);
        room.setPlayerTeam(jugador.id, 0);
    });
    
    // Paso 2: Esperar un momento y luego mezclar aleatoriamente SOLO a los que estaban en equipos
    setTimeout(() => {
        console.log(`⏰ DEBUG: Ejecutando mezcla después del timeout...`);
        
        // Obtener solo los jugadores que estaban en equipos antes de la mezcla
        const jugadoresParaMezclar = room.getPlayerList().filter(j => 
            !esBot(j) && idsJugadoresAMezclar.includes(j.id)
        );
        
        console.log(`👥 DEBUG mezcla: ${jugadoresParaMezclar.length} jugadores encontrados para mezclar`);
        jugadoresParaMezclar.forEach(j => {
            console.log(`  - ${j.name} (ID: ${j.id}, equipo actual: ${j.team})`);
        });
        
        if (jugadoresParaMezclar.length < 2) {
            anunciarInfo("⚠️ No hay suficientes jugadores para mezclar");
            console.log(`❌ DEBUG: No hay suficientes jugadores después del timeout`);
            return;
        }
        
        // Crear una copia del array de jugadores y mezclarlo
        const jugadoresMezclados = [...jugadoresParaMezclar];
        
        // Algoritmo Fisher-Yates para mezclar aleatoriamente
        for (let i = jugadoresMezclados.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [jugadoresMezclados[i], jugadoresMezclados[j]] = [jugadoresMezclados[j], jugadoresMezclados[i]];
        }
        
        // Dividir los jugadores mezclados entre los dos equipos
        const mitad = Math.ceil(jugadoresMezclados.length / 2);
        console.log(`⚖️ DEBUG distribución: ${mitad} al rojo, ${jugadoresMezclados.length - mitad} al azul`);
        
        // Desactivar bloqueo de movimiento ANTES de asignar equipos
        const bloqueoAnterior = bloqueoMovimientoActivo;
        bloqueoMovimientoActivo = false;
        console.log(`🔓 DEBUG: Bloqueo desactivado temporalmente para mezcla`);
        
        // Asignar primera mitad al equipo rojo (1)
        for (let i = 0; i < mitad && i < jugadoresMezclados.length; i++) {
            console.log(`🔴 DEBUG: Asignando ${jugadoresMezclados[i].name} (ID: ${jugadoresMezclados[i].id}) al equipo ROJO`);
            room.setPlayerTeam(jugadoresMezclados[i].id, 1);
            
            // Verificar inmediatamente después de la asignación
            setTimeout(() => {
                const jugadorVerificar = room.getPlayerList().find(j => j.id === jugadoresMezclados[i].id);
                if (jugadorVerificar) {
                    console.log(`✅ DEBUG inmediato: ${jugadorVerificar.name} (ID: ${jugadorVerificar.id}) está en equipo ${jugadorVerificar.team}`);
                    if (jugadorVerificar.team !== 1) {
                        console.log(`❌ DEBUG ERROR: Jugador NO está en equipo rojo como se esperaba!`);
                    }
                } else {
                    console.log(`❌ DEBUG ERROR: Jugador ID ${jugadoresMezclados[i].id} no encontrado después de asignación`);
                }
            }, 50);
        }
        
        // Asignar segunda mitad al equipo azul (2)
        for (let i = mitad; i < jugadoresMezclados.length; i++) {
            console.log(`🔵 DEBUG: Asignando ${jugadoresMezclados[i].name} (ID: ${jugadoresMezclados[i].id}) al equipo AZUL`);
            room.setPlayerTeam(jugadoresMezclados[i].id, 2);
            
            // Verificar inmediatamente después de la asignación
            setTimeout(() => {
                const jugadorVerificar = room.getPlayerList().find(j => j.id === jugadoresMezclados[i].id);
                if (jugadorVerificar) {
                    console.log(`✅ DEBUG inmediato: ${jugadorVerificar.name} (ID: ${jugadorVerificar.id}) está en equipo ${jugadorVerificar.team}`);
                    if (jugadorVerificar.team !== 2) {
                        console.log(`❌ DEBUG ERROR: Jugador NO está en equipo azul como se esperaba!`);
                    }
                } else {
                    console.log(`❌ DEBUG ERROR: Jugador ID ${jugadoresMezclados[i].id} no encontrado después de asignación`);
                }
            }, 50);
        }
        
        // Activar bloqueo de movimiento después de mezclar (tiempo reducido)
        bloqueoMovimientoActivo = true;
        anunciarGeneral("🔒 Equipos bloqueados. Solo puedes usar !afk para salir o !back para volver", "FFA500", "bold");
        
        // Mensaje informativo sobre jugadores AFK
        const jugadoresAFK = todosJugadores.filter(j => j.team === 0 && !idsJugadoresAMezclar.includes(j.id));
        if (jugadoresAFK.length > 0) {
            anunciarInfo(`💤 Jugadores AFK mantienen su estado: ${jugadoresAFK.map(j => j.name).join(", ")}`);
        }
        
        // Mostrar los equipos formados y verificar que se hicieron correctamente
        setTimeout(() => {
            console.log(`🔍 DEBUG: Verificando equipos después de 500ms...`);
            
            const jugadoresActualizados = room.getPlayerList();
            console.log(`👥 DEBUG: ${jugadoresActualizados.length} jugadores conectados total`);
            jugadoresActualizados.forEach(j => {
                console.log(`  - ${j.name} (ID: ${j.id}, equipo: ${j.team})`);
            });
            
            const equipoRojo = jugadoresActualizados.filter(j => j.team === 1);
            const equipoAzul = jugadoresActualizados.filter(j => j.team === 2);
            const espectadores = jugadoresActualizados.filter(j => j.team === 0);
            
            console.log(`✅ DEBUG equipos formados:`);
            console.log(`  🔴 Equipo Rojo (${equipoRojo.length}): ${equipoRojo.map(j => `${j.name}(${j.id})`).join(', ')}`);
            console.log(`  🔵 Equipo Azul (${equipoAzul.length}): ${equipoAzul.map(j => `${j.name}(${j.id})`).join(', ')}`);
            console.log(`  ⚪ Espectadores (${espectadores.length}): ${espectadores.map(j => `${j.name}(${j.id})`).join(', ')}`);
            
            // Verificar si los IDs originales siguen conectados
            idsJugadoresAMezclar.forEach(id => {
                const jugadorActual = jugadoresActualizados.find(j => j.id === id);
                if (jugadorActual) {
                    console.log(`✅ DEBUG: Jugador ID ${id} (${jugadorActual.name}) sigue conectado en equipo ${jugadorActual.team}`);
                } else {
                    console.log(`❌ DEBUG: Jugador ID ${id} se desconectó después de la asignación`);
                }
            });
            
            // Desactivar bloqueo de movimiento después de formar equipos
            setTimeout(() => {
                if (bloqueoMovimientoActivo) {
                    bloqueoMovimientoActivo = false;
                    anunciarGeneral("🔓 Equipos formados. Bloqueo de movimiento desactivado", "00FF00", "normal");
                }
                
                // Verificar auto start después de desactivar bloqueo
                setTimeout(() => {
                    console.log(`🚀 DEBUG: Llamando a verificarAutoStart después de la mezcla...`);
                    verificarAutoStart();
                }, 200); // Reducir tiempo de espera
            }, 500); // Reducir tiempo de bloqueo
        }, 500);
        
    }, 500); // Esperar 0.5 segundos antes de mezclar
}

// FUNCIÓN PARA VERIFICAR AUTO STOP
function verificarAutoStop(jugadorDesconectado = null) {
    if (!autoStopEnabled || !partidoEnCurso) return;
    
    const jugadores = room.getPlayerList();
    const jugadoresRed = jugadores.filter(j => j.team === 1).length;
    const jugadoresBlue = jugadores.filter(j => j.team === 2).length;
    const totalJugadores = jugadoresRed + jugadoresBlue;
    
    // Parar partido si quedan muy pocos jugadores
    if (totalJugadores < 2 || jugadoresRed === 0 || jugadoresBlue === 0) {
        anunciarAdvertencia("⏹️ Auto parando partido por falta de jugadores...", null);
        room.stopGame();
    }
}

// MOVIMIENTO AUTOMÁTICO A ESPECTADORES POR INACTIVIDAD
function verificarInactividad() {
    const ahora = Date.now();
    const jugadoresConectados = room.getPlayerList();
    const numeroJugadores = jugadoresConectados.length;
    const salaLlena = numeroJugadores >= maxPlayers;

    const TIEMPO_AFK_KICK_SALA_LLENA = 5 * 60 * 1000; // 5 minutos
    const TIEMPO_AFK_KICK_MENOS_18 = 12 * 60 * 1000; // 12 minutos

    jugadoresConectados.forEach(jugador => {
        const infoAFK = jugadoresAFK.get(jugador.id);
        const stats = estadisticasPartido.jugadores[jugador.id];

        // Excluir arqueros del sistema AFK
        if (stats && stats.arquero) return;

        if (infoAFK && jugador.position) {
            const { ultimaActividad, posicionAnterior } = infoAFK;
            const dx = jugador.position.x - posicionAnterior.x;
            const dy = jugador.position.y - posicionAnterior.y;
            const distancia = Math.sqrt(dx * dx + dy * dy);

            if (distancia < MINIMO_MOVIMIENTO_AFK) {
                enviarAdvertenciaAFK(jugador);

                let tiempoParaAccion = null;
                let accion = null; // 'expulsar' o 'mover'
                let motivo = '';

                if (salaLlena) {
                    tiempoParaAccion = TIEMPO_AFK_KICK_SALA_LLENA;
                    accion = 'expulsar';
                    motivo = "Expulsado por inactividad (5 minutos en sala llena)";
                } else {
                    // Mover a espectadores por inactividad (tiempo más corto)
                    tiempoParaAccion = TIEMPO_AFK;
                    accion = 'mover';
                    motivo = "Movido a espectadores por inactividad";
                }

                if (ahora - ultimaActividad > tiempoParaAccion) {
                    if (accion === 'expulsar') {
                        room.kickPlayer(jugador.id, motivo, false);
                        anunciarAdvertencia(`🚫 ${jugador.name} fue expulsado. Motivo: ${motivo}`, null);
                    } else if (accion === 'mover') {
                        room.setPlayerTeam(jugador.id, 0);
                        anunciarAdvertencia(`${jugador.name} ha sido movido a espectadores por inactividad`, null);
                        
                        // Enviar mensaje privado al jugador explicando cómo volver
                        setTimeout(() => {
                            const jugadorActual = room.getPlayerList().find(j => j.id === jugador.id);
                            if (jugadorActual) {
                                room.sendAnnouncement(
                                    "💤 Has sido movido a espectadores por inactividad",
                                    jugador.id,
                                    parseInt("FFA500", 16),
                                    "bold",
                                    0
                                );
                                room.sendAnnouncement(
                                    "💡 COMANDOS ÚTILES:",
                                    jugador.id,
                                    parseInt("87CEEB", 16),
                                    "bold",
                                    0
                                );
                                room.sendAnnouncement(
                                    "🔙 !back - Para volver automáticamente a un equipo",
                                    jugador.id,
                                    parseInt("00FF00", 16),
                                    "normal",
                                    0
                                );
                                room.sendAnnouncement(
                                    "💤 !afk - Para ir a espectadores voluntariamente",
                                    jugador.id,
                                    parseInt("888888", 16),
                                    "normal",
                                    0
                                );
                                room.sendAnnouncement(
                                    "📋 !ayuda - Para ver todos los comandos disponibles",
                                    jugador.id,
                                    parseInt("87CEEB", 16),
                                    "normal",
                                    0
                                );
                            }
                        }, 1000);
                    }

                    jugadoresAFK.delete(jugador.id);
                    advertenciasAFK.delete(jugador.id);

                    setTimeout(() => {
                        autoBalanceEquipos();
                        verificarAutoStart();
                        verificarAutoStop(null);
                    }, 1000);
                }
            } else {
                jugadoresAFK.set(jugador.id, { ultimaActividad: ahora, posicionAnterior: { ...jugador.position } });
                advertenciasAFK.delete(jugador.id);
            }
        } else if (jugador.position) {
            jugadoresAFK.set(jugador.id, { ultimaActividad: ahora, posicionAnterior: { ...jugador.position } });
        }
    });
}

// Variable para controlar cambios de mapa múltiples
let cambioMapaEnProceso = false;
// Variable para detectar si el partido terminó por cambio de mapa
let terminoPorCambioMapa = false;
// Variables para controlar el spam de logs
let ultimoEstadoLogeado = {
    jugadores: -1,
    mapa: '',
    partido: false,
    timestamp: 0
};
const INTERVALO_LOG_THROTTLE = 60000; // Solo loguear cambios cada 60 segundos
// Control específico para el mensaje "Cambio de mapa ya en proceso"
let ultimoLogCambioEnProceso = 0;
const INTERVALO_LOG_CAMBIO_PROCESO = 120000; // Solo loguear "cambio en proceso" cada 2 minutos

// FUNCIÓN PARA DETECTAR CAMBIO DE MAPA
function detectarCambioMapa() {
    // Si ya hay un cambio de mapa en proceso, no ejecutar otro
    if (cambioMapaEnProceso) {
        const ahora = Date.now();
        if (ahora - ultimoLogCambioEnProceso > INTERVALO_LOG_CAMBIO_PROCESO) {
            console.log("🔄 DEBUG: Cambio de mapa ya en proceso, saltando...");
            ultimoLogCambioEnProceso = ahora;
        }
        return;
    }
    
    // Si el mapa inicial no se ha aplicado correctamente, forzar la aplicación
    if (!mapaRealmenteAplicado) {
        console.log(`🔧 DEBUG: Mapa inicial no aplicado correctamente, forzando aplicación de ${mapaActual}`);
        if (cambiarMapa(mapaActual)) {
            mapaRealmenteAplicado = true;
            console.log(`✅ DEBUG: Mapa inicial aplicado correctamente: ${mapaActual}`);
        } else {
            console.error(`❌ DEBUG: Error al aplicar mapa inicial: ${mapaActual}`);
        }
        return;
    }
    
    // Contar SOLO jugadores activos (en equipos 1 y 2, no espectadores)
    const jugadoresActivos = room.getPlayerList().filter(j => j.team === 1 || j.team === 2).length;
    
const ahora = Date.now();
if (ahora - ultimoEstadoLogeado.timestamp > INTERVALO_LOG_THROTTLE || jugadoresActivos !== ultimoEstadoLogeado.jugadores || mapaActual !== ultimoEstadoLogeado.mapa || partidoEnCurso !== ultimoEstadoLogeado.partido) {
    console.log(`🔍 DEBUG detectarCambioMapa: ${jugadoresActivos} jugadores activos, mapa actual: ${mapaActual}, partido en curso: ${partidoEnCurso}`);
    ultimoEstadoLogeado = {
        jugadores: jugadoresActivos,
        mapa: mapaActual,
        partido: partidoEnCurso,
        timestamp: ahora
    };
}

    // Durante partidos, cambiar mapas tanto a menores (si bajan jugadores) como a mayores (si suben jugadores)
    if (partidoEnCurso) {
        console.log(`⚽ DEBUG: Partido en curso, verificando cambios de mapa necesarios...`);
        
        // CAMBIOS A MAPAS MENORES (cuando bajan jugadores)
        // Cambiar de biggerx7 a biggerx5 si hay menos de 10 jugadores
        if (mapaActual === "biggerx7" && jugadoresActivos < 10) {
            cambioMapaEnProceso = true;
            terminoPorCambioMapa = true; // Marcar que el partido terminará por cambio de mapa
            console.log(`📉 DEBUG: Cambiando de x7 a x5 (${jugadoresActivos} < 10)`);
            anunciarAdvertencia("⏹️ Deteniendo partido para cambio de mapa...");
            room.stopGame();
            cambiarMapa("biggerx5");
            anunciarInfo(`🔄 Menos de 10 jugadores durante partido (${jugadoresActivos}). Cambiando de x7 a x5...`);
            
            setTimeout(() => {
                autoBalanceEquipos();
                verificarAutoStart();
                setTimeout(() => { 
                    cambioMapaEnProceso = false;
                    terminoPorCambioMapa = false; // Resetear la bandera
                }, 5000);
            }, 1000);
            return;
        }
        
        // Cambiar de biggerx5 a biggerx3 si hay menos de 6 jugadores
        if (mapaActual === "biggerx5" && jugadoresActivos < 6) {
            cambioMapaEnProceso = true;
            terminoPorCambioMapa = true; // Marcar que el partido terminará por cambio de mapa
            console.log(`📉 DEBUG: Cambiando de x5 a x3 (${jugadoresActivos} < 6)`);
            anunciarAdvertencia("⏹️ Deteniendo partido para cambio de mapa...");
            room.stopGame();
            cambiarMapa("biggerx3");
            anunciarInfo(`🔄 Menos de 6 jugadores durante partido (${jugadoresActivos}). Cambiando de x5 a x3...`);
            
            setTimeout(() => {
                autoBalanceEquipos();
                verificarAutoStart();
                setTimeout(() => { 
                    cambioMapaEnProceso = false;
                    terminoPorCambioMapa = false; // Resetear la bandera
                }, 5000);
            }, 1000);
            return;
        }
        
        // Cambiar de biggerx3 a biggerx1 si hay menos de 3 jugadores
        if (mapaActual === "biggerx3" && jugadoresActivos < 3) {
            cambioMapaEnProceso = true;
            terminoPorCambioMapa = true; // Marcar que el partido terminará por cambio de mapa
            console.log(`📉 DEBUG: Cambiando de x3 a x1 (${jugadoresActivos} < 3)`);
            anunciarAdvertencia("⏹️ Deteniendo partido para cambio de mapa...");
            room.stopGame();
            cambiarMapa("biggerx1");
            anunciarInfo(`🔄 Menos de 3 jugadores durante partido (${jugadoresActivos}). Cambiando de x3 a x1...`);
            
            setTimeout(() => {
                autoBalanceEquipos();
                verificarAutoStart();
                setTimeout(() => { 
                    cambioMapaEnProceso = false;
                    terminoPorCambioMapa = false; // Resetear la bandera
                }, 5000);
            }, 1000);
            return;
        }
        
        // CAMBIOS A MAPAS MAYORES (cuando suben jugadores)
        // Cambiar de biggerx1 a biggerx3 si hay 5 o más jugadores
        if (mapaActual === "biggerx1" && jugadoresActivos >= 5) {
            cambioMapaEnProceso = true;
            terminoPorCambioMapa = true; // Marcar que el partido terminará por cambio de mapa
            console.log(`📈 DEBUG: Cambiando de x1 a x3 durante partido (${jugadoresActivos} >= 5)`);
            anunciarAdvertencia("⏹️ Deteniendo partido para cambio de mapa...");
            room.stopGame();
            cambiarMapa("biggerx3");
            anunciarInfo(`🔄 ${jugadoresActivos} jugadores detectados durante partido. Cambiando de x1 a x3...`);
            
            setTimeout(() => {
                autoBalanceEquipos();
                verificarAutoStart();
                setTimeout(() => { 
                    cambioMapaEnProceso = false;
                    terminoPorCambioMapa = false; // Resetear la bandera
                }, 5000);
            }, 1000);
            return;
        }
        
        // Cambiar de biggerx3 a biggerx5 si hay 9 o más jugadores
        if (mapaActual === "biggerx3" && jugadoresActivos >= 9) {
            cambioMapaEnProceso = true;
            terminoPorCambioMapa = true; // Marcar que el partido terminará por cambio de mapa
            console.log(`📈 DEBUG: Cambiando de x3 a x5 durante partido (${jugadoresActivos} >= 9)`);
            anunciarAdvertencia("⏹️ Deteniendo partido para cambio de mapa...");
            room.stopGame();
            cambiarMapa("biggerx5");
            anunciarInfo(`🔄 ${jugadoresActivos} jugadores detectados durante partido. Cambiando de x3 a x5...`);
            
            setTimeout(() => {
                autoBalanceEquipos();
                verificarAutoStart();
                setTimeout(() => { 
                    cambioMapaEnProceso = false;
                    terminoPorCambioMapa = false; // Resetear la bandera
                }, 5000);
            }, 1000);
            return;
        }
        
        // Cambiar de biggerx5 a biggerx7 si hay 12 o más jugadores
        // MODIFICADO: NO detener partido en x5, solo notificar que esperará al final
        if (mapaActual === "biggerx5" && jugadoresActivos >= 12) {
            console.log(`📈 DEBUG: Detectados ${jugadoresActivos} jugadores en x5, pero NO deteniendo partido`);
            anunciarInfo(`🔄 ${jugadoresActivos} jugadores detectados. El mapa cambiará a x7 al finalizar este partido.`);
            // NO detenemos el partido, solo notificamos
            return;
        }
        
        console.log(`✅ DEBUG: No se necesita cambio de mapa durante partido (${jugadoresActivos} jugadores en ${mapaActual})`);
        return;
    }
    
    // FUERA DE PARTIDO: Cambiar mapas según cantidad de jugadores
    console.log(`🔄 DEBUG: Fuera de partido, verificando cambio de mapa necesario...`);
    
    // LÓGICA ACTUALIZADA DE CAMBIO DE MAPA:
    // 0-4 jugadores: biggerx1
    // 5-9 jugadores: biggerx3  
    // 10-11 jugadores: biggerx5
    // 12+ jugadores: biggerx7
    
    let mapaRequerido = null;
    
    if (jugadoresActivos <= 4) {
        mapaRequerido = "biggerx1";
    } else if (jugadoresActivos >= 5 && jugadoresActivos <= 7) {
        mapaRequerido = "biggerx3";
    } else if (jugadoresActivos >= 8 && jugadoresActivos <= 11) {
        mapaRequerido = "biggerx5";
    } else if (jugadoresActivos >= 12) {
        mapaRequerido = "biggerx7";
    }
    
    console.log(`🔍 DEBUG DETALLADO: Jugadores activos: ${jugadoresActivos}, Mapa actual: ${mapaActual}, Mapa requerido: ${mapaRequerido}, Cambio en proceso: ${cambioMapaEnProceso}`);
    
    // Forzar cambio si el mapa actual no coincide con el requerido
    if (mapaRequerido && mapaRequerido !== mapaActual) {
        console.log(`⚡ FORZANDO CAMBIO: De ${mapaActual} a ${mapaRequerido} con ${jugadoresActivos} jugadores`);
    }
    
    console.log(`🔍 DEBUG: Jugadores=${jugadoresActivos}, MapaActual=${mapaActual}, MapaRequerido=${mapaRequerido}`);
    
    if (mapaRequerido && mapaRequerido !== mapaActual) {
        console.log(`📈 DEBUG: Cambiando de ${mapaActual} a ${mapaRequerido} (${jugadoresActivos} jugadores)`);
        console.log(`🔧 DEBUG: Iniciando cambio de mapa OBLIGATORIO`);
        console.log(`🔧 DEBUG: - Mapa origen: ${mapaActual}`);
        console.log(`🔧 DEBUG: - Mapa destino: ${mapaRequerido}`);
        console.log(`🔧 DEBUG: - Jugadores activos: ${jugadoresActivos}`);
        console.log(`🔧 DEBUG: - Cambio en proceso: ${cambioMapaEnProceso}`);
        
        cambioMapaEnProceso = true;
        
        if (cambiarMapa(mapaRequerido)) {
            const nombreMapa = mapas[mapaRequerido] ? mapas[mapaRequerido].nombre : mapaRequerido;
            console.log(`✅ DEBUG: Cambio de mapa EXITOSO: ${mapaActual} -> ${mapaRequerido}`);
            anunciarInfo(`🔄 ${jugadoresActivos} jugadores detectados. Cambiando a ${nombreMapa}...`);
            
            setTimeout(() => {
                autoBalanceEquipos();
                verificarAutoStart();
                setTimeout(() => { 
                    cambioMapaEnProceso = false;
                    console.log(`🔓 DEBUG: cambioMapaEnProceso = false`);
                }, 3000);
            }, 1000);
        } else {
            console.error(`❌ DEBUG: Error al cambiar mapa a ${mapaRequerido}`);
            cambioMapaEnProceso = false;
        }
    } else {
        console.log(`✅ DEBUG: No se necesita cambio de mapa (${jugadoresActivos} jugadores, mapa actual: ${mapaActual})`);
        if (!mapaRequerido) {
            console.log(`⚠️ DEBUG: mapaRequerido es null/undefined`);
        }
        if (mapaRequerido === mapaActual) {
            console.log(`ℹ️ DEBUG: El mapa requerido (${mapaRequerido}) ya es el mapa actual (${mapaActual})`);
        }
    }
}

// FUNCIÓN PARA CAMBIAR MAPA
function cambiarMapa(codigoMapa) {
    if (mapas[codigoMapa]) {
        const mapa = mapas[codigoMapa];
        try {
            room.setCustomStadium(mapa.hbs);
            mapaActual = codigoMapa;
            mapaRealmenteAplicado = true; // Confirmar que se aplicó correctamente
            console.log(`🗺️ DEBUG: Mapa cambiado exitosamente a ${codigoMapa} (${mapa.nombre})`);
            
            // Configurar límites estándar para todos los mapas
            if (codigoMapa === "biggerx1") {
                room.setTimeLimit(duracionPartido); // 3 minutos
                room.setScoreLimit(scoreLimitPartido); // 3 goles
            } else if (codigoMapa === "biggerx3") {
                room.setTimeLimit(4); // 3 minutos
                room.setScoreLimit(5); // Máximo 5 goles
            } else if (codigoMapa === "biggerx5") {
                room.setTimeLimit(5); // 5 minutos
                room.setScoreLimit(4); // Máximo 4 goles
            } else if (codigoMapa === "biggerx7") {
                room.setTimeLimit(5); // 5 minutos
                room.setScoreLimit(5); // Máximo 5 goles
            } else {
                room.setTimeLimit(5); // 5 minutos
                room.setScoreLimit(0); // Sin límite de goles
            }
            
            anunciarExito(`🗺️ Mapa cambiado a: ${mapa.nombre}`);
            return true;
        } catch (error) {
            console.error(`❌ Error al cambiar mapa a ${codigoMapa}:`, error);
            return false;
        }
    } else {
        console.error(`❌ Mapa '${codigoMapa}' no encontrado en la lista de mapas`);
    }
    return false;
}

// FUNCIÓN PARA VALIDAR MAPA PERSONALIZADO
function validarMapaPersonalizado() {
    const mapasOficiales = Object.keys(mapas);
    if (!mapasOficiales.includes(mapaActual)) {
        anunciarAdvertencia("⚠️ Mapa personalizado detectado. Estadísticas desactivadas para evitar datos inconsistentes.");
        return false;
    }
    return true;
}

// FUNCION PARA ENVIAR ADVERTENCIA
function enviarAdvertenciaAFK(jugador) {
    if (!advertenciasAFK.has(jugador.id)) {
        advertenciasAFK.set(jugador.id, { nivel: 0, timestamp: Date.now() });
    }

    const advertencia = advertenciasAFK.get(jugador.id);
    const ahora = Date.now();

    if (advertencia.nivel < 2 && ahora - advertencia.timestamp >= 5000) {
        advertencia.nivel++;
        advertencia.timestamp = ahora;

        if (advertencia.nivel === 1) {
anunciarAdvertencia(`${jugador.name}, serás movido a espectadores en 10 segundos si no te mueves.`, jugador);
        } else if (advertencia.nivel === 2) {
anunciarAdvertencia(`${jugador.name}, serás movido a espectadores en 5 segundos. ¡MUÉVETE!`, jugador);
        }
    }
}

// INICIAR VERIFICACIÓN DE INACTIVIDAD se moverá a la función inicializar()


// ANUNCIAR DISCORD CADA 10 MINUTOS
let intervalDiscord = null;
function iniciarAnunciosDiscord() {
    if (intervalDiscord) clearInterval(intervalDiscord);
    intervalDiscord = setInterval(() => {
        try {
            if (typeof room !== 'undefined' && room && room.sendAnnouncement) {
                room.sendAnnouncement("━━━━━━━━━━━━━┓ LNB 🔥 Discord: 'discord.gg/nJRhZXRNCA' ┏━━━━━━━━━━━━━", null, parseInt(CELESTE_LNB, 16), "bold", 0);
            }
        } catch (error) {
            // Error en anuncio de Discord
        }
    }, 600000); // 10 minutos
}

// FUNCIONES DE COMANDOS
function mostrarAyuda(jugador, contexto) {
const comandosPublicos = [];

    const comandosMovimiento = [
        "\n🏃 Sala / Movimiento:",
        "!back !afk !nv !bb !llamaradmin [msg]",
        "\n🎨 Camisetas:",
        "!tbl, !dd, !dd2, !hyz, !hyz2, !fnv, !fnv2, !avh, !avh2, !avh3, !lmdt, !lmdt2, !adb, !adb2, !adb3, !do, !do1, !do2."
    ];

    const comandosPersonalizacion = [
        "\n🎨 Personalización:",
        "!colors [código] !colors list !festejo gol/asis [msg]",
        "!ver_mensajes !limpiar_mensajes"
    ];

    const comandosSala = [
        "\n🏟️ COMANDOS DE INFORMACIÓN DE SALA:",
        "!mapa - Ver información del mapa actual",
        "!tiempo - Ver tiempo transcurrido del partido", 
        "!puntuacion - Ver tu puntuación en el partido actual (1-10)",
        "\n💬 COMANDOS DE CHAT:",
        "t [mensaje] - Enviar mensaje al chat de equipo",
        "@@[jugador] [mensaje] - Enviar mensaje privado",
        "\n📱 SISTEMA ANTI-SPAM:",
        "- Máximo 3 mensajes cada 5 segundos",
        "- Cooldown automático por spam excesivo",
        "- Mensajes duplicados filtrados"
    ];

    const comandosModeracion = [
        "\n⚖️ COMANDOS DE MODERACIÓN (ADMINS):",
        "!warn [jugador] [razón] - Advertir a un jugador (3 warns = kick)",
        "!mute [jugador] [tiempo_min] [razón] - Silenciar jugador temporalmente",
        "!unmute [jugador] - Quitar silencio a un jugador", 
        "!kick [jugador] [razón] - Expulsar jugador de la sala",
        "!ban [jugador] [tiempo_min] [razón] - Banear jugador",
        "!unban [uid/nombre/ip] - Desbanear jugador",
        "!banlist - Ver lista de jugadores baneados activos",
        "!clearbans - Limpiar todos los baneos masivamente",
        "!clear_bans - Limpiar lista de baneos de HaxBall",
        "\n🔍 COMANDOS DE DEBUG (SUPER ADMIN):",
        "!debug_unban [uid] - Probar métodos de desbaneo con info detallada"
    ];


    const comandosAvanzado = [
        "\n⚙️ COMANDOS AVANZADOS (ADMINS):",
        "!claim [contraseña] - Reclamar rol de administrador",
        "!mapa [código] - Cambiar mapa (biggerx3, biggerx5, biggerx7, training)",
        "!biggerx3 / !3 - Cambiar a mapa Bigger x3",
        "!biggerx5 / !5 - Cambiar a mapa Bigger x5",
        "!biggerx7 / !7 - Cambiar a mapa Bigger x7",
        "!training / !tr - Cambiar a mapa de entrenamiento",
        "!pw [contraseña] - Establecer contraseña de sala",
        "!clear_password - Eliminar contraseña de sala",
        "!pause - Pausar partido",
        "!resume - Reanudar partido",
        "!stop - Detener partido manualmente",
        "!autostart - Activar/desactivar inicio automático",
        "!autostop - Activar/desactivar parada automática",
        "!balance - Balancear equipos manualmente",
        "!replay_config - Ver configuración de replays",
        "!toggle_replays [tipo] - Activar/desactivar tipos de replays"
    ];

    const comandosChat = [
        "\n💬 COMANDOS DE CHAT:",
        "t [mensaje] - Chat de equipo",
        "@@[jugador] [mensaje] - Mensaje privado",
        "Explicación del sistema anti-spam"
    ];

    const comandosStats = [
        "\n📊 Estadísticas:",
        "!stats [jugador], !me, !record, !compare <jugador1> <jugador2>, !h2h, !top [estadística], !codigo, !recuperar <código>, !puntuacion ."
    ];

    const comandosFun = [
        "\n🎲 Fun:",
        "!coin !random [n] !ship !ppt [opc] [jugador] !cm !nenazo !nov"
    ];
    
    const comandosAdmin = [
        "\n🔧 COMANDOS DE ADMIN:",
        "!claim <clave> - Reclamar rol (admin/superadmin)",
        "!pw <contraseña> - Establecer contraseña de sala",
        "!clear_password - Eliminar contraseña de sala",
        "!warn <jugador> [razón] - Advertir jugador",
        "!mute <jugador> [tiempo] [razón] - Silenciar (superadmin)",
        "!kick <jugador> [razón] - Expulsar (superadmin)",
        "!ban <jugador> [tiempo] [razón] - Banear (superadmin)"
    ];
    
    const comandosRedes = [
        "\n🌐 COMANDOS DE REDES SOCIALES:",
        "!discord / !ds - Ver enlace del servidor de Discord",
        "!instagram / !ig - Ver enlace de Instagram oficial",
        "!youtube / !yt - Ver enlace del canal de YouTube",
        "!tiktok / !tt - Ver enlace de TikTok oficial"
    ];

    let output = [];
    switch (contexto) {
        case 'admin':
            output = comandosAdmin;
            break;
        case 'stats':
            output = comandosStats;
            break;
        case 'fun':
            output = comandosFun;
            break;
        case 'movimiento':
            output = comandosMovimiento;
            break;
        case 'personalizacion':
            output = comandosPersonalizacion;
            break;
        case 'moderacion':
            output = comandosModeracion;
            break;
        case 'avanzado':
            output = comandosAvanzado;
            break;
        case 'chat':
            output = comandosChat;
            break;
        case 'redes':
            output = comandosRedes;
            break;
        default:
            output = [
                ...comandosPublicos,
                "\n💡 Usa !ayuda stats, !ayuda fun, !ayuda admin, !ayuda movimiento, !ayuda personalizacion, !ayuda moderacion, !ayuda avanzado, !ayuda chat, o !ayuda redes para más comandos."
            ];
    }
    
    output.forEach(cmd => {
        room.sendAnnouncement(cmd, jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
    });
}

async function procesarComando(jugador, mensaje) {
    const args = mensaje.slice(1).split(" ");
    const comando = args[0].toLowerCase();
    
    switch (comando) {
        case "ship":
            if (args[1]) {
                const nombreObjetivo = args.slice(1).join(" ");
                calcularCompatibilidad(jugador, nombreObjetivo);
            } else {
anunciarError("Uso: !ship <jugador>", jugador);
            }
            break;
            
        case "ppt":
            if (args[1] && args[2]) {
                const jugada = args[1].toLowerCase();
                const nombreOponente = args.slice(2).join(" ");
                if (["piedra", "papel", "tijeras"].includes(jugada)) {
                    desafiarPPT(jugador, nombreOponente, jugada);
                } else {
anunciarError("Uso: !ppt <piedra|papel|tijeras> <jugador>", jugador);
                }
            } else {
                anunciarError("📝 Uso: !ppt <piedra|papel|tijeras> <jugador>", jugador);
            }
            break;
            
        case "piedra":
        case "papel":
        case "tijeras":
            responderDesafioPPT(jugador, comando);
            break;
case "ayuda":
        case "help":
            mostrarAyuda(jugador, args[1]);
            break;
            
        case "ds":
        case "discord":
            room.sendAnnouncement("━━━━━━━━━━━━━┓ LNB 🔥 Discord: 'discord.gg/nJRhZXRNCA' ┏━━━━━━━━━━━━━", jugador.id, parseInt(COLORES.INFO, 16), "bold", 0);
            room.sendAnnouncement("¡Únete a la comunidad para enterarte de torneos, eventos y mucho más!", jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
            break;
            
case "mapa":
            if (!esAdmin(jugador)) {
                anunciarError("❌ Solo los administradores pueden cambiar el mapa.", jugador);
                return;
            }
            if (args[1]) {
                if (cambiarMapa(args[1])) {
                    detectarCambioMapa();
                } else {
                    anunciarError("Mapa no encontrado. Usa: biggerx3, biggerx5, biggerx7, training", jugador);
                }
            } else {
                anunciarInfo("📋 Uso: !mapa <código> (biggerx3, biggerx5, biggerx7, training)");
            }
            break;
            
        case "biggerx3":
        case "3": // Abreviación para biggerx3
            if (!esAdminBasico(jugador)) {
                anunciarError("❌ Solo los administradores pueden cambiar el mapa.", jugador);
                return;
            }
            cambiarMapa("biggerx3");
            detectarCambioMapa();
            break;
            
        case "biggerx5":
        case "5": // Abreviación para biggerx5
            if (!esAdminBasico(jugador)) {
                anunciarError("❌ Solo los administradores pueden cambiar el mapa.", jugador);
                return;
            }
            cambiarMapa("biggerx5");
            detectarCambioMapa();
            break;
            
        case "biggerx7":
        case "7": // Abreviación para biggerx7
            if (!esAdminBasico(jugador)) {
                anunciarError("❌ Solo los administradores pueden cambiar el mapa.", jugador);
                return;
            }
            cambiarMapa("biggerx7");
            detectarCambioMapa();
            break;
            
        case "training":
        case "tr": // Abreviación para training
            if (!esAdminBasico(jugador)) {
                anunciarError("❌ Solo los administradores pueden cambiar el mapa.", jugador);
                return;
            }
            cambiarMapa("training");
            break;
            
        case "colors":
        case "camis":
            if (args[1] === "list") {
                mostrarColores(jugador);
            } else if (args[1]) {
                // Verificar que el jugador esté en un equipo
                if (jugador.team === 0) {
                    anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                    return;
                }
                
                // Detectar automáticamente el equipo del jugador
                const equipoTexto = jugador.team === 1 ? "red" : "blue";
                const codigoCamiseta = args[1];
                
                asignarColor(equipoTexto, codigoCamiseta, jugador);
            } else {
                const comandoUsado = comando === "colors" ? "!colors" : "!camis";
                anunciarError(`📋 Uso: ${comandoUsado} <código> | ${comandoUsado} list`, jugador);
                anunciarError(`💡 Ejemplo: ${comandoUsado} dd | ${comandoUsado} bov | ${comandoUsado} realMadrid`, jugador);
            }
            break;
            
        // Comandos específicos de camisetas personalizadas
        case "tbl":
            // !camis TBL -> /colors red 60 000000 363636 303030
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoTBL = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoTBL, "tbl", jugador);
            break;
            
        case "dd2":
            // !camis dd2 -> /colors blue 0 FFFFFF FFFFFF 1F3821 FFFFFF
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoDD2 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoDD2, "dd2", jugador);
            break;
            
        case "hyz":
            // !camis hyz -> /colors red 60 4D4D4D 000000 000000 000000
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoHYZ = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoHYZ, "hyz", jugador);
            break;
            
        case "hyz2":
            // !camis hyz2 -> /colors red 60 26C5FF 801296 801296 26C5FF
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoHYZ2 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoHYZ2, "hyz2", jugador);
            break;
            
        case "fnv":
            // !camis fnv -> /colors red 60 000000 F8842B F8842B E86B27
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoFNV = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoFNV, "fnv", jugador);
            break;
            
        case "fnv2":
            // !camis fnv2 -> /colors blue 60 000000 F8842B F8842B E86B27
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoFNV2 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoFNV2, "fnv2", jugador);
            break;
            
        case "avh":
            // !camis avh -> /colors red 60 A4A800 000029 000221 00001C
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoAVH = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoAVH, "avh", jugador);
            break;
            
        case "avh2":
            // !camis avh2 -> /colors red 180 39373B 949E9C 8D9695 868F8E
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoAVH2 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoAVH2, "avh2", jugador);
            break;
            
        case "avh3":
            // !camis avh3 -> /colors red 66 FFCBA3 3B0047 54084A 690942
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoAVH3 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoAVH3, "avh3", jugador);
            break;
            
        case "lmdt":
            // !camis lmdt -> /colors red 120 FADB69 090A0E
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoLMDT = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoLMDT, "lmdt", jugador);
            break;
            
        case "lmdt2":
            // !camis lmdt2 -> /colors red 120 090A0E FADB69
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoLMDT2 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoLMDT2, "lmdt2", jugador);
            break;
            
        case "adb2":
            // !camis adb2 -> /colors red 90 C70C0C 1E7315 FFFFFF 000000
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoADB2 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoADB2, "adb2", jugador);
            break;
            
        case "adb3":
            // !camis adb3 -> /colors red 66 A35417 FF3BF2 4FFF72 4EA2F5
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
                return;
            }
            // Detectar automáticamente el equipo del jugador
            const equipoTextoADB3 = jugador.team === 1 ? "red" : "blue";
            asignarColor(equipoTextoADB3, "adb3", jugador);
            break;
            
            
            
        case "festejo":
            if (args.length === 1) {
                room.sendAnnouncement("📢 Uso: !festejo gol [mensaje] | !festejo asis [mensaje]", jugador.id, parseInt(AZUL_LNB, 16), "bold", 0);
                room.sendAnnouncement("💡 Sin argumentos muestra tu mensaje actual", jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
                return;
            }
            
            const tipoFestejo = args[1].toLowerCase();
            const mensajeArgs = args.slice(2);
            
            if (tipoFestejo === 'gol') {
                if (mensajeArgs.length === 0) {
                    const mensajeActual = mensajesPersonalizados.has(jugador.id) && mensajesPersonalizados.get(jugador.id).gol 
                        ? mensajesPersonalizados.get(jugador.id).gol 
                        : "¡GOOOOOL!";
                    room.sendAnnouncement(`🎯 Tu mensaje de gol actual: "${mensajeActual}"`, jugador.id, parseInt(AZUL_LNB, 16), "bold", 0);
                } else {
                    const mensaje = mensajeArgs.join(' ');
                    if (mensaje.length > 50) {
                        anunciarError("❌ El mensaje de gol no puede superar los 50 caracteres", jugador);
                        return;
                    }
                    if (!mensajesPersonalizados.has(jugador.id)) {
                        mensajesPersonalizados.set(jugador.id, {});
                    }
                    const msgs = mensajesPersonalizados.get(jugador.id);
                    msgs.gol = mensaje;
                    msgs.ultimoUso = Date.now();
                    room.sendAnnouncement(`⚽ Mensaje de gol configurado: "${mensaje}"`, jugador.id, parseInt("00FF00", 16), "bold", 0);
                }
            } else if (tipoFestejo === 'asis' || tipoFestejo === 'asistencia') {
                if (mensajeArgs.length === 0) {
                    const mensajeActual = mensajesPersonalizados.has(jugador.id) && mensajesPersonalizados.get(jugador.id).asistencia 
                        ? mensajesPersonalizados.get(jugador.id).asistencia 
                        : "¡Qué asistencia!";
                    room.sendAnnouncement(`🎯 Tu mensaje de asistencia actual: "${mensajeActual}"`, jugador.id, parseInt(AZUL_LNB, 16), "bold", 0);
                } else {
                    const mensaje = mensajeArgs.join(' ');
                    if (mensaje.length > 50) {
                        anunciarError("❌ El mensaje de asistencia no puede superar los 50 caracteres", jugador);
                        return;
                    }
                    if (!mensajesPersonalizados.has(jugador.id)) {
                        mensajesPersonalizados.set(jugador.id, {});
                    }
                    const msgs = mensajesPersonalizados.get(jugador.id);
                    msgs.asistencia = mensaje;
                    msgs.ultimoUso = Date.now();
                    room.sendAnnouncement(`🎯 Mensaje de asistencia configurado: "${mensaje}"`, jugador.id, parseInt("00FF00", 16), "bold", 0);
                }
            } else {
                anunciarError("❌ Tipo de festejo inválido. Usa: gol o asis", jugador);
            }
            break;
            
        case "ver_mensajes":
            const misMessagess = mensajesPersonalizados.get(jugador.id);
            if (misMessagess) {
                const msgGol = misMessagess.gol || "No configurado";
                const msgAsist = misMessagess.asistencia || "No configurado";
                room.sendAnnouncement(`⚽ Mensaje de gol: "${msgGol}"`, jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
                room.sendAnnouncement(`🎯 Mensaje de asistencia: "${msgAsist}"`, jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
            } else {
                room.sendAnnouncement("❌ No tienes mensajes personalizados configurados", jugador.id, parseInt("FF0000", 16), "normal", 0);
            }
            break;
            
        case "limpiar_mensajes":
            mensajesPersonalizados.delete(jugador.id);
            anunciarExito("🧹 Mensajes personalizados eliminados");
            break;
            
        case "ship":
            if (args[1]) {
                const nombreObjetivo = args.slice(1).join(" ");
                calcularCompatibilidad(jugador, nombreObjetivo);
            } else {
                anunciarError("📝 Uso: !ship <jugador>", jugador);
            }
            break;
            
        case "llamaradmin":
            if (args[1]) {
                const mensaje = args.slice(1).join(" ");
                llamarAdmin(jugador, mensaje);
            } else {
                // Si no hay mensaje, verificar si hay votación activa para votar
                if (votacionLlamarAdmin.activa) {
                    llamarAdmin(jugador, ""); // Llamar sin mensaje para procesar el voto
                } else {
                anunciarError("📝 Uso: !llamaradmin <mensaje>", jugador);
                }
            }
            break;
            
        case "me":
            mostrarEstadisticasJugador(jugador, jugador.name);
            break;
            
        case "compare":
            if (args[1] && args[2]) {
                compararEstadisticas(jugador, args[1], args[2]);
            } else {
                anunciarError("📝 Uso: !compare <jugador1> <jugador2>", jugador);
            }
            break;
            
        case "h2h":
        case "headtohead":
            if (args[1] && args[2]) {
                mostrarHeadToHead(jugador, args[1], args[2]);
            } else if (args[1]) {
                // Si solo se proporciona un jugador, comparar con el solicitante
                mostrarHeadToHead(jugador, jugador.name, args[1]);
            } else {
                anunciarError("📝 Uso: !h2h <jugador1> <jugador2> o !h2h <jugador> (para comparar contigo)", jugador);
            }
            break;

        case "coin":
            const resultado = Math.random() > 0.5 ? "Cara" : "Cruz";
            anunciarGeneral(`🪙 ${jugador.name} lanzó una moneda y salió... ¡${resultado}!`);
            break;

        case "random":
            const limite = parseInt(args[1]);
            if (isNaN(limite) || limite <= 0) {
                anunciarError("📝 Uso: !random <número_mayor_a_0>", jugador);
            } else {
                const numero = Math.floor(Math.random() * limite) + 1;
                anunciarGeneral(`🎲 ${jugador.name} sacó un ${numero} (de 1 a ${limite})`);
            }
            break;
        case "record":
        case "records":
            mostrarRecords(jugador);
            break;
            
        case "top":
            if (args[1]) {
                mostrarTopJugadores(jugador, args[1].toLowerCase());
            } else {
                room.sendAnnouncement("📝 Uso: !top <estadística>", jugador.id, parseInt("FF0000", 16), "normal", 0);
                room.sendAnnouncement("📊 Estadísticas disponibles: goles, asistencias, vallas, autogoles, mvps", jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
            }
            break;
            
        case "codigo":
        case "cod": // Abreviación para codigo
            mostrarCodigoRecuperacion(jugador);
            break;
            
        case "recuperar":
            if (args[1]) {
                recuperarEstadisticas(jugador, args[1]);
            } else {
                anunciarError("📝 Uso: !recuperar <código>", jugador);
            }
            break;
            
        case "puntuacion":
            mostrarPuntuacionJugador(jugador);
            break;
            
        case "nenazo":
            const mensajeNenazo = "uno, sos nenazo, dos, terrible sensible, tres, sos admin jajaja terrible fraca, cuatro, no te juna nadie, cinco, bajale el lompa a gerson virgen, seis, no insulté a len nomas descansamos a gerson pq es virgen mal jajaj y pq me dijeron q lo haga, siete, conseguite una vida vos panchito q manejas un fracaso encima, escoria, ocho, sos un chiste q nadie te respeta, nueve, tenes menos admin q blind, diez, no sabes separar lo externo al host q abusas del admin y once, mamala puton jajja";
            anunciarGeneral(`🔥 💯 ${jugador.name.toUpperCase()}: ${mensajeNenazo} 💯`, "FF6B6B", "bold");
            break;
            
        case "nov":
            const mensajeNov = "Hola chicos, voy a estar inactivo pq bueno estoy pensando sobre el tema del suicidi0, no le voy a decir porque ando en eso porque no les quiero poner mal o algo asi, igual mi hermanito menor también juega hax y el ya que es el menor tendra mi celular, los quiero mucho y sobre todo, YALLAH.";
            anunciarGeneral(`💬 📢 ${jugador.name.toUpperCase()}: ${mensajeNov} 📢`, "8A2BE2", "bold");
            break;
            
        case "cm":
            let objetivo;
            if (args[1]) {
                const nombreObjetivo = args.slice(1).join(" ");
                objetivo = obtenerJugadorPorNombre(nombreObjetivo);

                if (!objetivo) {
                    anunciarError(`❌ No se encontró a ningún jugador con el nombre "${nombreObjetivo}"`, jugador);
                    return;
                }
            } else {
                objetivo = jugador;
            }

            // Generar tamaño COMPLETAMENTE ALEATORIO entre 7 y 32
            const tamano = Math.floor(Math.random() * 26) + 7; // 26 posibilidades (7-32)

            // Determinar comentario según el tamaño
            let comentario = "";
            let emoji = "";

            if (tamano >= 25) {
                // Gigante (25-32 cm)
                const comentariosGigante = [
                    "¡BESTIAL! 🐎 Eso ya es un arma de destrucción masiva",
                    "¡MONSTRUOSO! 🦍 Eso debería estar en un museo",
                    "¡LEGENDARIO! 🗿 Los científicos quieren estudiarlo",
                    "¡ÉPICO! ⚔️ Con eso podrías conquistar países",
                    "¡TITÁNICO! 🚢 Eso tiene su propio código de área"
                ];
                comentario = comentariosGigante[Math.floor(Math.random() * comentariosGigante.length)];
                emoji = "🍆💥";
            } else if (tamano >= 20) {
                // Larga (20-24 cm)
                const comentariosLarga = [
                    "¡IMPRESIONANTE! 🤯 Eso ya es considerado patrimonio nacional",
                    "¡WOW! 😱 Con eso podría trabajar de modelo",
                    "¡TREMENDO! 🔥 Eso debe tener su propio código postal",
                    "¡INCREÍBLE! 👑 Rey de reyes, señor de señores",
                    "¡ESPECTACULAR! 🎭 Debería estar en el circo",
                    "¡COLOSAL! 🏛️ Material de leyenda"
                ];
                comentario = comentariosLarga[Math.floor(Math.random() * comentariosLarga.length)];
                emoji = "🍆👑";
            } else if (tamano >= 17) {
                // Un poco más grande (17-19 cm)
                const comentariosMayorPromedio = [
                    "¡Muy bien! 😎 Por encima del promedio, felicitaciones",
                    "¡Excelente! 👏 Definitivamente tienes con qué presumir",
                    "¡Genial! 🎯 En el rango perfecto, ni mucho ni poco",
                    "¡Muy bueno! ⭐ Justo lo que las estadísticas recomiendan",
                    "¡Sobresaliente! 🎓 Arriba del promedio mundial",
                    "¡Destacado! 🏅 En la liga de los grandes"
                ];
                comentario = comentariosMayorPromedio[Math.floor(Math.random() * comentariosMayorPromedio.length)];
                emoji = "🍆✨";
            } else if (tamano >= 13) {
                // Normal (13-16 cm)
                const comentariosNormal = [
                    "Normal 👍 Perfectamente funcional",
                    "Estándar 📏 En el rango promedio mundial",
                    "Clásico 😌 Lo importante no es el tamaño sino la técnica",
                    "Regular 🙂 Dentro de lo esperado",
                    "Promedio 📊 Exactamente lo que dice la estadística",
                    "Convencional 💼 Tamaño ejecutivo"
                ];
                comentario = comentariosNormal[Math.floor(Math.random() * comentariosNormal.length)];
                emoji = "🍆😊";
            } else {
                // Pequeña (7-12 cm)
                const comentariosChica = [
                    "Pequeña pero valiente 🥺 Tamaño de bolsillo",
                    "Compacta 📱 Versión travel size",
                    "Mini 🤏 Pero con mucho corazón",
                    "Pocket edition 🎮 Lo bueno viene en envase pequeño",
                    "Formato ahorro 💰 Económica en combustible",
                    "Portátil 🎒 Fácil de transportar",
                    "Concentrada 💊 La potencia está en el interior"
                ];
                comentario = comentariosChica[Math.floor(Math.random() * comentariosChica.length)];
                emoji = "🍆🥺";
            }

            // Mensaje final
            const mensajeFinal = `${emoji} A ${objetivo.name} le mide ${tamano} CM. ${comentario} ${emoji}`;
            anunciarGeneral(mensajeFinal, "FF69B4", "bold");
            break;

        case "afk":
            // Verificar si el jugador es admin
            if (esAdminBasico(jugador)) {
                // FUNCIONALIDAD PARA ADMINS: Mover jugador a espectadores
                if (jugador.team === 0) {
                    anunciarError("❌ Ya estás en espectadores", jugador);
                    return;
                }
                
                // Verificar cooldown del comando
                const cooldownAfk = comandoCooldown.get(jugador.id);
                if (cooldownAfk && Date.now() - cooldownAfk < COOLDOWN_COMANDO) {
                    const tiempoRestante = Math.ceil((COOLDOWN_COMANDO - (Date.now() - cooldownAfk)) / 1000);
                    anunciarError(`⏰ Debes esperar ${tiempoRestante} segundos antes de usar este comando de nuevo`, jugador);
                    return;
                }
                
                room.setPlayerTeam(jugador.id, 0);
                anunciarGeneral(`💤 ${jugador.name} se fue AFK a espectadores`, "888888");
                
                // Limpiar datos AFK y establecer cooldown
                jugadoresAFK.delete(jugador.id);
                advertenciasAFK.delete(jugador.id);
                comandoCooldown.set(jugador.id, Date.now());
                
                // Verificar balance y auto start/stop después del cambio
                setTimeout(() => {
                    autoBalanceEquipos();
                    verificarAutoStart();
                    verificarAutoStop(null);
                }, 500);
                
            } else {
                // FUNCIONALIDAD PARA JUGADORES NORMALES: Ejecutar como !back
                if (jugador.team !== 0) {
                    anunciarError("❌ Ya estás en un equipo. Solo los admins pueden usar !afk para ir a espectadores", jugador);
                    return;
                }
                
                // Verificar cooldown del comando
                const cooldownBack = comandoCooldown.get(jugador.id);
                if (cooldownBack && Date.now() - cooldownBack < COOLDOWN_COMANDO) {
                    const tiempoRestante = Math.ceil((COOLDOWN_COMANDO - (Date.now() - cooldownBack)) / 1000);
                    anunciarError(`⏰ Debes esperar ${tiempoRestante} segundos antes de usar este comando de nuevo`, jugador);
                    return;
                }
                
                // Asignar al equipo con menos jugadores
                const jugadoresRed = room.getPlayerList().filter(j => j.team === 1).length;
                const jugadoresBlue = room.getPlayerList().filter(j => j.team === 2).length;
                const equipoDestino = jugadoresRed <= jugadoresBlue ? 1 : 2;
                
                room.setPlayerTeam(jugador.id, equipoDestino);
                
                const equipoNombre = equipoDestino === 1 ? '🔴 ROJO' : '🔵 AZUL';
                anunciarGeneral(`🔙 ✨ ${jugador.name} regresó del AFK al equipo ${equipoNombre} ✨`, "00FF00", "bold");
                
                // Limpiar datos AFK y establecer cooldown
                jugadoresAFK.delete(jugador.id);
                advertenciasAFK.delete(jugador.id);
                comandoCooldown.set(jugador.id, Date.now());
                
                // Verificar balance y auto start después del cambio
                setTimeout(() => {
                    autoBalanceEquipos();
                    verificarAutoStart();
                }, 500);
            }
            break;
            
        case "nv":
        case "bb":
            // Abandonar la sala completamente
            anunciarGeneral(`👋 ${jugador.name} abandonó la sala. ¡Hasta la vista!`, "888888");
            
            // Usar setTimeout para permitir que el mensaje se muestre antes de la expulsión
            setTimeout(() => {
                room.kickPlayer(jugador.id, "Has abandonado la sala voluntariamente", false);
            }, 100);
            break;

        // Los comandos rápidos numéricos ahora se procesan automáticamente antes de llegar aquí
            
        case "back":
            // Mover jugador de espectadores a un equipo
            if (jugador.team !== 0) {
                anunciarError("❌ Ya estás en un equipo. Usa !afk para ir a espectadores", jugador);
                return;
            }
            
            // Verificar cooldown del comando
            const cooldownBack = comandoCooldown.get(jugador.id);
            if (cooldownBack && Date.now() - cooldownBack < COOLDOWN_COMANDO) {
                const tiempoRestante = Math.ceil((COOLDOWN_COMANDO - (Date.now() - cooldownBack)) / 1000);
                anunciarError(`⏰ Debes esperar ${tiempoRestante} segundos antes de usar este comando de nuevo`, jugador);
                return;
            }
            
            // Asignar al equipo con menos jugadores
            const jugadoresRed = room.getPlayerList().filter(j => j.team === 1).length;
            const jugadoresBlue = room.getPlayerList().filter(j => j.team === 2).length;
            const equipoDestino = jugadoresRed <= jugadoresBlue ? 1 : 2;
            
            room.setPlayerTeam(jugador.id, equipoDestino);
            
            const equipoNombre = equipoDestino === 1 ? '🔴 ROJO' : '🔵 AZUL';
            anunciarGeneral(`🔙 ✨ ${jugador.name} regresó del AFK al equipo ${equipoNombre} ✨`, "00FF00", "bold");
            
            // Limpiar datos AFK y establecer cooldown
            jugadoresAFK.delete(jugador.id);
            advertenciasAFK.delete(jugador.id);
            comandoCooldown.set(jugador.id, Date.now());
            
            // Verificar balance y auto start después del cambio
            setTimeout(() => {
                autoBalanceEquipos();
                verificarAutoStart();
            }, 500);
            break;
            
        // COMANDOS DE ADMIN
        case "claim":
        case "admin":
            if (args[1]) {
                const password = args[1];
                let rolAsignado = null;
                
                // Verificar contraseñas de roles
                if (password === ROLE_PASSWORDS.SUPER_ADMIN) {
                    rolAsignado = "SUPER_ADMIN";
                } else if (password === ROLE_PASSWORDS.ADMIN_FULL || password === adminPassword) {
                    rolAsignado = "ADMIN_FULL";
                } else if (password === ROLE_PASSWORDS.ADMIN_BASICO) {
                    rolAsignado = "ADMIN_BASICO";
                }
                
                if (rolAsignado) {
                    // Asignar rol en el nuevo sistema
                    jugadoresConRoles.set(jugador.id, {
                        role: rolAsignado,
                        assignedAt: Date.now(),
                        assignedBy: jugador.name
                    });
                    
                    const rol = ROLES[rolAsignado];
                    
                    // Si es ADMIN_FULL o SUPER_ADMIN, también dar permisos de admin legacy
                    // PERO NO cambiar el color del nombre (no usar setPlayerAdmin)
                    if (rolAsignado === "ADMIN_FULL" || rolAsignado === "SUPER_ADMIN") {
                        adminActual = jugador;
                        // room.setPlayerAdmin(jugador.id, true); // COMENTADO para mantener color blanco
                    }
                    
                    // No cambiar el nombre/avatar del jugador al asignar rol
                    
                    // Anuncio según el rol
                    let mensaje, color;
                    switch (rolAsignado) {
                        case "SUPER_ADMIN":
                            mensaje = `👑 ⚡ ${jugador.name.toUpperCase()} ES AHORA SUPER ADMINISTRADOR ⚡ 👑`;
                            color = "FF0000";
                            break;
                        case "ADMIN_FULL":
                            mensaje = `🛡️ ⚡ ${jugador.name.toUpperCase()} ES AHORA ADMIN FULL ⚡ 🛡️`;
                            color = "FFD700";
                            break;
                        case "ADMIN_BASICO":
                            mensaje = `⚖️ ⚡ ${jugador.name.toUpperCase()} ES AHORA ADMIN BÁSICO ⚡ ⚖️`;
                            color = "FFA500";
                            break;
                    }
                    
                    anunciarGeneral(mensaje, color, "bold");
                    
                } else {
                    anunciarError("🔐 Contraseña incorrecta", jugador);
                }
            } else {
                anunciarError("📝 Uso: !claim <contraseña>", jugador);
            }
            break;
            
            
        case "set_password":
        case "pw":
            if (!esAdmin(jugador)) return;
            if (args[1]) {
                room.setPassword(args[1]);
                contraseñaActual = args[1];
                anunciarGeneral(`🔒 🛡️ CONTRASEÑA DE SALA ESTABLECIDA: ${args[1]} 🛡️ 🔒`, "FFD700", "bold");
                // Enviar reporte de cambio de estado
                setTimeout(() => {
                    // Generar informe verificando enlace real
                    if (tieneEnlaceReal()) {
                        const mensaje = generarInformeSala();
                        enviarReporteDiscord(mensaje);
                    // Reporte enviado con enlace real después de !pw
                } else {
                    // No se envía reporte de !pw - esperando enlace real
                }
                }, 1000);
            } else {
anunciarError("Uso: !pw <contraseña>", jugador);
            }
            break;
            
        case "clear_password":
        case "clear":
        case "clearpassword":
            if (!esAdmin(jugador)) return;
            room.setPassword(null);
            contraseñaActual = null;
            anunciarGeneral(`🔓 ✨ CONTRASEÑA ELIMINADA - SALA ABIERTA ✨ 🔓`, "00FF00", "bold");
            // Enviar reporte de cambio de estado
            setTimeout(() => {
                // Generar informe verificando enlace real
                if (tieneEnlaceReal()) {
                    const mensaje = generarInformeSala();
                    enviarReporteDiscord(mensaje);
                    // Reporte enviado con enlace real después de !clear_password
                } else {
                    // No se envía reporte de !clear_password - esperando enlace real
                }
            }, 1000);
            break;
            
        case "clear_bans":
            if (!esAdmin(jugador)) return;
            room.clearBans();
            anunciarExito("🧹 Lista de baneos limpiada");
            break;
            
            
        case "pause":
            if (!esAdmin(jugador)) return;
            room.pauseGame(true);
            anunciarInfo("⏸️ Juego pausado");
            break;
            
        case "resume":
            if (!esAdmin(jugador)) return;
            room.pauseGame(false);
            anunciarInfo("▶️ Juego reanudado");
            break;
            
        case "autostart":
            if (!esAdmin(jugador)) return;
            autoStartEnabled = !autoStartEnabled;
        const estado = autoStartEnabled ? '✅ ACTIVADO' : '❌ DESACTIVADO';
        anunciarGeneral(`🤖 ⚙️ AUTO START ${estado} ⚙️ 🤖`, autoStartEnabled ? "00FF00" : "FF6B6B", "bold");
            if (autoStartEnabled) verificarAutoStart();
            break;
            
        case "autostop":
            if (!esAdmin(jugador)) return;
            autoStopEnabled = !autoStopEnabled;
            anunciarExito(`🤖 Auto stop ${autoStopEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
            break;
            
        case "balance":
            if (!esAdmin(jugador)) return;
            autoBalanceEquipos();
            anunciarExito("⚖️ Balance de equipos ejecutado manualmente");
            break;
            
        case "replay_config":
            if (!esAdmin(jugador)) return;
            mostrarConfigReplays(jugador);
            break;
            
        case "toggle_replays":
            if (!esAdmin(jugador)) return;
            if (args[1]) {
                const tipo = args[1].toLowerCase();
                if (tipo === "discord") {
                    enviarReplaysDiscord = !enviarReplaysDiscord;
                    anunciarExito(`🎬 Envío de replays a Discord: ${enviarReplaysDiscord ? 'ACTIVADO' : 'DESACTIVADO'}`);
                } else if (tipo === "oficiales") {
                    guardarReplaysOficiales = !guardarReplaysOficiales;
                    anunciarExito(`🏆 Replays oficiales: ${guardarReplaysOficiales ? 'ACTIVADO' : 'DESACTIVADO'}`);
                } else if (tipo === "amistosos") {
                    guardarReplaysAmistosos = !guardarReplaysAmistosos;
                    anunciarExito(`⚽ Replays amistosos: ${guardarReplaysAmistosos ? 'ACTIVADO' : 'DESACTIVADO'}`);
                } else {
                    anunciarError("Usa: !toggle_replays discord|oficiales|amistosos");
                }
            } else {
                anunciarError("Usa: !toggle_replays discord|oficiales|amistosos");
            }
            break;
            
        case "stop":
            if (!esAdmin(jugador)) return;
            if (partidoEnCurso) {
                room.stopGame();
                anunciarInfo("⏹️ Partido finalizado manualmente por el administrador");
            } else {
                anunciarError("⚠️ No hay partido en curso para detener", jugador);
            }
            break;
            
        case "mute":
            if (!esSuperAdmin(jugador)) return;
            if (args[1]) {
                const nombreJugador = args[1];
                const tiempo = args[2] ? parseInt(args[2]) : null; // tiempo en minutos
                const razon = args.slice(tiempo ? 3 : 2).join(" ") || "Muteado por superadmin";
                const jugadorObjetivo = obtenerJugadorPorNombre(nombreJugador);
                
                if (jugadorObjetivo) {
                    if (esSuperAdmin(jugadorObjetivo)) {
                        anunciarError("No puedes silenciar a otro superadmin", jugador);
                        return;
                    }
                    
                    // Verificar si ya está muteado y desmutear
                    if (jugadoresMuteados.has(jugadorObjetivo.id) || jugadoresMuteadosTemporales.has(jugadorObjetivo.id)) {
                        // Desmutear jugador
                        jugadoresMuteados.delete(jugadorObjetivo.id);
                        
                        const muteTemp = jugadoresMuteadosTemporales.get(jugadorObjetivo.id);
                        if (muteTemp) {
                            clearTimeout(muteTemp.timeoutId);
                            jugadoresMuteadosTemporales.delete(jugadorObjetivo.id);
                        }
                        
                        anunciarExito(`🔊 ${jugadorObjetivo.name} ya no está silenciado`);
                        // Mensaje privado al jugador desmutado
                        room.sendAnnouncement("ℹ️ ✅ Finalizó tu muteo", jugadorObjetivo.id, parseInt(CELESTE_LNB, 16), "normal", 0);
                        return;
                    }
                    
                    // Aplicar mute
                    if (tiempo && tiempo > 0) {
                        // Mute temporal
                        const finMute = Date.now() + (tiempo * 60 * 1000);
                        
                        // Crear timeout para desmutear automáticamente
                        const timeoutId = setTimeout(() => {
                            if (jugadoresMuteadosTemporales.has(jugadorObjetivo.id)) {
                                jugadoresMuteadosTemporales.delete(jugadorObjetivo.id);
                                // Verificar si el jugador sigue conectado
                                const jugadorActual = room.getPlayerList().find(j => j.id === jugadorObjetivo.id);
                                if (jugadorActual) {
                                    anunciarInfo(`✅ ${jugadorObjetivo.name} ya no está silenciado (tiempo expirado)`);
                                    // Mensaje privado al jugador desmutado
                                    room.sendAnnouncement("ℹ️ ✅ Finalizó tu muteo", jugadorObjetivo.id, parseInt(CELESTE_LNB, 16), "normal", 0);
                                }
                            }
                        }, tiempo * 60 * 1000);
                        
                        jugadoresMuteadosTemporales.set(jugadorObjetivo.id, {
                            finMute: finMute,
                            razon: razon,
                            timeoutId: timeoutId
                        });
                        
                        anunciarAdvertencia(`🔇 ${jugadorObjetivo.name} ha sido silenciado por ${tiempo} minutos: ${razon}`);
                    } else {
                        // Mute permanente
                        jugadoresMuteados.add(jugadorObjetivo.id);
                        anunciarAdvertencia(`🔇 ${jugadorObjetivo.name} ha sido silenciado permanentemente: ${razon}`);
                    }
                } else {
                    anunciarError("Jugador no encontrado", jugador);
                }
            } else {
                anunciarError("📝 Uso: !mute \u003cjugador\u003e [tiempo_minutos] [razón]", jugador);
            }
            break;
            
        case "warn":
            if (!esAdmin(jugador)) return;
            if (args[1]) {
                const nombreJugador = args[1];
                const razon = args.slice(2).join(" ") || "No especificada";
                const jugadorObjetivo = obtenerJugadorPorNombre(nombreJugador);
                if (jugadorObjetivo) {
                    if (!advertenciasJugadores.has(jugadorObjetivo.id)) {
                        advertenciasJugadores.set(jugadorObjetivo.id, 0);
                    }
                    const warns = advertenciasJugadores.get(jugadorObjetivo.id) + 1;
                    advertenciasJugadores.set(jugadorObjetivo.id, warns);
                    
                    anunciarAdvertencia(`⚠️ ${jugadorObjetivo.name} ha recibido una advertencia [${warns}/3]`);
                    room.sendAnnouncement(`⚠️ Advertencia: ${razon}`, jugadorObjetivo.id, parseInt("FF8C00", 16), "bold", 1);
                    
                    if (warns >= 3) {
                        room.kickPlayer(jugadorObjetivo.id, "Expulsado por acumular 3 advertencias", false);
                        advertenciasJugadores.delete(jugadorObjetivo.id);
                        anunciarAdvertencia(`🥾 ${jugadorObjetivo.name} ha sido expulsado por acumular 3 advertencias`);
                    }
                } else {
                    anunciarError("Jugador no encontrado", jugador);
                }
            } else {
                anunciarError("📝 Uso: !warn <jugador> [razón]", jugador);
            }
            break;
            
case "kick":
            // Verificar permisos básicos - cualquier tipo de admin puede kickear
            if (!esAdminBasico(jugador)) {
                anunciarError("❌ No tienes permisos para expulsar jugadores.", jugador);
                return;
            }
            
            if (args[1]) {
                const nombreJugador = args[1];
                const razon = args.slice(2).join(" ") || "Expulsado por admin";
                const jugadorObjetivo = obtenerJugadorPorNombre(nombreJugador);
                
                if (jugadorObjetivo) {
                    // Verificar jerarquía de permisos
                    if (esSuperAdmin(jugadorObjetivo)) {
                        anunciarError("❌ No puedes hacer kick a un Super Admin", jugador);
                        return;
                    }
                    
                    if (esAdmin(jugadorObjetivo) && !esSuperAdmin(jugador)) {
                        anunciarError("❌ No puedes hacer kick a un Admin Full (necesitas ser Super Admin)", jugador);
                        return;
                    }
                    
                    if (esAdminBasico(jugadorObjetivo) && !esAdmin(jugador)) {
                        anunciarError("❌ No puedes hacer kick a otro Admin Básico (necesitas ser Admin Full o superior)", jugador);
                        return;
                    }
                    
                    // Ejecutar kick
                    room.kickPlayer(jugadorObjetivo.id, razon, false);
                    
                    // Mensaje personalizado según el tipo de admin que ejecuta el kick
                    const tipoAdmin = esSuperAdmin(jugador) ? "Super Admin" : 
                                     esAdmin(jugador) ? "Admin Full" : "Admin Básico";
                    
                    // Enviar notificación al webhook
                    const ipJugadorObjetivo = obtenerIPJugador(jugadorObjetivo);
                    enviarNotificacionBanKick("kick", jugador.name, jugadorObjetivo.name, jugadorObjetivo.id, null, razon, ipJugadorObjetivo);
                    
                } else {
                    anunciarError("❌ Jugador no encontrado", jugador);
                }
            } else {
                anunciarError("📝 Uso: !kick <jugador> [razón]", jugador);
            }
            break;
            
        case "unmute":
            if (!esAdmin(jugador)) return;
            if (args[1]) {
                const nombreJugador = args[1];
                const jugadorObjetivo = obtenerJugadorPorNombre(nombreJugador);
                
                if (jugadorObjetivo) {
                    let jugadorDesmmuteado = false;
                    
                    // Verificar y remover mute permanente
                    if (jugadoresMuteados.has(jugadorObjetivo.id)) {
                        jugadoresMuteados.delete(jugadorObjetivo.id);
                        jugadorDesmmuteado = true;
                    }
                    
                    // Verificar y remover mute temporal
                    const muteTemp = jugadoresMuteadosTemporales.get(jugadorObjetivo.id);
                    if (muteTemp) {
                        clearTimeout(muteTemp.timeoutId);
                        jugadoresMuteadosTemporales.delete(jugadorObjetivo.id);
                        jugadorDesmmuteado = true;
                    }
                    
                    if (jugadorDesmmuteado) {
                        anunciarExito(`🔊 ${jugadorObjetivo.name} ha sido desmuteado por ${jugador.name}`);
                    } else {
                        anunciarError(`❌ ${jugadorObjetivo.name} no está muteado`, jugador);
                    }
                } else {
                    anunciarError("❌ Jugador no encontrado", jugador);
                }
            } else {
                anunciarError("📝 Uso: !unmute <jugador>", jugador);
            }
            break;
            
        case "ban":
            // 1. Verificar si el usuario es al menos admin básico
            if (!esAdminBasico(jugador)) {
                anunciarError("❌ No tienes permisos para banear jugadores.", jugador);
                return;
            }

            // 2. Validar argumentos
            if (!args[1]) {
                anunciarError("📝 Uso: !ban <jugador> [tiempo] [razón]. El tiempo es en minutos.", jugador);
                return;
            }
            
            const nombreJugador = args[1];
            const jugadorObjetivo = obtenerJugadorPorNombre(nombreJugador);

            if (!jugadorObjetivo) {
                anunciarError(`❌ Jugador "${nombreJugador}" no encontrado.`, jugador);
                return;
            }

            // 3. Prevenir que los admins se baneen entre sí
            if (esAdminBasico(jugadorObjetivo)) {
                anunciarError("❌ No puedes banear a otro administrador.", jugador);
                return;
            }

            // 4. Analizar tiempo y razón
            let tiempoInput = args[2];
            let tiempo = null; // null = ban permanente
            let razon = args.slice(2).join(" ") || "Baneado por admin"; // Razón por defecto

            if (tiempoInput && !isNaN(parseInt(tiempoInput))) {
                tiempo = parseInt(tiempoInput);
                razon = args.slice(3).join(" ") || "Baneado por admin";
            }
            
            // 5. Aplicar límites de tiempo según el rol
            if (esSuperAdmin(jugador)) {
                // Super Admin no tiene límite de tiempo y puede banear permanentemente
            } else if (esAdmin(jugador)) { // Admin Full
                if (tiempo === null) {
                    anunciarError("❌ Como Admin Full, debes especificar un tiempo de baneo.", jugador);
                    return;
                }
                const maxTiempo = 600;
                if (tiempo > maxTiempo) {
                    anunciarError(`❌ Tu límite de baneo es de ${maxTiempo} minutos.`, jugador);
                    return;
                }
            } else { // Admin Básico
                if (tiempo === null) {
                    anunciarError("❌ Como Admin Básico, debes especificar un tiempo de baneo.", jugador);
                    return;
                }
                const maxTiempo = 60;
                if (tiempo > maxTiempo) {
                    anunciarError(`❌ Tu límite de baneo es de ${maxTiempo} minutos.`, jugador);
                    return;
                }
            }

            // 6. Obtener UID e IP del jugador
            const uid = obtenerUID(jugadorObjetivo);
            const ipJugador = obtenerIPJugador(jugadorObjetivo); // Obtener IP para el desbaneo
            
            if (!uid) {
                console.warn(`⚠️ WARN BAN: UID no disponible inmediatamente para ${jugadorObjetivo.name}, iniciando sistema de reintentos...`);
                
                // Sistema de reintentos múltiples con tiempos incrementales
                const intentarObtenerUID = (intento = 1, maxIntentos = 5) => {
                    const tiempoEspera = intento * 500; // 500ms, 1s, 1.5s, 2s, 2.5s
                    
                    setTimeout(() => {
                        const uidRetry = obtenerUID(jugadorObjetivo);
                        
                        if (uidRetry) {
                            console.log(`✅ UID obtenido en intento ${intento}/${maxIntentos} para ${jugadorObjetivo.name}: ${uidRetry}`);
                            anunciarInfo(`🔄 UID obtenido después de ${intento} intento(s), procediendo con el baneo...`, jugador);
                            ejecutarBaneoMejorado(jugador, jugadorObjetivo, uidRetry, tiempo, razon);
                        } else if (intento < maxIntentos) {
                            console.warn(`⚠️ RETRY BAN: Intento ${intento}/${maxIntentos} fallido para ${jugadorObjetivo.name}, reintentando en ${tiempoEspera + 500}ms...`);
                            intentarObtenerUID(intento + 1, maxIntentos);
                        } else {
                            console.error(`❌ ERROR BAN: Todos los intentos (${maxIntentos}) fallaron para obtener UID de ${jugadorObjetivo.name}`);
                            console.error(`📊 INFO DEBUG: ID: ${jugadorObjetivo.id}, Auth: ${jugadorObjetivo.auth}, Team: ${jugadorObjetivo.team}`);
                            
                            anunciarError(`❌ No se pudo obtener el UID de ${jugadorObjetivo.name} después de ${maxIntentos} intentos.`, jugador);
                            anunciarAdvertencia(`⚠️ Esto puede deberse a que el jugador no está autenticado o tiene problemas de conexión.`);
                            anunciarAdvertencia(`💡 Alternativas: !kick ${jugadorObjetivo.name} (expulsar) o esperar a que se reconecte.`);
                        }
                    }, tiempoEspera);
                };
                
                intentarObtenerUID();
                return;
            }

            // 7. Ejecutar el baneo en HaxBall
            const tiempoTexto = tiempo ? `${tiempo} minutos` : "permanentemente";
            try {
                room.kickPlayer(jugadorObjetivo.id, `${razon} (${tiempoTexto})`, true); // true para banear
                anunciarAdvertencia(`🚫 ${jugadorObjetivo.name} ha sido baneado ${tiempoTexto}. Razón: ${razon}`);
                
                // 8. Registrar el baneo en la base de datos
                if (typeof nodeBanearJugador === 'function') {
                    nodeCrearBaneo(uid, jugadorObjetivo.name, razon, jugador.name, tiempo, ipJugador)
                        .then((resultado) => {
                            console.log(`✅ Baneo registrado en DB:`, resultado);
                            // Enviar mensaje privado solo al admin que ejecutó el ban
                            if (typeof room !== 'undefined' && room && room.sendAnnouncement) {
                                room.sendAnnouncement(`ℹ️ 📊 Baneo registrado en la base de datos con UID: ${uid}`, jugador.id, parseInt("87CEEB", 16), "normal", 0);
                            }
                        })
                        .catch((error) => {
                            console.error(`❌ Error registrando baneo en DB:`, error);
                            anunciarAdvertencia(`⚠️ Jugador baneado pero no se pudo registrar en la base de datos`);
                        });
                } else {
                    console.warn('⚠️ Función nodeBanearJugador no disponible');
                }
                
                // 9. Enviar notificación al webhook
                enviarNotificacionBanKick("ban", jugador.name, jugadorObjetivo.name, uid, tiempo, razon, ipJugador);
                
            } catch (error) {
                anunciarError(`❌ Error al banear jugador: ${error.message}`, jugador);
                console.error(`❌ Error en comando ban:`, error);
            }
            break;

        case "unban":
        case "desban":
            if (!esAdminBasico(jugador)) return;
            if (args[1]) {
                const input = args[1].trim();
                
                if (!input) {
                    anunciarError("❌ Uso correcto: !unban <uid|nombre|ip>", jugador);
                    return false;
                }

                console.log(`🔧 UNBAN: Admin ${jugador.name} (ID: ${jugador.id}) solicita desbanear: "${input}"`);
                console.log(`🔧 UNBAN: UID del admin: ${jugador.auth || 'N/A'}`);
                anunciarInfo(`🔄 Procesando solicitud de desbaneo para: ${input}...`, jugador);

                try {
                    // Usar el sistema de unban_system.js si está disponible
                    if (typeof ejecutarDesbaneo === 'function') {
                        console.log(`🔧 UNBAN: Usando sistema robusto de unban_system.js`);
                        
                        const funcionesRequeridas = {
                            nodeObtenerJugadoresBaneados24h,
                            nodeObtenerBaneosActivos,
                            nodeDesbanearJugador,
                            nodeDesbanearJugadorNuevo,
                            anunciarError,
                            anunciarExito,
                            anunciarInfo,
                            anunciarAdvertencia
                        };
                        
                        const resultado = await ejecutarDesbaneo(input, jugador, room, funcionesRequeridas);
                        
                        if (resultado) {
                            console.log(`✅ UNBAN: Sistema robusto ejecutado exitosamente`);
                        } else {
                            console.log(`❌ UNBAN: Sistema robusto no pudo completar el desbaneo`);
                        }
                        
                        return false; // Evita que el mensaje se vea públicamente
                    }

                    // Fallback: Sistema simple integrado
                    console.log(`🔧 UNBAN: Sistema robusto no disponible, usando fallback simple`);
                    
                    // Validar que el room esté disponible
                    if (!room) {
                        throw new Error('Objeto room no disponible');
                    }
                    
                    if (typeof room.clearBan !== 'function') {
                        throw new Error('Función clearBan no disponible en room');
                    }
                    
                    // Verificar que no intente desbanearse a sí mismo
                    if (jugador.auth && input === jugador.auth) {
                        anunciarError(`❌ No puedes desbanearte a ti mismo`, jugador);
                        console.log(`🛡️ UNBAN: Protección activada - Admin intentó desbanearse`);
                        return false;
                    }
                    
                    // SISTEMA MEJORADO: Múltiples métodos de desbaneo
                    console.log(`🔧 UNBAN: Ejecutando desbaneo múltiple para: ${input}`);
                    
                    let exito = false;
                    let metodosIntentados = [];
                    
                    // Método 1: clearBan directo con el input original
                    try {
                        room.clearBan(input);
                        console.log(`✅ UNBAN: clearBan directo exitoso`);
                        metodosIntentados.push('directo');
                        exito = true;
                    } catch (error) {
                        console.warn(`⚠️ UNBAN: clearBan directo falló:`, error.message);
                        metodosIntentados.push('directo-FALLO');
                    }
                    
                    // Método 2: Como string explícito
                    if (!exito) {
                        try {
                            room.clearBan(String(input));
                            console.log(`✅ UNBAN: clearBan string exitoso`);
                            metodosIntentados.push('string');
                            exito = true;
                        } catch (error) {
                            console.warn(`⚠️ UNBAN: clearBan string falló:`, error.message);
                            metodosIntentados.push('string-FALLO');
                        }
                    }
                    
                    // Método 3: Si parece UID hex, probar como número decimal
                    if (!exito && input.length >= 8 && /^[a-fA-F0-9]+$/.test(input)) {
                        try {
                            const numeroUID = parseInt(input, 16);
                            console.log(`🔧 UNBAN: Intentando como número decimal: ${numeroUID}`);
                            room.clearBan(numeroUID);
                            console.log(`✅ UNBAN: clearBan hex-decimal exitoso`);
                            metodosIntentados.push('hex-decimal');
                            exito = true;
                        } catch (error) {
                            console.warn(`⚠️ UNBAN: clearBan hex-decimal falló:`, error.message);
                            metodosIntentados.push('hex-decimal-FALLO');
                        }
                    }
                    
                    // Método 4: Probar con BigInt para UIDs muy largos
                    if (!exito && input.length >= 16 && /^[a-fA-F0-9]+$/.test(input)) {
                        try {
                            const bigIntUID = BigInt('0x' + input);
                            console.log(`🔧 UNBAN: Intentando como BigInt: ${bigIntUID}`);
                            room.clearBan(Number(bigIntUID));
                            console.log(`✅ UNBAN: clearBan BigInt exitoso`);
                            metodosIntentados.push('bigint');
                            exito = true;
                        } catch (error) {
                            console.warn(`⚠️ UNBAN: clearBan BigInt falló:`, error.message);
                            metodosIntentados.push('bigint-FALLO');
                        }
                    }
                    
                    // Método 5: Intentar con variaciones del UID (mayúsculas/minúsculas)
                    if (!exito && /[a-fA-F]/.test(input)) {
                        const variaciones = [input.toLowerCase(), input.toUpperCase()];
                        for (const variacion of variaciones) {
                            if (variacion === input) continue; // Ya probamos el original
                            try {
                                room.clearBan(variacion);
                                console.log(`✅ UNBAN: clearBan variación (${variacion}) exitoso`);
                                metodosIntentados.push(`variacion-${variacion}`);
                                exito = true;
                                break;
                            } catch (error) {
                                console.warn(`⚠️ UNBAN: clearBan variación (${variacion}) falló:`, error.message);
                                metodosIntentados.push(`variacion-${variacion}-FALLO`);
                            }
                        }
                    }
                    
                    // Método 6: Usar clearBans() para limpiar todos los baneos (método nuclear)
                    if (!exito) {
                        try {
                            console.log(`🔧 UNBAN: Intentando método nuclear - clearBans() para limpiar todos`);
                            const jugadoresConectados = room.getPlayerList().length;
                            
                            // Solo usar método nuclear si hay pocos jugadores para no afectar otros baneos legítimos
                            if (jugadoresConectados <= 2) {
                                room.clearBans();
                                console.log(`✅ UNBAN: clearBans() (método nuclear) ejecutado`);
                                metodosIntentados.push('nuclear-clearBans');
                                exito = true;
                            } else {
                                console.log(`⚠️ UNBAN: Método nuclear no usado - demasiados jugadores conectados (${jugadoresConectados})`);
                                metodosIntentados.push('nuclear-OMITIDO');
                            }
                        } catch (error) {
                            console.warn(`⚠️ UNBAN: clearBans() (método nuclear) falló:`, error.message);
                            metodosIntentados.push('nuclear-FALLO');
                        }
                    }
                    
                    console.log(`📊 UNBAN: Métodos intentados: [${metodosIntentados.join(', ')}]`);
                    console.log(`📊 UNBAN: Resultado final: ${exito ? 'ÉXITO' : 'FALLO'}`);
                    
                    // Si ningún método funcionó, intentar buscar por nombre del jugador baneado
                    if (!exito && typeof nodeObtenerJugadoresBaneados24h === 'function') {
                        try {
                            console.log(`🔧 UNBAN: Intentando buscar baneo por nombre como último recurso...`);
                            const jugadoresBaneados = await nodeObtenerJugadoresBaneados24h();
                            const jugadorEncontrado = jugadoresBaneados.find(j => 
                                j.uid === input || j.nombre.toLowerCase().includes(input.toLowerCase())
                            );
                            
                            if (jugadorEncontrado && jugadorEncontrado.uid && jugadorEncontrado.uid !== input) {
                                console.log(`🔧 UNBAN: Encontrado jugador ${jugadorEncontrado.nombre} con UID ${jugadorEncontrado.uid}`);
                                try {
                                    room.clearBan(jugadorEncontrado.uid);
                                    console.log(`✅ UNBAN: clearBan con UID alternativo exitoso`);
                                    metodosIntentados.push('uid-alternativo');
                                    exito = true;
                                } catch (error) {
                                    console.warn(`⚠️ UNBAN: clearBan con UID alternativo falló:`, error.message);
                                    metodosIntentados.push('uid-alternativo-FALLO');
                                }
                            }
                        } catch (searchError) {
                            console.warn(`⚠️ UNBAN: Error buscando jugadores baneados:`, searchError.message);
                            metodosIntentados.push('busqueda-FALLO');
                        }
                    }
                    
                    // Limpiar de la base de datos (tabla jugadores)
                    if (typeof nodeDesbanearJugador === 'function') {
                        try {
                            await nodeDesbanearJugador(input);
                            console.log(`✅ UNBAN: Limpieza BD tabla jugadores completada`);
                        } catch (dbError) {
                            console.warn(`⚠️ UNBAN: Error limpiando BD tabla jugadores:`, dbError.message);
                        }
                    }
                    
                    // Limpiar de la base de datos (tabla baneos)
                    if (typeof nodeDesbanearJugadorNuevo === 'function') {
                        try {
                            await nodeDesbanearJugadorNuevo(input);
                            console.log(`✅ UNBAN: Limpieza BD tabla baneos completada`);
                        } catch (dbError) {
                            console.log(`ℹ️ UNBAN: No se encontró baneo activo en tabla baneos para "${input}" - esto es normal si el jugador no estaba baneado`);
                            console.warn(`⚠️ UNBAN: Detalle del error:`, dbError.message);
                        }
                    }
                    
                    if (exito) {
                        anunciarExito(`✅ Desbaneo completado para "${input}"`);
                        anunciarInfo(`💡 Si el jugador sigue sin poder conectar, puede que necesite esperar unos segundos`, jugador);
                    } else {
                        anunciarError(`❌ No se pudo ejecutar clearBan para "${input}"`, jugador);
                        anunciarInfo(`💡 El baneo puede haber sido eliminado de la BD pero no de HaxBall`, jugador);
                    }
                    
                } catch (error) {
                    console.error(`❌ UNBAN: Error crítico ejecutando comando:`, error);
                    console.error(`❌ UNBAN: Stack trace:`, error.stack);
                    anunciarError(`❌ Error al intentar desbanear "${input}": ${error.message}`, jugador);
                    
                    // Información adicional para debug
                    console.error(`❌ UNBAN: Información de debug:`);
                    console.error(`   - Admin: ${jugador.name} (ID: ${jugador.id}, UID: ${jugador.auth || 'N/A'})`);
                    console.error(`   - Input: "${input}"`);
                    console.error(`   - Room disponible: ${!!room}`);
                    console.error(`   - clearBan disponible: ${typeof room?.clearBan}`);
                }

                return false; // Evita que el mensaje se vea públicamente
            } else {
                anunciarError('❌ Debes especificar un UID, nombre o IP para desbanear', jugador);
                anunciarInfo('💡 Ejemplos: !unban ABC123DEF, !unban JugadorX, !unban 192.168.1.100', jugador);
            }
            break;

        case "debug_unban":
            if (!esSuperAdmin(jugador)) return;
            if (args[1]) {
                const input = args[1].trim();
                
                // Información de debug completa
                anunciarInfo(`🔧 DEBUG UNBAN - Información completa:`, jugador);
                anunciarInfo(`📝 Input recibido: "${input}"`, jugador);
                anunciarInfo(`📏 Longitud del input: ${input.length}`, jugador);
                anunciarInfo(`🔤 Tipo de caracteres: ${/^[a-fA-F0-9]+$/.test(input) ? 'Hexadecimal' : 'Otros'}`, jugador);
                
                // Información del admin
                anunciarInfo(`👤 Admin ejecutor: ${jugador.name} (UID: ${jugador.auth || 'N/A'})`, jugador);
                
                // Probar diferentes métodos de clearBan y mostrar resultados
                const testMethods = [
                    { name: 'String directo', value: input },
                    { name: 'String explícito', value: String(input) },
                    { name: 'Minúsculas', value: input.toLowerCase() },
                    { name: 'Mayúsculas', value: input.toUpperCase() }
                ];
                
                if (/^[a-fA-F0-9]+$/.test(input) && input.length >= 8) {
                    try {
                        const asNumber = parseInt(input, 16);
                        testMethods.push({ name: 'Como número decimal', value: asNumber });
                    } catch (e) {
                        anunciarInfo(`⚠️ No se pudo convertir a número: ${e.message}`, jugador);
                    }
                }
                
                anunciarInfo(`🧪 Probando ${testMethods.length} métodos diferentes:`, jugador);
                
                for (const method of testMethods) {
                    try {
                        room.clearBan(method.value);
                        anunciarExito(`✅ ${method.name}: ÉXITO (${method.value})`, jugador);
                    } catch (error) {
                        anunciarError(`❌ ${method.name}: FALLO - ${error.message}`, jugador);
                    }
                }
                
                // Probar desbaneos en BD
                try {
                    if (nodeDesbanearJugador) {
                        await nodeDesbanearJugador(input);
                        anunciarExito(`✅ BD (Tabla jugadores): ÉXITO para "${input}"`, jugador);
                    }
                    if (nodeDesbanearJugadorNuevo) {
                        await nodeDesbanearJugadorNuevo(input);
                        anunciarExito(`✅ BD (Tabla baneos): ÉXITO para "${input}"`, jugador);
                    }
                } catch (bdError) {
                    anunciarError(`❌ Error de BD: ${bdError.message}`, jugador);
                }

                // Verificar estado de las funciones de BD
                const funcionesDisponibles = {
                    'nodeDesbanearJugador': typeof nodeDesbanearJugador === 'function',
                    'nodeDesbanearJugadorNuevo': typeof nodeDesbanearJugadorNuevo === 'function',
                    'nodeObtenerBaneosActivos': typeof nodeObtenerBaneosActivos === 'function'
                };
                
                anunciarInfo(`📦 Funciones de BD disponibles:`, jugador);
                for (const [nombre, disponible] of Object.entries(funcionesDisponibles)) {
                    const estado = disponible ? '✅' : '❌';
                    anunciarInfo(`${estado} ${nombre}`, jugador);
                }
            } else {
                anunciarError('❌ Uso: !debug_unban <uid|nombre|ip>', jugador);
            }
            break;

        case "banlist":
            if (!esAdminBasico(jugador)) return;
            
            // Usar la función principal de baneos activos
            if (typeof nodeObtenerBaneosActivos === 'function') {
                nodeObtenerBaneosActivos()
                    .then((jugadores) => {
                        if (jugadores.length === 0) {
                            anunciarInfo('📋 No hay jugadores baneados actualmente.', jugador);
                            
                            // Como fallback, verificar los baneos de las últimas 24h
                            if (typeof nodeObtenerJugadoresBaneados24h === 'function') {
                                nodeObtenerJugadoresBaneados24h()
                                    .then((jugadores24h) => {
                                        if (jugadores24h.length > 0) {
                                            anunciarInfo(`📋 Sin embargo, hay ${jugadores24h.length} baneos en las últimas 24h (posiblemente inactivos).`, jugador);
                                            anunciarInfo('💡 Usa !banlist24h para ver baneos recientes.', jugador);
                                        }
                                    })
                                    .catch(() => {}); // Ignorar errores del fallback
                            }
                        } else {
                            room.sendAnnouncement('🚨 LISTA DE JUGADORES BANEADOS ACTIVOS', jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "bold", 0);
                            room.sendAnnouncement('══════════════════════════════════════════════════════════', jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                            
                            jugadores.forEach((jugadorBaneado, index) => {
                                const fechaBan = new Date(jugadorBaneado.fecha);
                                const tiempoTranscurrido = Math.floor((new Date() - fechaBan) / (1000 * 60 * 60)); // horas
                                
                                let tiempoTexto;
                                if (tiempoTranscurrido < 1) {
                                    const minutos = Math.floor((new Date() - fechaBan) / (1000 * 60));
                                    tiempoTexto = `hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
                                } else if (tiempoTranscurrido < 24) {
                                    tiempoTexto = `hace ${tiempoTranscurrido} hora${tiempoTranscurrido !== 1 ? 's' : ''}`;
                                } else {
                                    const dias = Math.floor(tiempoTranscurrido / 24);
                                    tiempoTexto = `hace ${dias} día${dias !== 1 ? 's' : ''}`;
                                }
                                
                                // Mostrar información sobre duración del baneo
                                let duracionTexto = "";
                                if (jugadorBaneado.duracion > 0) {
                                    const tiempoRestante = (jugadorBaneado.duracion * 60 * 1000) - (new Date() - fechaBan);
                                    if (tiempoRestante > 0) {
                                        const horasRestantes = Math.floor(tiempoRestante / (1000 * 60 * 60));
                                        const minutosRestantes = Math.floor((tiempoRestante % (1000 * 60 * 60)) / (1000 * 60));
                                        duracionTexto = ` (⏳ ${horasRestantes}h ${minutosRestantes}m restantes)`;
                                    } else {
                                        duracionTexto = " (⚠️ Baneo temporal expirado)";
                                    }
                                } else {
                                    duracionTexto = " (🔒 Permanente)";
                                }
                                
                                room.sendAnnouncement(`${index + 1}. 👤 ${jugadorBaneado.nombre}${duracionTexto}`, jugador.id, parseInt(COLORES.ERROR, 16), "bold", 0);
                                room.sendAnnouncement(`   🆔 Auth ID: ${jugadorBaneado.authId || 'N/A'}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                room.sendAnnouncement(`   ⏰ Baneado: ${tiempoTexto}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                room.sendAnnouncement(`   👮 Admin: ${jugadorBaneado.admin}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                room.sendAnnouncement(`   📝 Razón: ${jugadorBaneado.razon}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                
                                if (index < jugadores.length - 1) {
                                    room.sendAnnouncement('', jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                }
                            });
                            
                            room.sendAnnouncement('══════════════════════════════════════════════════════════', jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                            room.sendAnnouncement(`📊 Total: ${jugadores.length} jugador${jugadores.length !== 1 ? 'es' : ''} baneado${jugadores.length !== 1 ? 's' : ''} activamente`, jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "bold", 0);
                            room.sendAnnouncement('💡 Para desbanear: !unban <Auth_ID>', jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                        }
                    })
                    .catch((error) => {
                        console.error('❌ Error obteniendo baneos activos:', error);
                        anunciarError('❌ Error obteniendo la lista de baneos activos.', jugador);
                        
                        // Fallback a la función anterior
                        if (typeof nodeObtenerJugadoresBaneados24h === 'function') {
                            anunciarInfo('🔄 Intentando con método alternativo...', jugador);
                            nodeObtenerJugadoresBaneados24h()
                                .then((jugadores24h) => {
                                    if (jugadores24h.length === 0) {
                                        anunciarInfo('📋 No hay jugadores baneados en las últimas 24 horas.', jugador);
                                    } else {
                                        room.sendAnnouncement('🚨 LISTA DE BANEOS (ÚLTIMAS 24H - MÉTODO ALTERNATIVO)', jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "bold", 0);
                                        room.sendAnnouncement('══════════════════════════════════════════════════════════', jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                                        
                                        jugadores24h.forEach((jugadorBaneado, index) => {
                                            const fechaBan = new Date(jugadorBaneado.fechaBan);
                                            const tiempoTranscurrido = Math.floor((new Date() - fechaBan) / (1000 * 60 * 60));
                                            
                                            let tiempoTexto;
                                            if (tiempoTranscurrido < 1) {
                                                const minutos = Math.floor((new Date() - fechaBan) / (1000 * 60));
                                                tiempoTexto = `hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
                                            } else if (tiempoTranscurrido < 24) {
                                                tiempoTexto = `hace ${tiempoTranscurrido} hora${tiempoTranscurrido !== 1 ? 's' : ''}`;
                                            } else {
                                                const dias = Math.floor(tiempoTranscurrido / 24);
                                                tiempoTexto = `hace ${dias} día${dias !== 1 ? 's' : ''}`;
                                            }
                                            
                                            room.sendAnnouncement(`${index + 1}. 👤 ${jugadorBaneado.nombre}`, jugador.id, parseInt(COLORES.ERROR, 16), "bold", 0);
                                            room.sendAnnouncement(`   🆔 UID: ${jugadorBaneado.uid || 'N/A'}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                            room.sendAnnouncement(`   ⏰ Baneado: ${tiempoTexto}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                            room.sendAnnouncement(`   👮 Admin: ${jugadorBaneado.adminBan}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                            room.sendAnnouncement(`   📝 Razón: ${jugadorBaneado.razonBan}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                            
                                            if (index < jugadores24h.length - 1) {
                                                room.sendAnnouncement('', jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                                            }
                                        });
                                        
                                        room.sendAnnouncement('══════════════════════════════════════════════════════════', jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                                        room.sendAnnouncement(`📊 Total: ${jugadores24h.length} baneos en las últimas 24h`, jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "bold", 0);
                                        room.sendAnnouncement('⚠️ Estos pueden incluir baneos ya inactivos', jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                                    }
                                })
                                .catch(() => {
                                    anunciarError('❌ También falló el método alternativo.', jugador);
                                });
                        }
                    });
            } else {
                anunciarError('❌ Función de base de datos no disponible.', jugador);
            }
            break;

        case "clearbans":
            if (!esAdmin(jugador)) return; // Solo Admin Full o superior
            
            anunciarInfo("🔄 Iniciando limpieza masiva de baneos...", jugador);
            
            // Obtener todos los jugadores baneados activos de la nueva tabla baneos
            if (typeof nodeObtenerBaneosActivos === 'function') {
                nodeObtenerBaneosActivos()
                    .then((jugadoresBaneados) => {
                        if (jugadoresBaneados.length === 0) {
                            // No hay baneos en BD, pero puede haber desincronización con HaxBall
                            anunciarAdvertencia("📋 No hay baneos activos en la base de datos.", jugador);
                            anunciarInfo("🧹 Ejecutando limpieza completa de HaxBall para resolver posibles desincronizaciones...", jugador);
                            
                            try {
                                // Limpiar TODOS los baneos de HaxBall
                                room.clearBans();
                                console.log('✅ CLEARBANS: room.clearBans() ejecutado - Todos los baneos de HaxBall limpiados');
                                
                                // Limpiar también bloqueos IP relacionados con baneos
                                let ipLimpiadas = 0;
                                for (const [ip, bloqueo] of ipsBloqueadas.entries()) {
                                    if (bloqueo.razon && (bloqueo.razon.includes('ban') || bloqueo.razon.includes('múltiples'))) {
                                        ipsBloqueadas.delete(ip);
                                        ipLimpiadas++;
                                    }
                                }
                                
                                // Limpiar conexiones para permitir reconexión
                                conexionesPorIP.clear();
                                jugadoresPorIP.clear();
                                
                                anunciarExito(`✅ Limpieza completa de HaxBall realizada por ${jugador.name}`);
                                anunciarInfo(`🧹 Se limpiaron todos los baneos de HaxBall + ${ipLimpiadas} IP(s) bloqueadas`);
                                anunciarInfo(`💡 Esta limpieza resuelve desincronizaciones entre BD y HaxBall`);
                                
                                // Enviar notificación a Discord sobre la limpieza completa
                                enviarNotificacionClearBans(jugador.name, "completa", 0, ipLimpiadas);
                                
                            } catch (error) {
                                console.error('❌ Error ejecutando room.clearBans():', error);
                                anunciarError('❌ Error ejecutando limpieza completa de HaxBall', jugador);
                            }
                            return;
                        }
                        
                        anunciarInfo(`📊 Encontrados ${jugadoresBaneados.length} jugadores baneados. Iniciando desbaneo masivo...`, jugador);
                        
                        let procesados = 0;
                        let exitosos = 0;
                        let errores = 0;
                        
                        // Procesar cada jugador baneado
                        jugadoresBaneados.forEach((jugadorBaneado, index) => {
                            const uid = jugadorBaneado.uid;
                            
                            if (!uid) {
                                console.warn(`⚠️ CLEARBANS: Jugador ${jugadorBaneado.nombre} no tiene UID, saltando...`);
                                procesados++;
                                errores++;
                                return;
                            }
                            
                            // Desbanear en HaxBall
                            try {
                                room.clearBan(uid);
                                console.log(`✅ CLEARBANS: room.clearBan(${uid}) ejecutado para ${jugadorBaneado.nombre}`);
                                
                                // Actualizar en base de datos
                                if (typeof nodeDesbanearJugador === 'function') {
                                    nodeDesbanearJugador(uid)
                                        .then((resultado) => {
                                            console.log(`✅ CLEARBANS: ${jugadorBaneado.nombre} desbaneado en BD exitosamente`);
                                            exitosos++;
                                        })
                                        .catch((error) => {
                                            console.error(`❌ CLEARBANS: Error actualizando BD para ${jugadorBaneado.nombre}:`, error);
                                            errores++;
                                        })
                                        .finally(() => {
                                            procesados++;
                                            
                                            // Cuando termine de procesar todos
                                            if (procesados === jugadoresBaneados.length) {
                                                anunciarExito(`✅ Limpieza masiva completada por ${jugador.name}`);
                                                anunciarInfo(`📊 Resultados: ${exitosos} exitosos, ${errores} errores de ${jugadoresBaneados.length} total`);
                                                
                                                // Limpiar también bloqueos IP relacionados con baneos
                                                let ipLimpiadas = 0;
                                                for (const [ip, bloqueo] of ipsBloqueadas.entries()) {
                                                    if (bloqueo.razon && (bloqueo.razon.includes('ban') || bloqueo.razon.includes('múltiples'))) {
                                                        ipsBloqueadas.delete(ip);
                                                        ipLimpiadas++;
                                                    }
                                                }
                                                
                                                // Limpiar conexiones para permitir reconexión
                                                conexionesPorIP.clear();
                                                jugadoresPorIP.clear();
                                                
                                                if (ipLimpiadas > 0) {
                                                    anunciarInfo(`🧹 Limpiadas ${ipLimpiadas} IP(s) bloqueadas y conexiones reiniciadas`);
                                                }
                                                
                                                console.log(`✅ CLEARBANS COMPLETO: ${exitosos}/${jugadoresBaneados.length} exitosos, ${ipLimpiadas} IPs limpiadas`);
                                                
                                                // Enviar notificación a Discord sobre la limpieza masiva
                                                enviarNotificacionClearBans(jugador.name, "masiva", exitosos, ipLimpiadas);
                                            }
                                        });
                                } else {
                                    // Si no hay función de BD, al menos contar como procesado
                                    exitosos++;
                                    procesados++;
                                    
                                    if (procesados === jugadoresBaneados.length) {
                                        anunciarExito(`✅ Limpieza masiva completada (solo HaxBall) por ${jugador.name}`);
                                        anunciarAdvertencia(`⚠️ Los registros en BD no se pudieron actualizar`);
                                        
                                        // Enviar notificación a Discord sobre la limpieza masiva (solo HaxBall)
                                        enviarNotificacionClearBans(jugador.name, "masiva_solo_haxball", exitosos, 0);
                                    }
                                }
                                
                            } catch (error) {
                                console.error(`❌ CLEARBANS: Error en room.clearBan para ${jugadorBaneado.nombre} (${uid}):`, error);
                                errores++;
                                procesados++;
                            }
                        });
                        
                    })
                    .catch((error) => {
                        console.error('❌ Error obteniendo jugadores baneados para clearbans:', error);
                        anunciarError('❌ Error obteniendo la lista de jugadores baneados.', jugador);
                    });
            } else {
                // Método alternativo usando la función de 24h si no está disponible la principal
                anunciarAdvertencia('⚠️ Función principal no disponible, usando método alternativo...', jugador);
                
                if (typeof nodeObtenerJugadoresBaneados24h === 'function') {
                    nodeObtenerJugadoresBaneados24h()
                        .then((jugadores24h) => {
                            if (jugadores24h.length === 0) {
                                anunciarInfo('📋 No hay jugadores baneados en las últimas 24h para limpiar.', jugador);
                                return;
                            }
                            
                            anunciarInfo(`📊 Limpiando ${jugadores24h.length} jugadores baneados en las últimas 24h...`, jugador);
                            
                            let exitosos = 0;
                            jugadores24h.forEach(j => {
                                if (j.uid) {
                                    try {
                                        room.clearBan(j.uid);
                                        exitosos++;
                                        console.log(`✅ CLEARBANS ALT: Desbaneado ${j.nombre} (${j.uid})`);
                                    } catch (error) {
                                        console.error(`❌ CLEARBANS ALT: Error con ${j.nombre}:`, error);
                                    }
                                }
                            });
                            
                            anunciarExito(`✅ Limpieza alternativa completada: ${exitosos}/${jugadores24h.length} procesados`);
                            anunciarAdvertencia('⚠️ Solo se limpiaron baneos de las últimas 24h. Para limpieza completa, contactar desarrollador.');
                            
                            // Enviar notificación a Discord sobre la limpieza alternativa
                            enviarNotificacionClearBans(jugador.name, "alternativa_24h", exitosos, 0);
                        })
                        .catch((error) => {
                            console.error('❌ Error en clearbans alternativo:', error);
                            anunciarError('❌ Error en método alternativo de limpieza.', jugador);
                        });
                } else {
                    anunciarError('❌ No hay funciones de base de datos disponibles para clearbans.', jugador);
                    anunciarInfo('💡 Para desbanear jugadores específicos, usa: !unban <UID>', jugador);
                    anunciarInfo('💡 Para obtener UIDs, usa: !banlist o !uid', jugador);
                }
            }
            break;
            
        case "uid":
            if (!esAdminBasico(jugador)) return;
            if (args[1]) {
                // Buscar UID de un jugador específico
                const nombreBuscado = args.slice(1).join(" ");
                const jugadorObjetivo = obtenerJugadorPorNombre(nombreBuscado);
                if (jugadorObjetivo) {
                    const uid = obtenerUID(jugadorObjetivo);
                    if (uid) {
                        room.sendAnnouncement(`🆔 UID de ${jugadorObjetivo.name}: ${uid}`, jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                        room.sendAnnouncement(`💡 Para desbanear usa: !unban ${uid}`, jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                    } else {
                        room.sendAnnouncement(`⚠️ El jugador ${jugadorObjetivo.name} no tiene UID disponible`, jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                        room.sendAnnouncement(`📋 Información del jugador:`, jugador.id, parseInt(COLORES.INFO, 16), "bold", 0);
                        room.sendAnnouncement(`   • ID: ${jugadorObjetivo.id}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                        room.sendAnnouncement(`   • Nombre: ${jugadorObjetivo.name}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                        room.sendAnnouncement(`   • Equipo: ${jugadorObjetivo.team === 1 ? '🔴 Rojo' : jugadorObjetivo.team === 2 ? '🔵 Azul' : '⚪ Espectador'}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                        room.sendAnnouncement(`   • Admin: ${jugadorObjetivo.admin ? '✅ Sí' : '❌ No'}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                        room.sendAnnouncement(`💡 Sin UID no se puede usar !unban. Usa !kick o !ban por nombre`, jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                    }
                } else {
                    anunciarError(`❌ Jugador "${nombreBuscado}" no encontrado`, jugador);
                }
            } else {
                // Mostrar UIDs de todos los jugadores conectados
                const jugadores = obtenerJugadoresSinHost();
                if (jugadores.length > 0) {
                    room.sendAnnouncement("🆔 LISTA DE UIDs DE JUGADORES CONECTADOS:", jugador.id, parseInt(COLORES.INFO, 16), "bold", 0);
                    room.sendAnnouncement("══════════════════════════════════════════════════════════", jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                    
                    let jugadoresConUID = 0;
                    let jugadoresSinUID = 0;
                    
                    jugadores.forEach(j => {
                        const uid = obtenerUID(j);
                        const equipoTexto = j.team === 1 ? "🔴" : j.team === 2 ? "🔵" : "⚪";
                        if (uid) {
                            room.sendAnnouncement(`${equipoTexto} ${j.name}: ${uid}`, jugador.id, parseInt(COLORES.GRIS, 16), "normal", 0);
                            jugadoresConUID++;
                        } else {
                            room.sendAnnouncement(`${equipoTexto} ${j.name}: ⚠️ SIN UID (ID: ${j.id})`, jugador.id, parseInt(COLORES.ADVERTENCIA, 16), "normal", 0);
                            jugadoresSinUID++;
                        }
                    });
                    
                    room.sendAnnouncement("══════════════════════════════════════════════════════════", jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                    room.sendAnnouncement(`📊 Resumen: ${jugadoresConUID} con UID, ${jugadoresSinUID} sin UID`, jugador.id, parseInt(COLORES.INFO, 16), "bold", 0);
                    room.sendAnnouncement("💡 Uso: !uid <nombre_jugador> - para UID específico", jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                    room.sendAnnouncement("💡 Uso: !unban <UID> - para desbanear (solo con UID)", jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                    room.sendAnnouncement("💡 Uso: !kick <nombre> - para expulsar sin UID", jugador.id, parseInt(COLORES.INFO, 16), "normal", 0);
                } else {
                    anunciarError("❌ No hay jugadores conectados para mostrar UIDs", jugador);
                }
            }
            break;
            
        case "ig":
        case "instagram":
            room.sendAnnouncement("━━━━━━━━━┓ LNB 🔥 Instagram: 'https://www.instagram.com/lnbhaxball/' ┏━━━━━━━━━", jugador.id, parseInt(CELESTE_LNB, 16), "bold", 0);
            room.sendAnnouncement("📲 Seguinos para ver clips, historias, resultados y lo mejor de cada jornada", jugador.id, parseInt(CELESTE_LNB, 16), "normal", 0);
            break;
            
        case "tiktok":
        case "tt":
            room.sendAnnouncement("━━━━━━━━━━━━━┓ LNB 🔥 TikTok: 'https://www.tiktok.com/@lnbhaxball' ┏━━━━━━━━━━━━━", jugador.id, parseInt(CELESTE_LNB, 16), "bold", 0);
            room.sendAnnouncement("🔥 Mirá los mejores goles, fails y momentos virales... ¡Seguinos y sumate al show!", jugador.id, parseInt(CELESTE_LNB, 16), "normal", 0);
            break;
            
        case "youtube":
        case "yt":
            room.sendAnnouncement("━━━━━━━━━┓ LNB 🔥 Youtube: 'https://youtube.com/liganacionaldebigger' ┏━━━━━━━━━", jugador.id, parseInt(CELESTE_LNB, 16), "bold", 0);
            room.sendAnnouncement("📲 Seguinos y activá la campanita para no perderte partidos, goles y momentos épicos de la liga.", jugador.id, parseInt(CELESTE_LNB, 16), "normal", 0);
            break;
            
        case "activarvip":
            if (!esSuperAdmin(jugador)) {
                anunciarError("❌ Solo los Super Admins pueden activar VIP", jugador);
                return;
            }
            
            if (args[1]) {
                const nombreJugador = args[1];
                const jugadorObjetivo = obtenerJugadorPorNombre(nombreJugador);
                
                if (jugadorObjetivo) {
                    if (jugadoresVIP.has(jugadorObjetivo.id)) {
                        anunciarError(`❌ ${jugadorObjetivo.name} ya tiene VIP activo`, jugador);
                        return;
                    }
                    
                    // Activar VIP
                    activarVIPJugador(jugadorObjetivo.id, jugadorObjetivo.name);
                    anunciarExito(`👑 VIP activado para ${jugadorObjetivo.name} por ${jugador.name}`);
                    
                    // Notificar al jugador
                    room.sendAnnouncement(
                        "👑 ¡Felicidades! Has recibido VIP. Ahora puedes usar comandos especiales como !afk, !bb y !discord",
                        jugadorObjetivo.id,
                        parseInt("FFD700", 16),
                        "bold",
                        1
                    );
                } else {
                    anunciarError("❌ Jugador no encontrado", jugador);
                }
            } else {
                anunciarError("📝 Uso: !activarVIP <jugador>", jugador);
            }
            break;
            
        case "desactivarvip":
            if (!esSuperAdmin(jugador)) {
                anunciarError("❌ Solo los Super Admins pueden desactivar VIP", jugador);
                return;
            }
            
            if (args[1]) {
                const nombreJugador = args[1];
                const jugadorObjetivo = obtenerJugadorPorNombre(nombreJugador);
                
                if (jugadorObjetivo) {
                    if (!jugadoresVIP.has(jugadorObjetivo.id)) {
                        anunciarError(`❌ ${jugadorObjetivo.name} no tiene VIP activo`, jugador);
                        return;
                    }
                    
                    // Desactivar VIP
                    desactivarVIPJugador(jugadorObjetivo.id);
                    anunciarAdvertencia(`👑 VIP desactivado para ${jugadorObjetivo.name} por ${jugador.name}`);
                    
                    // Notificar al jugador
                    room.sendAnnouncement(
                        "👑 Tu VIP ha sido desactivado",
                        jugadorObjetivo.id,
                        parseInt("FFA500", 16),
                        "bold",
                        1
                    );
                } else {
                    anunciarError("❌ Jugador no encontrado", jugador);
                }
            } else {
                anunciarError("📝 Uso: !desactivarVIP <jugador>", jugador);
            }
            break;
            
        default:
anunciarError("Comando no reconocido. Usa !ayuda para ver comandos disponibles", jugador);
    }
}

function esAdmin(jugador) {
    const rolJugador = jugadoresConRoles.get(jugador.id);
    return rolJugador && (ROLES[rolJugador.role]?.level || 0) >= ROLES.ADMIN_FULL.level;
}

function esSuperAdmin(jugador) {
    const rolJugador = jugadoresConRoles.get(jugador.id);
    return rolJugador && rolJugador.role === "SUPER_ADMIN";
}

function esAdminBasico(jugador) {
    const rolJugador = jugadoresConRoles.get(jugador.id);
    return rolJugador && (ROLES[rolJugador.role]?.level || 0) >= ROLES.ADMIN_BASICO.level;
}

function mostrarColores(jugador) {
    const colores = [
       "📋 CÓDIGOS DE COLORES:",
        "dd2 - Camiseta Azul DD2",
       "dd - Camiseta oficial LNB",
        "bov - Camiseta Bolívar titular",
        "bov1 - Camiseta Bolívar suplente",
        "bov2 - Camiseta Bolívar alternativa",
        "adb - Camiseta The Strongest",
        "realMadrid - Camiseta Real Madrid (España)",
        "barcelona - Camiseta FC Barcelona (España)",
        "betis - Camiseta Real Betis (España)",
        "atleticoMadrid - Camiseta Atlético de Madrid (España)",
        "manchesterUnited - Camiseta Manchester United (Inglaterra)",
        "liverpool - Camiseta Liverpool (Inglaterra)",
        "chelsea - Camiseta Chelsea (Inglaterra)",
        "psg - Camiseta Paris Saint-Germain (Francia)",
        "marseille - Camiseta Olympique de Marseille (Francia)",
        "lyon - Camiseta Olympique Lyonnais (Francia)",
        "juventus - Camiseta Juventus (Italia)",
        "milan - Camiseta AC Milan (Italia)",
        "inter - Camiseta Inter de Milán (Italia)",
        "bayern - Camiseta Bayern Múnich (Alemania)",
        "dortmund - Camiseta Borussia Dortmund (Alemania)",
        "leipzig - Camiseta RB Leipzig (Alemania)",
        "flamengo - Camiseta Flamengo (Brasil)",
        "palmeiras - Camiseta Palmeiras (Brasil)",
        "corinthians - Camiseta Corinthians (Brasil)",
        "argentina - Camiseta Selección Argentina",
        "brasil - Camiseta Selección Brasil",
        "alemania - Camiseta Selección Alemania",
        "nacional - Camiseta Nacional (Uruguay)",
        "penarol - Camiseta Peñarol (Uruguay)",
        "defensorSporting - Camiseta Defensor Sporting (Uruguay)",
        "bocaJuniors - Camiseta Boca Juniors (Argentina)",
        "riverPlate - Camiseta River Plate (Argentina)",
        "independiente - Camiseta Independiente (Argentina)",
        "racing - Camiseta Racing Club (Argentina)",
        "sanLorenzo - Camiseta San Lorenzo (Argentina)",
        "newells - Camiseta Newell's Old Boys (Argentina)",
        "rosarioCentral - Camiseta Rosario Central (Argentina)",
        "pfc - Camiseta PFC titular",
        "pfc2 - Camiseta PFC alternativa"
];
    
    colores.forEach(color => {
        room.sendAnnouncement(color, jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
    });
}

function asignarColor(equipo, codigo, jugador) {
    if (!jugador) {
        // Error: jugador no definido en asignarColor
        return;
    }
    
    const team = jugador.team;

    if ((equipo.toLowerCase() === "red" && team !== 1) || (equipo.toLowerCase() === "blue" && team !== 2)) {
        anunciarError("No puedes cambiar la camiseta del equipo rival", jugador);
        return;
    }

    if (team === 0) {
        anunciarError("Uso: !colors red|blue código", jugador);
        return;
    }
    
    // Verificar si ya se alcanzó el máximo de cambios para este equipo
    const cambiosEquipo = team === 1 ? cambiosCamisetaRed : cambiosCamisetaBlue;
    if (cambiosEquipo >= maxCambiosCamiseta) {
        const equipoNombre = team === 1 ? "Rojo" : "Azul";
        anunciarError(`❌ El equipo ${equipoNombre} ha alcanzado el máximo de cambios de camiseta para este partido (${cambiosEquipo}/${maxCambiosCamiseta})`, jugador);
        return;
    }
    
    const colores = {
        realMadrid: {
            textColor: "000000",
            colors: ["FFFFFF", "FFFFFF", "FFFFFF"]
        },
        
        barcelona: {
            angle: 90,
            textColor: "FFFFFF",
            colors: ["A50044", "004D98", "A50044"]
        },
        
        atleticoMadrid: {
            angle: 90,
            textColor: "FFFFFF",
            colors: ["D50000", "FFFFFF", "D50000"]
        },

        nacional: {
            angle: 0,
            textColor: "000000",
            colors: ["FFFFFF", "FFFFFF", "0000FF"]
        },
        
        penarol: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["FFD100", "FFD100", "000000"]
        },

        defensorSporting: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["5A2D82", "5A2D82", "FFFFFF"]
        },

        manchesterUnited: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["DA291C", "DA291C", "000000"]
        },
        
        liverpool: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["C8102E", "C8102E", "FFFFFF"]
        },

        chelsea: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["034694", "034694", "FFFFFF"]
        },

        flamengo: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["000000", "D50000", "000000"]
        },

        palmeiras: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["00AEEF", "00AEEF", "FFFFFF"]
        },

        pfc: {
            angle: 90,
            textColor: "000000",
            colors: ["FF90DA", "FF88DA", "FF80DA"]
        },

        pfc2: {
            angle: 120,
            textColor: "F954FF",
            colors: ["3D3D3D", "383838", "2E2E2E"]
        },

        argentina: {
            angle: 0,
            textColor: "000000",
            colors: ["FFFFFF", "FFFFFF", "000000"]
        },

        independiente: {
            colors: ["DA291C", "DA291C", "FFFFFF"],
            textColor: "FFFFFF",
            angle: 0,
        },

        bocaJuniors: {
            angle: 270,
            textColor: "FFFFFF",
            colors: ["081F92", "FFCC00", "081F92"]
        },

        newells: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["D50000", "000000", "D50000"]
        },

        rosarioCentral: {
            angle: 90,
            textColor: "000000",
            colors: ["002664", "FFD100", "002664"]
        },

        sanLorenzo: {
            angle: 90,
            textColor: "FFFFFF",
            colors: ["112E8A", "A50044", "112E8A"]
        },

        betis: {
            angle: 90,
            textColor: "007A33",
            colors: ["007A33", "FFFFFF", "007A33"]
        },

        bayern: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["DC052D", "DC052D", "FFFFFF"]
        },


        dortmund: {
            angle: 0,
            textColor: "000000",
            colors: ["FDE100", "FDE100", "000000"]
        },

        leipzig: {
            angle: 0,
            textColor: "D50000",
            colors: ["FFFFFF", "D50000", "FFFFFF"]
        },

        milan: {
            angle: 0,
            textColor: "FFFFFF",
            colors: ["D50000", "000000", "D50000"]
        },

        inter: {
            angle: 90,
            textColor: "FFFFFF",
            colors: ["0055A4", "000000", "0055A4"]
        },

        psg: {
            angle: 90,
            textColor: "FF0000",
            colors: ["004170", "FF0000", "004170"]
        },

        racing: {
            textColor: "000000",
            colors: ["00AEEF", "FFFFFF", "00AEEF"],
            angle: 0
        },

        riverPlate: {
            angle: 45,
            textColor: "D50000",
            colors: ["FFFFFF", "FFFFFF", "D50000"]
        },

        juventus: {
            angle: 0,
            textColor: "000000",
            colors: ["FFFFFF", "000000", "FFFFFF"]
        },
        
        argentina: {
            angle: 0,
            textColor: "000000",
            colors: ["75AADB", "FFFFFF", "75AADB"]
        },
        
        brasil: {
            angle: 0,
            textColor: "0000FF",
            colors: ["FFDF00", "FFDF00", "0000FF"]
        },
        
        alemania: {
            angle: 0,
            textColor: "000000",
            colors: ["FFFFFF", "000000", "FF0000"]
        },
        // Camisetas especiales
        dd: { 
            angle: 0, 
            textColor: "FFFFFF", 
            colors: ["043B00", "000000", "043B00"] 
        }, 

        dd2: { 
            angle: 0, 
            textColor: "FFFFFF", 
            colors: ["FFFFFF", "1F3821", "FFFFFF"] 
        },

        adb: { 
            angle: 90, 
            textColor: "11630E", 
            colors: ["DB0F00", "FFFFFF", "000000"] 
        },
        
        // Camisetas ESC
        esc: { 
            angle: 61, 
            textColor: "202020", 
            colors: ["DECE83", "202020", "17171720"] 
        },
        
        esc1: { 
            angle: 61, 
            textColor: "FFFFFF", 
            colors: ["DECE83", "FFFFFF", "DEDEDE"] 
        },
        
        esc2: {
            angle: 61, 
            textColor: "DECE83", 
            colors: ["000000", "DECE83", "A69A62"] 
        },
        
        // Camisetas especiales adicionales
        tbl: {
            angle: 60,
            textColor: "000000",
            colors: ["363636", "303030"]
        },
        
        hyz: {
            angle: 60,
            textColor: "4D4D4D",
            colors: ["000000", "000000", "000000"]
        },
        
        hyz2: {
            angle: 60,
            textColor: "26C5FF",
            colors: ["801296", "801296", "26C5FF"]
        },
        
        fnv: {
            angle: 60,
            textColor: "000000",
            colors: ["F8842B", "F8842B", "E86B27"]
        },
        
        fnv2: {
            angle: 60,
            textColor: "ABABAB ",
            colors: ["052F99", "052C8F", "042B8C"]
        },
        
        avh: {
            angle: 60,
            textColor: "A4A800",
            colors: ["000029", "000221", "00001C"]
        },
        
        avh2: {
            angle: 180,
            textColor: "39373B",
            colors: ["949E9C", "8D9695", "868F8E"]
        },
        
        avh3: {
            angle: 66,
            textColor: "FFCBA3",
            colors: ["3B0047", "54084A", "690942"]
        },
        
        lmdt: {
            angle: 120,
            textColor: "FADB69",
            colors: ["090A0E"]
        },
        
        lmdt2: {
            angle: 120,
            textColor: "090A0E",
            colors: ["FADB69"]
        },
        
        adb2: {
            angle: 90,
            textColor: "C70C0C",
            colors: ["1E7315", "FFFFFF", "000000"]
        },
        
        adb3: {
            angle: 66,
            textColor: "A35417",
            colors: ["A35417", "FF3BF2", "4FFF72", "4EA2F5"]
        },
        
        do: {
            angle: 0,
            textColor: "000000",
            colors: ["570B0B", "000000", "570B0B"]
        },
        
        do1: {
            angle: 0,
            textColor: "F5F5F5",
            colors: ["FFFFFF", "8A2222", "FCFCFC"]
        },
        
        do2: {
            angle: 90,
            textColor: "F5F5F5",
            colors: ["4A2626", "000000", "4A2626"]
        },
    };
    
    if (colores[codigo]) {
        // Incrementar contador del equipo específico
        if (team === 1) {
            cambiosCamisetaRed++;
        } else {
            cambiosCamisetaBlue++;
        }
        
        const equipoNombre = team === 1 ? "Rojo" : "Azul";
        const cambiosEquipo = team === 1 ? cambiosCamisetaRed : cambiosCamisetaBlue;
        
        // Aplicar el color antes del anuncio
        const color = colores[codigo];
        
        // Convertir colores hexadecimales a enteros para Haxball
        const hexColors = color.colors.map(c => parseInt(c, 16));
        const hexTextColor = parseInt(color.textColor, 16);
        
        room.setTeamColors(team, color.angle || 0, hexTextColor, hexColors);
        
        // NOTA: setPlayerTeamColors removido para evitar problemas de expulsión
        // Los colores se aplicarán automáticamente cuando los jugadores cambien de equipo
        // o se unan nuevos jugadores al equipo
        
        // Mensaje principal del cambio
        room.sendAnnouncement(`👕 ${jugador.name} cambió la camiseta del equipo ${equipoNombre} a "${codigo.toUpperCase()}". Cambios: (${cambiosEquipo}/${maxCambiosCamiseta})`, null, parseInt("FF8C00", 16), "bold", 1);
        
        // Verificar si se alcanzó el máximo para este equipo
        if (cambiosEquipo >= maxCambiosCamiseta) {
            room.sendAnnouncement(`⚠️ El equipo ${equipoNombre} ha alcanzado el número máximo de cambios de camiseta para este partido.`, null, parseInt("FF0000", 16), "bold", 1);
        } else if (cambiosEquipo === maxCambiosCamiseta - 1) {
            room.sendAnnouncement(`⚠️ ¡Atención! El equipo ${equipoNombre} solo tiene 1 cambio de camiseta disponible.`, null, parseInt("FFA500", 16), "bold", 1);
        }
        
        anunciarExito(`Color ${codigo.toUpperCase()} aplicado correctamente al equipo ${equipoNombre}`, jugador);
    } else {
        anunciarError("Código de color no válido. Usa !colors list", jugador);
    }
}


function mostrarConfigReplays(jugador) {
    const config = [
        "🎬 CONFIGURACIÓN DE REPLAYS:",
        `📤 Envío a Discord: ${enviarReplaysDiscord ? 'ACTIVADO' : 'DESACTIVADO'}`,
        `🏆 Replays oficiales: ${guardarReplaysOficiales ? 'ACTIVADO' : 'DESACTIVADO'}`,
        `⚽ Replays amistosos: ${guardarReplaysAmistosos ? 'ACTIVADO' : 'DESACTIVADO'}`,
        `💾 Guardar en PC: ${guardarReplaysEnPC ? 'ACTIVADO' : 'DESACTIVADO'}`,
        "",
        "🔧 COMANDOS:",
        "!toggle_replays discord - Activar/desactivar envío a Discord",
        "!toggle_replays oficiales - Activar/desactivar replays oficiales",
        "!toggle_replays amistosos - Activar/desactivar replays amistosos"
    ];
    
    config.forEach(linea => {
        room.sendAnnouncement(linea, jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
    });
}

// Función para aplicar camisetas especiales
function aplicarCamisetaEspecial(jugador, configuracion) {
    const team = jugador.team;
    
    // Verificar que el jugador esté en un equipo
    if (team === 0) {
        anunciarError("❌ Debes estar en un equipo para cambiar la camiseta", jugador);
        return;
    }
    
    // Verificar si ya se alcanzó el máximo de cambios para este equipo
    const cambiosEquipo = team === 1 ? cambiosCamisetaRed : cambiosCamisetaBlue;
    if (cambiosEquipo >= maxCambiosCamiseta) {
        const equipoNombre = team === 1 ? "Rojo" : "Azul";
        anunciarError(`❌ El equipo ${equipoNombre} ha alcanzado el máximo de cambios de camiseta (${cambiosEquipo}/${maxCambiosCamiseta})`, jugador);
        return;
    }
    
    // Incrementar contador del equipo específico
    if (team === 1) {
        cambiosCamisetaRed++;
    } else {
        cambiosCamisetaBlue++;
    }
    
    const equipoNombre = team === 1 ? "Rojo" : "Azul";
    const cambiosEquipoActual = team === 1 ? cambiosCamisetaRed : cambiosCamisetaBlue;
    
    // Aplicar la configuración de camiseta
    const { angle = 0, textColor, colors } = configuracion;
    
    // Convertir colores hexadecimales a enteros para Haxball
    const hexColors = colors.map(c => parseInt(c, 16));
    const hexTextColor = parseInt(textColor, 16);
    
    room.setTeamColors(team, angle, hexTextColor, hexColors);
    
    // Mensaje principal del cambio
    room.sendAnnouncement(`👕 ${jugador.name} cambió la camiseta del equipo ${equipoNombre} a un diseño especial. Cambios: (${cambiosEquipoActual}/${maxCambiosCamiseta})`, null, parseInt("FF8C00", 16), "bold", 1);
    
    // Verificar si se alcanzó el máximo para este equipo
    if (cambiosEquipoActual >= maxCambiosCamiseta) {
        room.sendAnnouncement(`⚠️ El equipo ${equipoNombre} ha alcanzado el número máximo de cambios de camiseta para este partido.`, null, parseInt("FF0000", 16), "bold", 1);
    } else if (cambiosEquipoActual === maxCambiosCamiseta - 1) {
        room.sendAnnouncement(`⚠️ ¡Atención! El equipo ${equipoNombre} solo tiene 1 cambio de camiseta disponible.`, null, parseInt("FFA500", 16), "bold", 1);
    }
    
    anunciarExito(`Camiseta especial aplicada correctamente al equipo ${equipoNombre}`, jugador);
}


// FUNCIONES DE ESTADÍSTICAS PERSISTENTES CON LOCALSTORAGE
async function cargarEstadisticasGlobalesCompletas() {
    try {
        console.log('🔄 Iniciando carga de estadísticas globales...');
        const datos = await cargarEstadisticasGlobalesDB(); // Usar función de base de datos de forma asíncrona
        console.log('📊 Datos recibidos de la base de datos:', datos ? 'Con datos' : 'null/undefined');
        
        if (datos && datos.jugadores) {
            estadisticasGlobales = datos;
            console.log(`📊 Estadísticas de ${Object.keys(datos.jugadores).length} jugadores cargadas desde DB`);
        } else {
            // Inicializar estructura por primera vez
            estadisticasGlobales = inicializarBaseDatos();
            console.log('📊 Estadísticas globales inicializadas por primera vez');
        }
    } catch (error) {
        console.error('❌ Error al cargar estadísticas globales:', error);
        estadisticasGlobales = inicializarBaseDatos();
        console.log('📊 Estadísticas globales inicializadas de emergencia');
    }
    
    // Verificación final
    if (!estadisticasGlobales || !estadisticasGlobales.jugadores) {
        console.error('❌ CRÍTICO: estadisticasGlobales sigue siendo null después de la inicialización');
        inicializarEstadisticasGlobalesEmergencia();
    }
}

// Función de emergencia para inicializar estadísticas globales
function inicializarEstadisticasGlobalesEmergencia() {
    console.log('🚨 Inicializando estadísticas globales de emergencia...');
    estadisticasGlobales = {
        jugadores: {},
        records: {
            mayorGoles: {jugador: "", cantidad: 0, fecha: ""},
            mayorAsistencias: {jugador: "", cantidad: 0, fecha: ""},
            partidoMasLargo: {duracion: 0, fecha: "", equipos: ""},
            goleadaMasGrande: {diferencia: 0, resultado: "", fecha: ""},
            hatTricks: [],
            vallasInvictas: []
        },
        totalPartidos: 0,
        fechaCreacion: new Date().toISOString(),
        contadorJugadores: 0
    };
    console.log('✅ Estadísticas globales de emergencia inicializadas');
}

function guardarEstadisticasGlobalesCompletas() {
    try {
        if (!estadisticasGlobales) {
            console.error('❌ No se puede guardar: estadisticasGlobales es null');
            return false;
        }
        return guardarEstadisticasGlobalesDB(estadisticasGlobales);
    } catch (error) {
        console.error('❌ Error al guardar estadísticas globales:', error);
        return false;
    }
}

function registrarJugadorGlobal(nombre) {
    // Verificar que estadisticasGlobales esté inicializado
    if (!estadisticasGlobales || !estadisticasGlobales.jugadores) {
        console.error('❌ ERROR: estadisticasGlobales no inicializado en registrarJugadorGlobal');
        // Intentar inicializar estadísticas globales de emergencia
        inicializarEstadisticasGlobalesEmergencia();
        if (!estadisticasGlobales || !estadisticasGlobales.jugadores) {
            console.error('❌ ERROR CRÍTICO: No se pudo inicializar estadisticasGlobales');
            return null;
        }
    }
    
    if (!estadisticasGlobales.jugadores[nombre]) {
        estadisticasGlobales.jugadores[nombre] = {
            nombre: nombre,
            partidos: 0,
            victorias: 0,
            derrotas: 0,
            goles: 0,
            asistencias: 0,
            autogoles: 0,
            mejorRachaGoles: 0,
            mejorRachaAsistencias: 0,
            hatTricks: 0,
            vallasInvictas: 0,
            tiempoJugado: 0, // en segundos
            promedioGoles: 0,
            promedioAsistencias: 0,
            fechaPrimerPartido: new Date().toISOString(),
            fechaUltimoPartido: new Date().toISOString()
        };
    }
    return estadisticasGlobales.jugadores[nombre];
}

function actualizarEstadisticasGlobales(datosPartido) {
    if (!datosPartido.iniciado) return;
    
    // Verificar que estadisticasGlobales esté inicializado
    if (!estadisticasGlobales || !estadisticasGlobales.jugadores) {
        console.error('❌ ERROR: estadisticasGlobales no inicializado en actualizarEstadisticasGlobales');
        inicializarEstadisticasGlobalesEmergencia();
        if (!estadisticasGlobales || !estadisticasGlobales.jugadores) {
            console.error('❌ ERROR CRÍTICO: No se pudo inicializar estadisticasGlobales');
            return;
        }
    }
    
    const fechaActual = new Date().toISOString().split('T')[0];
    estadisticasGlobales.totalPartidos++;
    
    // Determinar equipos ganador y perdedor
    const equipoGanador = datosPartido.golesRed > datosPartido.golesBlue ? 1 : 
                         datosPartido.golesBlue > datosPartido.golesRed ? 2 : 0;
    
    // Actualizar estadísticas de cada jugador
    Object.values(datosPartido.jugadores).forEach(jugadorPartido => {
        const statsGlobal = registrarJugadorGlobal(jugadorPartido.nombre);
        
        // Estadísticas básicas
        statsGlobal.partidos++;
        statsGlobal.goles += jugadorPartido.goles;
        statsGlobal.asistencias += jugadorPartido.asistencias;
        statsGlobal.autogoles += jugadorPartido.autogoles;
        statsGlobal.tiempoJugado += datosPartido.duracion;
        statsGlobal.fechaUltimoPartido = new Date().toISOString();
        
        // Victorias/Derrotas
        if (equipoGanador !== 0) {
            if (jugadorPartido.equipo === equipoGanador) {
                statsGlobal.victorias++;
            } else {
                statsGlobal.derrotas++;
            }
        }
        
        // Hat-tricks
        if (jugadorPartido.goles >= 3) {
            statsGlobal.hatTricks++;
            estadisticasGlobales.records.hatTricks.push({
                jugador: jugadorPartido.nombre,
                goles: jugadorPartido.goles,
                fecha: fechaActual
            });
        }
        
        // Vallas Invictas
        const esArqueroRojo = jugadorPartido.nombre === datosPartido.arqueroRed;
        const esArqueroAzul = jugadorPartido.nombre === datosPartido.arqueroBlue;
        
        if (esArqueroRojo && datosPartido.golesBlue === 0) {
            statsGlobal.vallasInvictas++;
            estadisticasGlobales.records.vallasInvictas.push({
                jugador: jugadorPartido.nombre,
                tiempo: datosPartido.duracion,
                fecha: fechaActual
            });
        }
        
        if (esArqueroAzul && datosPartido.golesRed === 0) {
            statsGlobal.vallasInvictas++;
            estadisticasGlobales.records.vallasInvictas.push({
                jugador: jugadorPartido.nombre,
                tiempo: datosPartido.duracion,
                fecha: fechaActual
            });
        }

        // Récords individuales del partido
        if (jugadorPartido.goles > estadisticasGlobales.records.mayorGoles.cantidad) {
            estadisticasGlobales.records.mayorGoles = {
                jugador: jugadorPartido.nombre,
                cantidad: jugadorPartido.goles,
                fecha: fechaActual
            };
        }
        
        if (jugadorPartido.asistencias > estadisticasGlobales.records.mayorAsistencias.cantidad) {
            estadisticasGlobales.records.mayorAsistencias = {
                jugador: jugadorPartido.nombre,
                cantidad: jugadorPartido.asistencias,
                fecha: fechaActual
            };
        }
        
        // Actualizar promedios
        statsGlobal.promedioGoles = (statsGlobal.goles / statsGlobal.partidos).toFixed(2);
        statsGlobal.promedioAsistencias = (statsGlobal.asistencias / statsGlobal.partidos).toFixed(2);
        
        // ====================== GENERACIÓN AUTOMÁTICA DE CÓDIGO DE RECUPERACIÓN ======================
// Generar código automáticamente cuando el jugador alcanza exactamente 5 partidos
        if (statsGlobal.partidos === 5 && !statsGlobal.codigoRecuperacion) {
            statsGlobal.codigoRecuperacion = generarCodigoRecuperacion(jugadorPartido.nombre);
            statsGlobal.fechaCodigoCreado = new Date().toISOString();
            
            // Notificar al jugador si está en la sala
            const jugadorEnSala = room.getPlayerList().find(j => j.name === jugadorPartido.nombre);
            if (jugadorEnSala) {
                setTimeout(() => {
                    room.sendAnnouncement("🎉 ¡FELICITACIONES! Has alcanzado 5 partidos jugados", jugadorEnSala.id, parseInt("00FF00", 16), "bold", 0);
                    room.sendAnnouncement(`🔐 Tu código de recuperación se ha generado automáticamente: ${statsGlobal.codigoRecuperacion}`, jugadorEnSala.id, parseInt(AZUL_LNB, 16), "bold", 0);
                    room.sendAnnouncement("💡 Guarda este código en un lugar seguro. Úsalo con '!recuperar [código]' para recuperar tus estadísticas", jugadorEnSala.id, parseInt("87CEEB", 16), "normal", 0);
                    room.sendAnnouncement("📋 Puedes ver tu código en cualquier momento con '!codigo' o '!cod'", jugadorEnSala.id, parseInt("87CEEB", 16), "normal", 0);
                }, 3000); // Mostrar después de 3 segundos para no interferir con otros mensajes
            }
            
            console.log(`🔐 Código de recuperación generado automáticamente para ${jugadorPartido.nombre}: ${statsGlobal.codigoRecuperacion}`);
        }
    });
    
    // Récords del partido
    if (datosPartido.duracion > estadisticasGlobales.records.partidoMasLargo.duracion) {
        estadisticasGlobales.records.partidoMasLargo = {
            duracion: datosPartido.duracion,
            fecha: fechaActual,
            equipos: `${datosPartido.golesRed}-${datosPartido.golesBlue}`
        };
    }
    
    const diferencia = Math.abs(datosPartido.golesRed - datosPartido.golesBlue);
    if (diferencia > estadisticasGlobales.records.goleadaMasGrande.diferencia) {
        estadisticasGlobales.records.goleadaMasGrande = {
            diferencia: diferencia,
            resultado: `${datosPartido.golesRed}-${datosPartido.golesBlue}`,
            fecha: fechaActual
        };
    }
    
    guardarEstadisticasGlobales(estadisticasGlobales);
}

function mostrarEstadisticasJugador(solicitante, nombreJugador) {
    const stats = estadisticasGlobales.jugadores[nombreJugador];
    
    if (!stats) {
        room.sendAnnouncement(`❌ No se encontraron estadísticas para ${nombreJugador}`, solicitante.id, parseInt("FF0000", 16), "normal", 0);
        return;
    }
    
    const winRate = stats.partidos > 0 ? ((stats.victorias / stats.partidos) * 100).toFixed(1) : "0.0";
    const horasJugadas = (stats.tiempoJugado / 3600).toFixed(1);
    const fechaPrimera = new Date(stats.fechaPrimerPartido).toLocaleDateString();
    const fechaUltima = new Date(stats.fechaUltimoPartido).toLocaleDateString();
    
    const statsMessage = `📊 ${nombreJugador.toUpperCase()} | 🎮 Partidos: ${stats.partidos} | ⏱️ Tiempo: ${horasJugadas} h | 🏆 V: ${stats.victorias} | 💔 D: ${stats.derrotas} | 📈 WR: ${winRate}% | ⚽ Goles: ${stats.goles} (${stats.promedioGoles}/partido) | 🎯 Asistencias: ${stats.asistencias} (${stats.promedioAsistencias}/partido) | 😱 Autogoles: ${stats.autogoles} | 🎩 Hat-tricks: ${stats.hatTricks} | 🛡️ Vallas invictas: ${stats.vallasInvictas} | 📅 ${fechaUltima}`;
    
    room.sendAnnouncement(statsMessage, solicitante.id, 0xFFFF00, "normal", 0);
    
    // Mostrar código de recuperación si el jugador está consultando sus propias estadísticas
    if (solicitante.name === nombreJugador && stats.partidos > 0) {
        // Generar código si no existe
        if (!stats.codigoRecuperacion) {
            stats.codigoRecuperacion = generarCodigoRecuperacion(nombreJugador);
            stats.fechaCodigoCreado = new Date().toISOString();
            guardarEstadisticasGlobalesCompletas();
        }
        
        // Mostrar código de recuperación
        room.sendAnnouncement(`🔐 Tu código de recuperación: ${stats.codigoRecuperacion}`, solicitante.id, parseInt(AZUL_LNB, 16), "bold", 0);
        room.sendAnnouncement("💡 Guarda este código para recuperar tus estadísticas en otro dispositivo con '!recuperar [código]'", solicitante.id, parseInt("87CEEB", 16), "normal", 0);
    }
}

function mostrarRecords(solicitante) {
    const records = estadisticasGlobales.records;
    
    // Top 5 goleadores históricos
    const topGoleadores = Object.values(estadisticasGlobales.jugadores)
        .sort((a, b) => b.goles - a.goles)
        .slice(0, 5);
    
    // Top 5 asistentes históricos
    const topAsistentes = Object.values(estadisticasGlobales.jugadores)
        .sort((a, b) => b.asistencias - a.asistencias)
        .slice(0, 5);
    
// Top 5 por win rate (mínimo 5 partidos)
    const topWinRate = Object.values(estadisticasGlobales.jugadores)
        .filter(j => j.partidos >= 5)
        .sort((a, b) => (b.victorias/b.partidos) - (a.victorias/a.partidos))
        .slice(0, 5);
    
    const lineas = [
        `🏆 RÉCORDS HISTÓRICOS DE LA SALA`,
        `📊 Total de partidos: ${estadisticasGlobales.totalPartidos}`,
        ``,
        `🏟️ RÉCORDS DE PARTIDOS:`,
        `⏱️ Partido más largo: ${Math.floor(records.partidoMasLargo.duracion/60)}:${(records.partidoMasLargo.duracion%60).toString().padStart(2,'0')} (${records.partidoMasLargo.equipos}) - ${records.partidoMasLargo.fecha}`,
        `🎩 Hat-tricks totales: ${records.hatTricks.length}`,
        ``,
        `👑 TOP 5 GOLEADORES HISTÓRICOS:`
    ];
    
    // TOP 5 GOLEADORES - Formato compacto
    const goleadoresCompacto = [];
    topGoleadores.forEach((jugador, i) => {
        let posicionEmoji = "";
        if (i === 0) posicionEmoji = "🥇";
        else if (i === 1) posicionEmoji = "🥈";
        else if (i === 2) posicionEmoji = "🥉";
        else posicionEmoji = `${i + 1}.`;
        
        goleadoresCompacto.push(`${posicionEmoji} ${jugador.nombre}: ${jugador.goles} goles (${jugador.promedioGoles}/partido)`);
    });
    
    // Agregar goleadores en una sola línea
    lineas.push(goleadoresCompacto.join(" • "));
    
    lineas.push(``);
    lineas.push(`🎯 TOP 5 ASISTENTES HISTÓRICOS:`);
    
    // TOP 5 ASISTENTES - Formato compacto
    const asistentesCompacto = [];
    topAsistentes.forEach((jugador, i) => {
        let posicionEmoji = "";
        if (i === 0) posicionEmoji = "🥇";
        else if (i === 1) posicionEmoji = "🥈";
        else if (i === 2) posicionEmoji = "🥉";
        else posicionEmoji = `${i + 1}.`;
        
        asistentesCompacto.push(`${posicionEmoji} ${jugador.nombre}: ${jugador.asistencias} asistencias (${jugador.promedioAsistencias}/partido)`);
    });
    
    // Agregar asistentes en una sola línea
    lineas.push(asistentesCompacto.join(" • "));
    
    if (topWinRate.length > 0) {
        lineas.push(``);
        lineas.push(`📈 TOP 5 WIN RATE (mín. 10 partidos):`);
        
        // TOP 5 WIN RATE - Formato compacto
        const winRateCompacto = [];
        topWinRate.forEach((jugador, i) => {
            let posicionEmoji = "";
            if (i === 0) posicionEmoji = "🥇";
            else if (i === 1) posicionEmoji = "🥈";
            else if (i === 2) posicionEmoji = "🥉";
            else posicionEmoji = `${i + 1}.`;
            
            const wr = ((jugador.victorias/jugador.partidos)*100).toFixed(1);
            winRateCompacto.push(`${posicionEmoji} ${jugador.nombre}: ${wr}% (${jugador.victorias}/${jugador.partidos})`);
        });
        
        // Agregar win rate en una sola línea
        lineas.push(winRateCompacto.join(" • "));
    }
    
    lineas.forEach(linea => {
        room.sendAnnouncement(linea, solicitante.id, parseInt(AZUL_LNB, 16), "normal", 0);
    });
}

function mostrarTopJugadores(solicitante, estadistica) {
    const jugadores = Object.values(estadisticasGlobales.jugadores)
        .filter(j => j.partidos > 0); // Solo jugadores que han jugado al menos un partido
    
    if (jugadores.length === 0) {
        room.sendAnnouncement("❌ No hay estadísticas disponibles aún.", solicitante.id, parseInt("FF0000", 16), "normal", 0);
        return;
    }
    
    let topJugadores = [];
    let titulo = "";
    let emoji = "";
    let unidad = "";
    
    switch(estadistica) {
        case "goles":
            topJugadores = jugadores
                .sort((a, b) => b.goles - a.goles)
                .slice(0, 10);
            titulo = "⚽ TOP 10 GOLEADORES ⚽";
            unidad = "goles";
            // Eliminar el emoji de título adicional
            break;
            
        case "asistencias":
            topJugadores = jugadores
                .sort((a, b) => b.asistencias - a.asistencias)
                .slice(0, 10);
            titulo = "TOP 10 ASISTENTES";
            emoji = "🎯";
            unidad = "asistencias";
            break;
            
        case "vallas":
        case "vallasInvictas":
        case "vallasinvictas":
            topJugadores = jugadores
                .sort((a, b) => b.vallasInvictas - a.vallasInvictas)
                .slice(0, 10);
            titulo = "TOP 10 VALLAS INVICTAS";
            emoji = "🛡️";
            unidad = "vallas invictas";
            break;
            
        case "autogoles":
            topJugadores = jugadores
                .sort((a, b) => b.autogoles - a.autogoles)
                .slice(0, 10);
            titulo = "TOP 10 AUTOGOLES";
            emoji = "😱";
            unidad = "autogoles";
            break;
            
        case "mvp":
        case "mvps":
            topJugadores = jugadores
                .sort((a, b) => b.hatTricks - a.hatTricks)
                .slice(0, 10);
            titulo = "TOP 10 HAT-TRICKS (MVPs)";
            emoji = "🎩";
            unidad = "hat-tricks";
            break;
            
        default:
            room.sendAnnouncement("❌ Estadística no válida. Usa: goles, asistencias, vallas, autogoles, mvps", solicitante.id, parseInt("FF0000", 16), "normal", 0);
            return;
    }
    
    const lineas = [
        `${titulo}`,
        `══════════════════════════════════════`
    ];
    
    topJugadores.forEach((jugador, i) => {
        let valor = 0;
        let info = "";
        
        switch(estadistica) {
            case "goles":
                valor = jugador.goles;
                info = `(${jugador.promedioGoles}/partido)`;
                break;
            case "asistencias":
                valor = jugador.asistencias;
                info = `(${jugador.promedioAsistencias}/partido)`;
                break;
            case "vallas":
            case "vallasInvictas":
            case "vallasinvictas":
                valor = jugador.vallasInvictas;
                info = `(${jugador.partidos} partidos)`;
                break;
            case "autogoles":
                valor = jugador.autogoles;
                info = `(${jugador.partidos} partidos)`;
                break;
            case "mvp":
            case "mvps":
                valor = jugador.hatTricks;
                info = `(${jugador.partidos} partidos)`;
                break;
        }
        
        // Emojis de posición
        let posicionEmoji = "";
        if (i === 0) posicionEmoji = "🥇";
        else if (i === 1) posicionEmoji = "🥈";
        else if (i === 2) posicionEmoji = "🥉";
        else posicionEmoji = `${i + 1}.`;
        
        lineas.push(`${posicionEmoji} ${jugador.nombre}: ${valor} ${unidad} ${info}`);
    });
    
    // Enviar título en línea separada
    room.sendAnnouncement(lineas[0], solicitante.id, parseInt(AZUL_LNB, 16), "normal", 0);
    
    // Unir todos los jugadores en una sola línea
    const jugadoresEnLinea = lineas.slice(2).join(" • "); // Omitir título y separador
    room.sendAnnouncement(jugadoresEnLinea, solicitante.id, parseInt(AZUL_LNB, 16), "normal", 0);
}

// FUNCIONES DE CÓDIGO DE RECUPERACIÓN
function generarCodigoRecuperacion(nombre) {
    // Generar un código único basado en el nombre del jugador y un timestamp
    const timestamp = Date.now();
    const nombreLimpio = nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
    const seed = nombreLimpio + timestamp.toString();
    
    // Crear un hash simple del seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a 32-bit integer
    }
    
    // Convertir a código alfanumérico de 8 caracteres
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    let hashPos = Math.abs(hash);
    
    for (let i = 0; i < 8; i++) {
        codigo += chars[hashPos % chars.length];
        hashPos = Math.floor(hashPos / chars.length);
    }
    
    return codigo;
}

function mostrarCodigoRecuperacion(jugador) {
    // Verificar si el jugador ya tiene estadísticas
    const stats = estadisticasGlobales.jugadores[jugador.name];
    
    if (!stats || stats.partidos === 0) {
        room.sendAnnouncement("❌ No tienes estadísticas guardadas aún. Juega algunos partidos primero.", jugador.id, parseInt("FF0000", 16), "normal", 0);
        return;
    }
    
    // Generar o recuperar código existente
    if (!stats.codigoRecuperacion) {
        stats.codigoRecuperacion = generarCodigoRecuperacion(jugador.name);
        stats.fechaCodigoCreado = new Date().toISOString();
        guardarEstadisticasGlobalesCompletas();
    }
    
        const lineas = [
            `🔐 Código de recuperación: ${stats.codigoRecuperacion} (${new Date(stats.fechaCodigoCreado).toLocaleDateString()})`,
            "💡 Usá '!recuperar [código]' desde otro dispositivo y guardalo en un lugar seguro.",
            `📊 Stats: ${stats.partidos} partidos, ${stats.goles} goles`
        ];
    
    lineas.forEach(linea => {
        room.sendAnnouncement(linea, jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
    });
}

function recuperarEstadisticas(jugador, codigo) {
    if (!codigo || codigo.length !== 8) {
        room.sendAnnouncement("❌ Código inválido. Debe tener 8 caracteres.", jugador.id, parseInt("FF0000", 16), "normal", 0);
        return;
    }
    
    const codigoLimpio = codigo.toUpperCase();
    
    // Buscar el jugador que tiene este código
    let jugadorOriginal = null;
    let statsOriginales = null;
    
    for (const [nombre, stats] of Object.entries(estadisticasGlobales.jugadores)) {
        if (stats.codigoRecuperacion === codigoLimpio) {
            jugadorOriginal = nombre;
            statsOriginales = stats;
            break;
        }
    }
    
    if (!jugadorOriginal || !statsOriginales) {
        room.sendAnnouncement("❌ Código de recuperación no encontrado. Verifica que sea correcto.", jugador.id, parseInt("FF0000", 16), "normal", 0);
        return;
    }
    
    // Verificar si ya existe un jugador con este nombre y mostrar información
    const statsActuales = estadisticasGlobales.jugadores[jugador.name];
    
    if (statsActuales && statsActuales.partidos > 0) {
        // Mostrar comparación sin fusionar automáticamente
        room.sendAnnouncement("⚠️ Ya tienes estadísticas existentes:", jugador.id, parseInt("FFA500", 16), "bold", 0);
        room.sendAnnouncement(`📊 Actuales: ${statsActuales.partidos} PJ | ${statsActuales.goles} G | ${statsActuales.asistencias} A`, jugador.id, parseInt("87CEEB", 16), "normal", 0);
        room.sendAnnouncement(`🔄 A recuperar: ${statsOriginales.partidos} PJ | ${statsOriginales.goles} G | ${statsOriginales.asistencias} A`, jugador.id, parseInt("87CEEB", 16), "normal", 0);
        room.sendAnnouncement("❌ No se puede recuperar porque ya tienes estadísticas. Contacta a un administrador si necesitas ayuda.", jugador.id, parseInt("FF0000", 16), "normal", 0);
        return;
    } else {
        // No hay estadísticas actuales, recuperar directamente
        estadisticasGlobales.jugadores[jugador.name] = {
            ...statsOriginales,
            nombre: jugador.name,
            fechaRecuperacion: new Date().toISOString(),
            dispositivo: "recuperado"
        };
        
        const mensaje = `✅ Stats recuperadas: ${statsOriginales.partidos} PJ | ${statsOriginales.goles} G | ${statsOriginales.asistencias} A | ${statsOriginales.victorias} V | ${statsOriginales.derrotas} D | Win Rate: ${((statsOriginales.victorias/statsOriginales.partidos)*100).toFixed(1)}%`;
        room.sendAnnouncement(mensaje, jugador.id, parseInt("00FF00", 16), "normal", 0);
    }
    
    // Eliminar las estadísticas del nombre original si es diferente
    if (jugadorOriginal !== jugador.name) {
        delete estadisticasGlobales.jugadores[jugadorOriginal];
    }
    
    guardarEstadisticasGlobalesCompletas();
    
    room.sendAnnouncement("🎮 Usá '!me' para ver tus estadísticas completas.", jugador.id, parseInt("87CEEB", 16), "normal", 0);
    
    // Anuncio público
    anunciarExito(`🔄 ${jugador.name} ha recuperado sus estadísticas`);
}

// FUNCIÓN PARA DESAFIAR A PPT
function desafiarPPT(jugador, nombreOponente, jugadaDesafiador) {
    const oponente = room.getPlayerList().find(j => j.name.toLowerCase().includes(nombreOponente.toLowerCase()));

    if (!oponente) {
anunciarError(`❌ No se encontró a ningún jugador con el nombre "${nombreOponente}"`, jugador);
        return;
    }

    if (oponente.id === jugador.id) {
anunciarError("❌ No puedes desafiarte a ti mismo 😅", jugador);
        return;
    }

    // Verificar si ya hay un desafío activo del jugador
    if (desafiosPPT.has(jugador.id)) {
anunciarError("❌ Ya tienes un desafío activo. Espera a que termine.", jugador);
        return;
    }

    // Verificar si el oponente ya tiene un desafío pendiente
    const desafioExistente = Array.from(desafiosPPT.values()).find(d => d.oponente.id === oponente.id);
    if (desafioExistente) {
anunciarError(`❌ ${oponente.name} ya tiene un desafío pendiente.`, jugador);
        return;
    }

    // Crear el desafío con la jugada del desafiador ya definida
    desafiosPPT.set(jugador.id, { 
        oponente: oponente, 
        jugadaDesafiador: jugadaDesafiador, 
        tiempoInicio: Date.now(), 
        timeout: setTimeout(() => {
            if (desafiosPPT.has(jugador.id)) {
                desafiosPPT.delete(jugador.id);
anunciarAdvertencia(`⏰ El desafío de ${jugador.name} a ${oponente.name} ha expirado.`, jugador);
            }
        }, 30000) 
    }); // 30 segundos para responder

    anunciarGeneral(`🎮 ${jugador.name} ha desafiado a ${oponente.name} a Piedra, Papel o Tijeras!`);
    anunciarGeneral(`✋ ${oponente.name}, responde con !piedra, !papel o !tijeras para aceptar el desafío.`);
}

// FUNCIÓN PARA RESPONDER A UN DESAFÍO DE PPT
function responderDesafioPPT(jugador, jugada) {
    // Buscar si este jugador tiene un desafío pendiente donde él es el oponente
    let desafioKey = null;
    let desafio = null;
    
    for (const [key, value] of desafiosPPT.entries()) {
        if (value.oponente.id === jugador.id) {
            desafioKey = key;
            desafio = value;
            break;
        }
    }

    if (!desafio) {
anunciarError("❌ No tienes ningún desafío pendiente.", jugador);
        return;
    }

    // Limpiar timeout
    if (desafio.timeout) {
        clearTimeout(desafio.timeout);
    }

    // Buscar al jugador desafiador
    const desafiador = room.getPlayerList().find(j => j.id === desafioKey);
    if (!desafiador) {
anunciarError("❌ El jugador que te desafió se desconectó.", jugador);
        desafiosPPT.delete(desafioKey);
        return;
    }

    const jugadaDesafiador = desafio.jugadaDesafiador;

    // Comparar jugadas
    const jugadas = { piedra: 0, papel: 1, tijeras: 2 };
    const resultado = (jugadas[jugada] - jugadas[jugadaDesafiador] + 3) % 3;

    let mensajeResultado;

    if (resultado === 0) {
        mensajeResultado = `🤝 ¡Empate! Ambos eligieron ${jugada}.`;
    } else if (resultado === 1) {
        mensajeResultado = `🎉 ${jugador.name} gana con ${jugada} contra ${jugadaDesafiador} de ${desafiador.name}!`;
    } else {
        mensajeResultado = `🎉 ${desafiador.name} gana con ${jugadaDesafiador} contra ${jugada} de ${jugador.name}!`;
    }

    // Anunciar resultado y limpiar desafío
    anunciarGeneral(mensajeResultado);
    desafiosPPT.delete(desafioKey);
}

// FUNCIÓN PARA MOSTRAR HEAD TO HEAD (H2H)
function mostrarHeadToHead(solicitante, nombre1, nombre2) {
    // Buscar estadísticas de ambos jugadores
    const stats1 = Object.values(estadisticasGlobales.jugadores).find(j => j.nombre.toLowerCase() === nombre1.toLowerCase());
    const stats2 = Object.values(estadisticasGlobales.jugadores).find(j => j.nombre.toLowerCase() === nombre2.toLowerCase());
    
    if (!stats1) {
        anunciarError(`❌ No se encontraron estadísticas para ${nombre1}`, solicitante);
        return;
    }
    if (!stats2) {
        anunciarError(`❌ No se encontraron estadísticas para ${nombre2}`, solicitante);
        return;
    }
    
    // Calcular estadísticas comparativas
    const winRate1 = stats1.partidos > 0 ? ((stats1.victorias / stats1.partidos) * 100).toFixed(1) : "0.0";
    const winRate2 = stats2.partidos > 0 ? ((stats2.victorias / stats2.partidos) * 100).toFixed(1) : "0.0";
    
    const promedioGoles1 = stats1.partidos > 0 ? (stats1.goles / stats1.partidos).toFixed(2) : "0.00";
    const promedioGoles2 = stats2.partidos > 0 ? (stats2.goles / stats2.partidos).toFixed(2) : "0.00";
    
    const promedioAsist1 = stats1.partidos > 0 ? (stats1.asistencias / stats1.partidos).toFixed(2) : "0.00";
    const promedioAsist2 = stats2.partidos > 0 ? (stats2.asistencias / stats2.partidos).toFixed(2) : "0.00";
    
    // Determinar quién es mejor en cada categoría
    const mejorGoleador = stats1.goles > stats2.goles ? stats1.nombre : 
                         stats2.goles > stats1.goles ? stats2.nombre : "Empate";
    
    const mejorAsistente = stats1.asistencias > stats2.asistencias ? stats1.nombre : 
                          stats2.asistencias > stats1.asistencias ? stats2.nombre : "Empate";
    
    const mejorWinRate = parseFloat(winRate1) > parseFloat(winRate2) ? stats1.nombre : 
                        parseFloat(winRate2) > parseFloat(winRate1) ? stats2.nombre : "Empate";
    
    const masPartidos = stats1.partidos > stats2.partidos ? stats1.nombre : 
                       stats2.partidos > stats1.partidos ? stats2.nombre : "Empate";
    
    const masHatTricks = stats1.hatTricks > stats2.hatTricks ? stats1.nombre : 
                        stats2.hatTricks > stats1.hatTricks ? stats2.nombre : "Empate";
    
    // Calcular "dominio" general basado en múltiples métricas
    let puntos1 = 0, puntos2 = 0;
    
    if (stats1.goles > stats2.goles) puntos1++; else if (stats2.goles > stats1.goles) puntos2++;
    if (stats1.asistencias > stats2.asistencias) puntos1++; else if (stats2.asistencias > stats1.asistencias) puntos2++;
    if (parseFloat(winRate1) > parseFloat(winRate2)) puntos1++; else if (parseFloat(winRate2) > parseFloat(winRate1)) puntos2++;
    if (stats1.hatTricks > stats2.hatTricks) puntos1++; else if (stats2.hatTricks > stats1.hatTricks) puntos2++;
    if (stats1.vallasInvictas > stats2.vallasInvictas) puntos1++; else if (stats2.vallasInvictas > stats1.vallasInvictas) puntos2++;
    
    let dominancia = "";
    if (puntos1 > puntos2) {
        dominancia = `🔥 ${stats1.nombre} domina (${puntos1}-${puntos2})`;
    } else if (puntos2 > puntos1) {
        dominancia = `🔥 ${stats2.nombre} domina (${puntos2}-${puntos1})`;
    } else {
        dominancia = `🤝 Están muy parejos (${puntos1}-${puntos2})`;
    }
    
    // Crear el reporte H2H
    const lineas = [
        `⚔️ HEAD TO HEAD: ${stats1.nombre} 🆚 ${stats2.nombre}`,
        `═══════════════════════════════════════════════════════`,
        `🎮 PARTIDOS JUGADOS:`,
        `   ${stats1.nombre}: ${stats1.partidos} | ${stats2.nombre}: ${stats2.partidos}`,
        `   👑 Más activo: ${masPartidos}`,
        ``,
        `⚽ GOLES TOTALES:`,
        `   ${stats1.nombre}: ${stats1.goles} (${promedioGoles1}/partido)`,
        `   ${stats2.nombre}: ${stats2.goles} (${promedioGoles2}/partido)`,
        `   👑 Mejor goleador: ${mejorGoleador}`,
        ``,
        `🎯 ASISTENCIAS TOTALES:`,
        `   ${stats1.nombre}: ${stats1.asistencias} (${promedioAsist1}/partido)`,
        `   ${stats2.nombre}: ${stats2.asistencias} (${promedioAsist2}/partido)`,
        `   👑 Mejor asistente: ${mejorAsistente}`,
        ``,
        `📈 WIN RATE:`,
        `   ${stats1.nombre}: ${winRate1}% (${stats1.victorias}V-${stats1.derrotas}D)`,
        `   ${stats2.nombre}: ${winRate2}% (${stats2.victorias}V-${stats2.derrotas}D)`,
        `   👑 Mejor win rate: ${mejorWinRate}`,
        ``,
        `🎩 HAT-TRICKS (MVP):`,
        `   ${stats1.nombre}: ${stats1.hatTricks} | ${stats2.nombre}: ${stats2.hatTricks}`,
        `   👑 Más MVPs: ${masHatTricks}`,
        ``,
        `🛡️ VALLAS INVICTAS:`,
        `   ${stats1.nombre}: ${stats1.vallasInvictas} | ${stats2.nombre}: ${stats2.vallasInvictas}`,
        ``,
        `═══════════════════════════════════════════════════════`,
        `${dominancia}`,
        `═══════════════════════════════════════════════════════`
    ];
    
    // Enviar el reporte H2H al solicitante
    lineas.forEach(linea => {
        room.sendAnnouncement(linea, solicitante.id, parseInt(AZUL_LNB, 16), "normal", 0);
    });
    
    // Anuncio público opcional (comentado para evitar spam)
    // anunciarInfo(`📊 ${solicitante.name} consultó H2H: ${stats1.nombre} vs ${stats2.nombre}`);
}

// FUNCIONES DE ESTADÍSTICAS DEL PARTIDO

// FUNCIÓN PARA CALCULAR COMPATIBILIDAD
function calcularCompatibilidad(jugador, nombreObjetivo) {
    // Buscar al jugador objetivo en la sala
    const jugadores = room.getPlayerList();
    const objetivo = jugadores.find(j => j.name.toLowerCase().includes(nombreObjetivo.toLowerCase()));
    
    if (!objetivo) {
        anunciarError(`❌ No se encontró a ningún jugador con el nombre "${nombreObjetivo}"`, jugador);
        return;
    }
    
    if (objetivo.id === jugador.id) {
        anunciarError("❌ No puedes hacer ship contigo mismo 😅", jugador);
        return;
    }
    
    // Generar un porcentaje de compatibilidad COMPLETAMENTE ALEATORIO cada vez
    // Usar Math.random() para garantizar variación
    const compatibilidad = Math.floor(Math.random() * 101);
    
    // Determinar el mensaje según el porcentaje
    let mensaje, color;
    
    if (compatibilidad >= 90) {
        mensaje = "¡MATCH PERFECTO! 💕 Están hechos el uno para el otro";
        color = "FF69B4"; // Rosa intenso
    } else if (compatibilidad >= 80) {
        mensaje = "¡Excelente compatibilidad! 💖 Muy buena química";
        color = "FF1493"; // Rosa fuerte
    } else if (compatibilidad >= 70) {
        mensaje = "¡Buena compatibilidad! 💗 Hay potencial aquí";
        color = "FF6347"; // Rojo tomate
    } else if (compatibilidad >= 60) {
        mensaje = "Compatibilidad moderada 💛 Pueden ser buenos amigos";
        color = "FFD700"; // Dorado
    } else if (compatibilidad >= 50) {
        mensaje = "Compatibilidad promedio 🤝 Normal, nada especial";
        color = "FFA500"; // Naranja
    } else if (compatibilidad >= 30) {
        mensaje = "Baja compatibilidad 😐 Mejor como conocidos";
        color = "87CEEB"; // Azul cielo
    } else if (compatibilidad >= 15) {
        mensaje = "Muy baja compatibilidad 😬 Polos opuestos";
        color = "778899"; // Gris azulado
    } else {
        mensaje = "¡Incompatibles! 💀 Mejor manténganse alejados";
        color = "696969"; // Gris oscuro
    }
    
    // Agregar algunos casos especiales divertidos
    const emojis = ["💕", "💖", "💗", "💓", "💘", "💝", "💟", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎"];
    const emojiAleatorio = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Anunciar resultado
    anunciarGeneral(
        `💕 SHIP: ${jugador.name} + ${objetivo.name} = ${compatibilidad}% ${emojiAleatorio}`,
        color,
        "bold"
    );
    
    anunciarGeneral(mensaje, color, "normal");
    
    // Agregar una frase divertida ocasional
    if (Math.random() < 0.3) { // 30% de probabilidad
        const frasesDivertidas = [
            "📸 ¡Foto para el álbum!",
            "🎭 El drama que no sabíamos que necesitábamos",
            "🔮 El oráculo del amor ha hablado",
            "📱 Esto va directo a los chismes del grupo",
            "🎪 Señoras y señores, ¡tenemos espectáculo!",
            "📊 Estadística oficial del corazón",
            "🎲 Los dados del destino han decidido"
        ];
        
        const fraseAleatoria = frasesDivertidas[Math.floor(Math.random() * frasesDivertidas.length)];
        setTimeout(() => {
            anunciarInfo(fraseAleatoria);
        }, 1000);
    }
}

// FUNCIONES DE ESTADÍSTICAS DEL PARTIDO
function inicializarEstadisticas() {
    estadisticasPartido = {
        jugadores: {},
        golesRed: 0,
        golesBlue: 0,
        iniciado: true,
        duracion: 0,
        mejorJugador: null,
        arqueroRed: null,
        arqueroBlue: null,
        tiempoInicio: Date.now(),
        tiempoVallaInvictaRed: 0,
        tiempoVallaInvictaBlue: 0,
        tiempoEsperaSaque: 0, // Tiempo total de espera por saque después de goles
        tiempoEsperaSaqueRed: 0, // Tiempo de espera acumulado para el equipo rojo
        tiempoEsperaSaqueBlue: 0 // Tiempo de espera acumulado para el equipo azul
    };
    
    // Resetear contadores de cambios de camiseta por equipo al iniciar nuevo partido
    cambiosCamisetaRed = 0;
    cambiosCamisetaBlue = 0;
    
    // Inicializar replay para el nuevo partido
    replayData = null;
    replayActual = null;
    tiempoInicioPartido = Date.now();
    reporteEnviado = false; // Reset del flag de reporte enviado
    
        // Registrar jugadores iniciales
        const jugadores = room.getPlayerList();
        jugadores.forEach(jugador => {
            if (jugador.team !== 0) {
                const nombreOriginal = obtenerNombreOriginal(jugador);
                estadisticasPartido.jugadores[jugador.id] = {
                    nombre: nombreOriginal,
                    equipo: jugador.team,
                    goles: 0,
                    asistencias: 0,
                    autogoles: 0,
                    arquero: false,
                    tiempo: 0
                };
            }
        });
    
    anunciarInfo("📊 Estadísticas iniciadas para el partido");
}

function registrarGol(goleador, equipo, asistente) {
    const statsGoleador = estadisticasPartido.jugadores[goleador.id];
    if (statsGoleador) {
        const nombreGoleador = obtenerNombreOriginal(goleador);
        
        // Obtener tiempo del gol
        const scores = room.getScores();
        const tiempoMinutos = Math.floor(scores.time / 60);
        const tiempoSegundos = Math.floor(scores.time % 60);
        const tiempoFormateado = `${tiempoMinutos.toString().padStart(2, '0')}:${tiempoSegundos.toString().padStart(2, '0')}`;
        
        // Calcular velocidad de disparo (simulada por ahora)
        const velocidadDisparo = (Math.random() * 20 + 10).toFixed(2);
        
        // CORRECCIÓN: Usar goleador.team en lugar de statsGoleador.equipo para verificar el equipo actual
        if (goleador.team === equipo) {
            statsGoleador.goles++;
            
            // Otorgar XP por gol
            otorgarXP(nombreGoleador, 'gol');
            
            // Verificar si hay asistente válido primero para determinar el formato del mensaje
            let tieneAsistenciaValida = false;
            let nombreAsistente = "";
            let mensajeAsistenciaPersonalizado = "";
            
            if (asistente && asistente.id !== goleador.id) {
                const statsAsistente = estadisticasPartido.jugadores[asistente.id];
                if (statsAsistente && asistente.team === equipo) {
                    tieneAsistenciaValida = true;
                    nombreAsistente = obtenerNombreOriginal(asistente);
                    
                    // Registrar asistencia y XP
                    statsAsistente.asistencias++;
                    otorgarXP(nombreAsistente, 'asistencia');
                    
                    // Obtener mensaje personalizado de asistencia si existe
                    const mensajesAsistente = mensajesPersonalizados.get(asistente.id);
                    if (mensajesAsistente && mensajesAsistente.asistencia) {
                        mensajeAsistenciaPersonalizado = mensajesAsistente.asistencia;
                    }
                }
            }
            
            // 1. Anunciar el gol con el formato correcto según si hay asistencia personalizada
            const mensajesGoleador = mensajesPersonalizados.get(goleador.id);
            
            // Construir el mensaje base del gol
            let mensajeGolBase = "";
            
            if (mensajesGoleador && mensajesGoleador.gol) {
                // El goleador tiene mensaje personalizado
                mensajeGolBase = `🔵 [${tiempoFormateado}]  ⚽ ${mensajesGoleador.gol}`;
            } else {
                // Mensaje estándar de gol
                mensajeGolBase = `🔵 [${tiempoFormateado}]  ⚽ Gol de ${nombreGoleador.toLowerCase()}`;
            }
            
            // Agregar información de asistencia solo si existe
            if (tieneAsistenciaValida) {
                if (mensajeAsistenciaPersonalizado) {
                    // Hay asistencia con mensaje personalizado
                    mensajeGolBase += ` • ${mensajeAsistenciaPersonalizado}`;
                } else {
                    // Hay asistencia sin mensaje personalizado
                    mensajeGolBase += ` • Asistencia de ${nombreAsistente.toLowerCase()}`;
                }
            }
            
            // Agregar velocidad de disparo y cerrar el mensaje
            mensajeGolBase += ` • ${velocidadDisparo}km/h 🔵`;
            
            // Enviar el mensaje final
            anunciarGeneral(mensajeGolBase, COLORES.DORADO, "bold");

            // Asistencia ya procesada arriba y incluida en el mensaje del gol - no enviar mensaje separado
        } else {
            statsGoleador.autogoles++;
            // Formato autogol igual que gol normal pero con "Gol en contra"
            const mensajeAutogol = `🔵 [${tiempoFormateado}]  ⚽💀 Gol en contra de ${nombreGoleador.toLowerCase()} • Velocidad de disparo: ${velocidadDisparo}km/h 🔵`;
            anunciarGeneral(mensajeAutogol, "FF6B6B", "bold");
        }

        // Ya no necesitamos el bloque separado de asistencias porque se maneja arriba
    }

    if (equipo === 1) {
        estadisticasPartido.golesRed++;
    } else {
        estadisticasPartido.golesBlue++;
    }

    // Actualizar replay después de cada gol
    actualizarReplay();
}

function calcularPuntuacion(jugador) {
    // Definir un sistema simple de puntuación basado en métricas clave
    const golesPuntos = jugador.goles * 3;
    const asistenciasPuntos = jugador.asistencias * 2;
    const autogolesPuntos = jugador.autogoles * -2;
    const tiempoPuntos = Math.min(jugador.tiempo / 60, 2); // Máximo 2 puntos por tiempo en partido

    // Sumar todas las métricas para obtener una puntuación provisional
    let puntuacion = golesPuntos + asistenciasPuntos + autogolesPuntos + tiempoPuntos;

    // BONIFICACIÓN POR VICTORIA - Determinar equipo ganador
    const equipoGanador = estadisticasPartido.golesRed > estadisticasPartido.golesBlue ? 1 : 
                         estadisticasPartido.golesBlue > estadisticasPartido.golesRed ? 2 : 0;
    
    // Aplicar bonificaciones
    if (jugador.autogoles === 0) {
        puntuacion = Math.max(puntuacion, 4); // Mínimo 4 si no hay autogoles
    }
    
    if (equipoGanador !== 0 && jugador.equipo === equipoGanador) {
        puntuacion = Math.max(puntuacion, 7); // Mínimo 7 si ganas
    }

    // Bloquear puntuación entre 1 y 10
    puntuacion = Math.max(1, Math.min(Math.round(puntuacion), 10));
    
    return puntuacion;
}

function calcularMejorJugador() {
    let mejorJugador = null;
    let mejorPuntuacion = -1;
    
    Object.values(estadisticasPartido.jugadores).forEach(jugador => {
        // Calcular puntuación por partido
        jugador.puntuacionPartido = calcularPuntuacion(jugador);

        if (jugador.puntuacionPartido > mejorPuntuacion) {
            mejorPuntuacion = jugador.puntuacionPartido;
            mejorJugador = jugador;
        }
    });
    
    return mejorJugador;
}

// FUNCIÓN PARA CORREGIR POSICIONES DE SPAWN - MEJORADA
function corregirPosicionesSpawn() {
    try {
        const jugadores = room.getPlayerList();
        const jugadoresEnEquipos = jugadores.filter(j => j.team === 1 || j.team === 2);
        
        if (jugadoresEnEquipos.length === 0) return;
        
        console.log(`🔧 DEBUG: Corrigiendo posiciones de spawn para ${jugadoresEnEquipos.length} jugadores en mapa ${mapaActual}`);
        
        // Obtener configuraciones específicas del mapa
        let configuracionMapa = {
            limiteArcoIzquierdo: -400,
            limiteArcoDerecho: 400,
            spawnDistanceCorrecta: 280,
            posicionSeguraRoja: { x: -200, y: 0 },
            posicionSeguraAzul: { x: 200, y: 0 }
        };
        
        // Ajustar configuraciones según el mapa actual
        switch(mapaActual) {
            case 'biggerx7':
                configuracionMapa = {
                    limiteArcoIzquierdo: -1000,
                    limiteArcoDerecho: 1000,
                    spawnDistanceCorrecta: 300,
                    posicionSeguraRoja: { x: -400, y: 0 },
                    posicionSeguraAzul: { x: 400, y: 0 }
                };
                break;
            case 'biggerx5':
                configuracionMapa = {
                    limiteArcoIzquierdo: -650,
                    limiteArcoDerecho: 650,
                    spawnDistanceCorrecta: 400,
                    posicionSeguraRoja: { x: -300, y: 0 },
                    posicionSeguraAzul: { x: 300, y: 0 }
                };
                break;
            case 'biggerx3':
                configuracionMapa = {
                    limiteArcoIzquierdo: -480,
                    limiteArcoDerecho: 480,
                    spawnDistanceCorrecta: 400,
                    posicionSeguraRoja: { x: -200, y: 0 },
                    posicionSeguraAzul: { x: 200, y: 0 }
                };
                break;
            case 'biggerx1':
                configuracionMapa = {
                    limiteArcoIzquierdo: -320,
                    limiteArcoDerecho: 320,
                    spawnDistanceCorrecta: 280,
                    posicionSeguraRoja: { x: -150, y: 0 },
                    posicionSeguraAzul: { x: 150, y: 0 }
                };
                break;
        }
        
        // Contador de correcciones realizadas
        let correccionesRealizadas = 0;
        
        // Verificar y corregir jugadores que están mal posicionados
        jugadoresEnEquipos.forEach(jugador => {
            if (!jugador.position) {
                console.log(`⚠️ DEBUG: Jugador ${jugador.name} no tiene posición, usando posición segura por defecto`);
                // Asignar posición segura según equipo
                const posicionSegura = jugador.team === 1 ? configuracionMapa.posicionSeguraRoja : configuracionMapa.posicionSeguraAzul;
                try {
                    room.setPlayerDiscProperties(jugador.id, {
                        x: posicionSegura.x,
                        y: posicionSegura.y
                    });
                    correccionesRealizadas++;
                    console.log(`✅ DEBUG: Posición segura asignada a ${jugador.name} en (${posicionSegura.x}, ${posicionSegura.y})`);
                } catch (error) {
                    console.error(`❌ DEBUG: Error asignando posición segura a ${jugador.name}:`, error);
                }
                return;
            }
            
            const posX = jugador.position.x;
            const posY = jugador.position.y;
            let necesitaCorreccion = false;
            let nuevaX = posX;
            let nuevaY = posY;
            
            // Verificar si está demasiado cerca del arco (caso principal del problema)
            if (jugador.team === 1) {
                // Equipo rojo: no debe estar muy cerca del arco izquierdo
                if (posX < configuracionMapa.limiteArcoIzquierdo + 200) {
                    nuevaX = configuracionMapa.posicionSeguraRoja.x;
                    necesitaCorreccion = true;
                    console.log(`🔧 DEBUG: Jugador rojo ${jugador.name} demasiado cerca del arco (x:${posX}) -> moviendo a posición segura (x:${nuevaX})`);
                }
            } else if (jugador.team === 2) {
                // Equipo azul: no debe estar muy cerca del arco derecho
                if (posX > configuracionMapa.limiteArcoDerecho - 200) {
                    nuevaX = configuracionMapa.posicionSeguraAzul.x;
                    necesitaCorreccion = true;
                    console.log(`🔧 DEBUG: Jugador azul ${jugador.name} demasiado cerca del arco (x:${posX}) -> moviendo a posición segura (x:${nuevaX})`);
                }
            }
            
            // También corregir posiciones Y extremas (fuera del campo)
            if (Math.abs(posY) > 250) {
                nuevaY = 0; // Posición central en Y
                necesitaCorreccion = true;
                console.log(`🔧 DEBUG: Corrigiendo posición Y extrema de ${jugador.name} desde y:${posY} a y:${nuevaY}`);
            }
            
            // Aplicar corrección si es necesaria
            if (necesitaCorreccion) {
                try {
                    room.setPlayerDiscProperties(jugador.id, {
                        x: nuevaX,
                        y: nuevaY
                    });
                } catch (error) {
                    console.log(`❌ Error corrigiendo posición de ${jugador.name}:`, error);
                }
            }
        });
        
        console.log(`✅ DEBUG: Corrección de posiciones de spawn completada`);
        
    } catch (error) {
        console.log("❌ Error en corregirPosicionesSpawn:", error);
    }
}

function detectarArqueros() {
    // Lógica simplificada: el jugador más cercano al arco
    const jugadores = room.getPlayerList();
    let arqueroRed = null, arqueroBlue = null;
    
    jugadores.forEach(jugador => {
        if (jugador.team === 1 && jugador.position) {
            if (!arqueroRed || jugador.position.x < arqueroRed.position.x) {
                arqueroRed = jugador;
            }
        } else if (jugador.team === 2 && jugador.position) {
            if (!arqueroBlue || jugador.position.x > arqueroBlue.position.x) {
                arqueroBlue = jugador;
            }
        }
    });
    
    if (arqueroRed) {
        estadisticasPartido.arqueroRed = arqueroRed.name;
        const stats = estadisticasPartido.jugadores[arqueroRed.id];
        if (stats) stats.arquero = true;
    }
    
    if (arqueroBlue) {
        estadisticasPartido.arqueroBlue = arqueroBlue.name;
        const stats = estadisticasPartido.jugadores[arqueroBlue.id];
        if (stats) stats.arquero = true;
    }
}

// FUNCIÓN PARA ACTUALIZAR REPLAY (durante el partido)
function actualizarReplay() {
    try {
        // Durante el partido, solo usar getReplay para no interrumpir la grabación
        if (typeof room.getReplay === 'function') {
            replayData = room.getReplay();
        }
        
        if (replayData) {
            replayActual = `Replay_${Date.now()}_${estadisticasPartido.golesRed}_${estadisticasPartido.golesBlue}`;
        } else {
            // Crear identificador para el replay aunque no tengamos datos
            replayActual = `Replay_${Date.now()}_${estadisticasPartido.golesRed}_${estadisticasPartido.golesBlue}`;
        }
    } catch (error) {
        replayActual = `Replay_${Date.now()}_${estadisticasPartido.golesRed}_${estadisticasPartido.golesBlue}_error`;
    }
}

// FUNCIÓN PARA FINALIZAR REPLAY (al terminar el partido)
function finalizarReplay() {
    try {
        // Al final del partido, detener definitivamente la grabación
        if (typeof room.stopRecording === 'function') {
            replayData = room.stopRecording();
            console.log("🎬 Grabación de replay finalizada");
        } else if (typeof room.getReplay === 'function') {
            replayData = room.getReplay();
        }
        
        if (replayData) {
            replayActual = `Replay_${Date.now()}_${estadisticasPartido.golesRed}_${estadisticasPartido.golesBlue}`;
            console.log(`🎬 Replay final capturado: ${replayActual}`);
        } else {
            // Crear identificador para el replay aunque no tengamos datos
            replayActual = `Replay_${Date.now()}_${estadisticasPartido.golesRed}_${estadisticasPartido.golesBlue}`;
            console.log(`⚠️ Replay final sin datos: ${replayActual}`);
        }
    } catch (error) {
        console.log("❌ Error al finalizar replay:", error);
        replayActual = `Replay_${Date.now()}_${estadisticasPartido.golesRed}_${estadisticasPartido.golesBlue}_error`;
    }
}

// FUNCIÓN PARA GUARDAR REPLAY EN PC (solo para referencia)
function guardarReplayEnPC() {
    if (!guardarReplaysEnPC) return;
    
    try {
        if (replayData && typeof window !== 'undefined' && window.URL) {
            // Solo funciona en navegador
            const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const nombreArchivo = `LNB_${fecha}_${estadisticasPartido.golesRed}-${estadisticasPartido.golesBlue}.hbr2`;
            
            const blob = new Blob([replayData], { type: 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreArchivo;
            a.click();
            window.URL.revokeObjectURL(url);
            
            anunciarExito(`💾 Replay guardado: ${nombreArchivo}`);
        } else {
        }
    } catch (error) {
    }
}

// FUNCIÓN PARA ENVIAR REPORTE A DISCORD CON REPLAY
function enviarReportePartidoDiscord() {
    // Evitar envíos duplicados
    if (reporteEnviado) {
        return;
    }
    
    // Validar duración mínima del partido
    // EXCEPCIÓN: Si el partido terminó por diferencia de gol (límite alcanzado), enviar igual
    const scores = room.getScores();
    const terminoPorGoles = scores && scores.scoreLimit > 0 && 
        (estadisticasPartido.golesRed >= scores.scoreLimit || estadisticasPartido.golesBlue >= scores.scoreLimit);
    
    // Debug: Mostrar información de scores para diagnosticar
    
    // Verificar límite de goles del mapa actual como respaldo
    let limiteGolesRespaldo = 0;
    if (mapaActual === "biggerx1") {
        limiteGolesRespaldo = 3;
    } else if (mapaActual === "biggerx3") {
        limiteGolesRespaldo = 5;
    } else if (mapaActual === "biggerx5") {
        limiteGolesRespaldo = 4;
    } else if (mapaActual === "biggerx7") {
        limiteGolesRespaldo = 5;
    }
    
    const terminoPorGolesRespaldo = limiteGolesRespaldo > 0 && 
        (estadisticasPartido.golesRed >= limiteGolesRespaldo || estadisticasPartido.golesBlue >= limiteGolesRespaldo);
    
    
    const terminoEfectivoPorGoles = terminoPorGoles || terminoPorGolesRespaldo;
    
    if (estadisticasPartido.duracion < segundosMinimoPartido && !terminoEfectivoPorGoles) {
        anunciarInfo(`⚠️ Partido muy corto para generar reporte (${Math.floor(estadisticasPartido.duracion/60)}:${(estadisticasPartido.duracion%60).toString().padStart(2,'0')} < ${Math.floor(segundosMinimoPartido/60)}:${(segundosMinimoPartido%60).toString().padStart(2,'0')})`);
        return;
    }
    
    // Si terminó por goles y fue corto, mostrar mensaje explicativo
    if (estadisticasPartido.duracion < segundosMinimoPartido && terminoEfectivoPorGoles) {
        // Mensaje removido
    }
    
    if (!validarMapaPersonalizado()) return;
    
    const duracionMinutos = Math.floor(estadisticasPartido.duracion / 60);
    const duracionSegundos = estadisticasPartido.duracion % 60;
    
    // Verificar si debe enviar replay
    const debeEnviarReplay = enviarReplaysDiscord && guardarReplaysAmistosos;
    
    // Generar reporte con la nueva estética
    const mejorJugador = calcularMejorJugador();
    
    // Separar jugadores por equipos
    const jugadoresRed = Object.values(estadisticasPartido.jugadores).filter(j => j.equipo === 1);
    const jugadoresBlue = Object.values(estadisticasPartido.jugadores).filter(j => j.equipo === 2);
    
    // Crear listas de jugadores para cada equipo
    const listaRed = jugadoresRed.map(j => j.nombre).join(" - ") || "Sin jugadores";
    const listaBlue = jugadoresBlue.map(j => j.nombre).join(" - ") || "Sin jugadores";
    
// Crear lista de goles RED (incluir autogoles de jugadores del equipo contrario)
    let golesRed = [];
    
    // Goles normales del equipo rojo
    jugadoresRed.forEach(j => {
        if (j.goles > 0) {
            golesRed.push(`${j.nombre} x${j.goles}`);
        }
    });
    
    // Autogoles del equipo azul que suman al rojo
    jugadoresBlue.forEach(j => {
        if (j.autogoles > 0) {
            golesRed.push(`${j.nombre} (e/c) x${j.autogoles}`);
        }
    });
    
    const golesRedTexto = golesRed.join(", ") || "---";

    // Crear lista de goles BLUE (incluir autogoles de jugadores del equipo contrario)
    let golesBlue = [];
    
    // Goles normales del equipo azul
    jugadoresBlue.forEach(j => {
        if (j.goles > 0) {
            golesBlue.push(`${j.nombre} x${j.goles}`);
        }
    });
    
    // Autogoles del equipo rojo que suman al azul
    jugadoresRed.forEach(j => {
        if (j.autogoles > 0) {
            golesBlue.push(`${j.nombre} (e/c) x${j.autogoles}`);
        }
    });
    
    const golesBlueTexto = golesBlue.join(", ") || "---";
    
    // Crear lista de asistencias RED
    const asistenciasRed = jugadoresRed
        .filter(j => j.asistencias > 0)
        .map(j => `${j.nombre} x${j.asistencias}`)
        .join(", ");
    
    // Crear lista de asistencias BLUE
    const asistenciasBlue = jugadoresBlue
        .filter(j => j.asistencias > 0)
        .map(j => `${j.nombre} x${j.asistencias}`)
        .join(", ");
    
    // Crear top 3 mejores jugadores (excluyendo al MVP)
    const todosJugadores = Object.values(estadisticasPartido.jugadores)
        .filter(j => mejorJugador ? j.nombre !== mejorJugador.nombre : true)
        .map(j => ({...j, puntuacion: (j.goles * 3) + (j.asistencias * 2) - (j.autogoles * 2)}))
        .sort((a, b) => b.puntuacion - a.puntuacion)
        .slice(0, 3);
    
    const top3 = todosJugadores.map(j => j.nombre).join(", ");
    
    // Calcular tiempos de valla invicta correctamente
    let tiempoVallaRealRed, tiempoVallaRealBlue;
    
    if (estadisticasPartido.golesBlue === 0) {
        // Equipo rojo no recibió goles: tiempo total del partido
        const scores = room.getScores();
        tiempoVallaRealRed = scores ? Math.floor(scores.time) : estadisticasPartido.duracion;
    } else {
        // Equipo rojo recibió goles: tiempo hasta el primer gol
        tiempoVallaRealRed = estadisticasPartido.tiempoVallaInvictaRed;
    }
    
    if (estadisticasPartido.golesRed === 0) {
        // Equipo azul no recibió goles: tiempo total del partido
        const scores = room.getScores();
        tiempoVallaRealBlue = scores ? Math.floor(scores.time) : estadisticasPartido.duracion;
    } else {
        // Equipo azul recibió goles: tiempo hasta el primer gol
        tiempoVallaRealBlue = estadisticasPartido.tiempoVallaInvictaBlue;
    }
    
    // Asegurar que los tiempos no sean negativos
    tiempoVallaRealRed = Math.max(0, tiempoVallaRealRed);
    tiempoVallaRealBlue = Math.max(0, tiempoVallaRealBlue);
    
    const minVallaRed = Math.floor(tiempoVallaRealRed / 60);
    const segVallaRed = tiempoVallaRealRed % 60;
    const minVallaBlue = Math.floor(tiempoVallaRealBlue / 60);
    const segVallaBlue = tiempoVallaRealBlue % 60;
    
    // Generar el reporte con la nueva estética
    const reporteTexto = `RED  ${estadisticasPartido.golesRed} - ${estadisticasPartido.golesBlue}  BLUE
🔴 :  ${listaRed}
🔵 :  ${listaBlue}

⚽🔴 : ${golesRedTexto || "---"}
👟🔴 : ${asistenciasRed || "---"}
🥅🔴 : ${estadisticasPartido.arqueroRed || "---"} ${minVallaRed}:${segVallaRed.toString().padStart(2, "0")}

⚽🔵 : ${golesBlueTexto || "---"}
👟🔵 : ${asistenciasBlue || "---"}
🥅🔵 : ${estadisticasPartido.arqueroBlue || "---"} ${minVallaBlue}:${segVallaBlue.toString().padStart(2, "0")}

⭐ : ${mejorJugador ? mejorJugador.nombre : "---"}

🏅 : ${top3 || "---"}

Script by ИФT`;
    
    const embed = {
        title: "🏆 REPORTE DE PARTIDO LNB",
        description: reporteTexto,
        color: parseInt(AZUL_LNB, 16),
        fields: [
            {
                name: "🗺️ Mapa",
                value: mapas[mapaActual].nombre,
                inline: true
            },
            {
                name: "⏱️ Duración",
                value: `${duracionMinutos}:${duracionSegundos.toString().padStart(2, "0")}`,
                inline: true
            }
        ],
        footer: {
            text: "Liga Nacional de Bigger LNB • " + new Date().toLocaleString()
        }
    };
    
    
    // Payload base
    const payload = {
content: "",
        embeds: [embed]
    };

    // Enviar primero el informe de estadísticas
    enviarInforme(payload, debeEnviarReplay);
}

// FUNCIÓN PARA LIBERAR BLOQUEO DE REPLAY
function liberarBloqueoReplay(mensaje = "Envío de replay completado") {
    console.log(`🔓 DEBUG: ${mensaje} - liberando bloqueo`);
    bloqueadoPorReplay = false;
    intentosAutoStartBloqueados = 0;
    
    // Verificar auto-start después de liberar el bloqueo
    setTimeout(() => {
        console.log(`🔓 DEBUG: Verificando auto-start después de liberar bloqueo`);
        verificarAutoStart();
    }, 1000);
}

// FUNCIÓN PARA ENVIAR INFORME PRIMERO
function enviarInforme(payload, debeEnviarReplay) {
    // Seleccionar webhook según modo oficial
    const webhookUrl = discordWebhook;
    
    if (webhookUrl && webhookUrl.length > 0) {
        fetch(webhookUrl, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.ok) {
                anunciarExito("📤 Informe de estadísticas enviado a Discord");
                
                // Si debe enviar replay, enviarlo después del informe
                if (debeEnviarReplay && replayData && typeof FormData !== 'undefined') {
                    setTimeout(() => {
                        enviarReplay();
                    }, 1000); // Reducir espera entre informe y replay
                } else {
                    reporteEnviado = true; // Marcar como completado si no hay replay
                    liberarBloqueoReplay("Informe enviado sin replay");
                }
            } else {
                anunciarError("❌ Error al enviar informe a Discord", null);
                reporteEnviado = true;
                liberarBloqueoReplay("Error al enviar informe");
            }
        })
        .catch(error => {
            anunciarError("❌ Error de conexión al enviar informe a Discord", null);
            reporteEnviado = true;
            liberarBloqueoReplay("Error de conexión al enviar informe");
        });
    } else {
        console.log("❌ DEBUG: No hay webhook configurado para enviar informe");
        reporteEnviado = true;
        liberarBloqueoReplay("No hay webhook configurado");
    }
}

// FUNCIÓN PARA ENVIAR REPLAY SEPARADO
function enviarReplay() {
    try {
        const formData = new FormData();
        
        // Crear archivo de replay
        const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const nombreArchivo = `LNB_${fecha}_${estadisticasPartido.golesRed}-${estadisticasPartido.golesBlue}.hbr2`;
        const blob = new Blob([replayData], { type: 'application/octet-stream' });
        
        // Payload vacío para el replay (solo archivo)
        const replayPayload = {
            content: ""
        };
        
        formData.append('payload_json', JSON.stringify(replayPayload));
        formData.append('files[0]', blob, nombreArchivo);
        
        // Seleccionar webhook según modo oficial
        const webhookUrl = discordWebhook;
        
        fetch(webhookUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (response.ok) {
                reporteEnviado = true; // Marcar como completado
                anunciarExito("🎬 Replay enviado a Discord exitosamente");
                liberarBloqueoReplay("Replay enviado exitosamente");
            } else {
                anunciarError("❌ Error al enviar replay a Discord", null);
                reporteEnviado = true; // Marcar como completado aunque falle el replay
                liberarBloqueoReplay("Error al enviar replay");
            }
        })
        .catch(error => {
            anunciarError("❌ Error de conexión al enviar replay a Discord", null);
            reporteEnviado = true; // Marcar como completado aunque falle el replay
            liberarBloqueoReplay("Error de conexión al enviar replay");
        });
    } catch (error) {
        reporteEnviado = true; // Marcar como completado aunque falle el replay
        liberarBloqueoReplay("Excepción al enviar replay");
    }
}

// FUNCIÓN PARA ENVIAR CON REPLAY (solo navegador)
function enviarConReplay(payload) {
    try {
        const formData = new FormData();
        
        // Crear archivo de replay
        const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const nombreArchivo = `LNB_${fecha}_${estadisticasPartido.golesRed}-${estadisticasPartido.golesBlue}.hbr2`;
        const blob = new Blob([replayData], { type: 'application/octet-stream' });
        
        formData.append('payload_json', JSON.stringify(payload));
        formData.append('files[0]', blob, nombreArchivo);
        
        fetch(discordWebhook, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (response.ok) {
                reporteEnviado = true; // Marcar como enviado exitosamente
                anunciarExito("📤 Reporte y replay enviados a Discord exitosamente");
                liberarBloqueoReplay("Reporte y replay enviados exitosamente");
            } else {
                anunciarError("❌ Error al enviar reporte con replay a Discord", null);
                // Intentar envío sin replay como respaldo
                enviarSinReplay(payload, false);
            }
        })
        .catch(error => {
            anunciarError("❌ Error de conexión al enviar replay a Discord", null);
            // Intentar envío sin replay como respaldo
            enviarSinReplay(payload, false);
        });
    } catch (error) {
        enviarSinReplay(payload, false);
    }
}

// FUNCIÓN PARA ENVIAR SIN REPLAY
function enviarSinReplay(payload, incluyeNotaReplay = false) {
    if (incluyeNotaReplay) {
        payload.content += "\n🎬 *Replay disponible - contacta admin para obtenerlo*";
    }
    
    // Seleccionar webhook según modo oficial
    const webhookUrl = modoOficial ? webhookOficial : discordWebhook;
    
    if (webhookUrl && webhookUrl.length > 0) {
        fetch(webhookUrl, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.ok) {
                reporteEnviado = true; // Marcar como enviado exitosamente
                const mensaje = incluyeNotaReplay ? 
                    "📤 Reporte enviado a Discord (replay disponible localmente)" : 
                    "📤 Reporte enviado a Discord exitosamente";
                anunciarExito(mensaje);
                liberarBloqueoReplay("Reporte enviado sin replay");
            } else {
                anunciarError("❌ Error al enviar reporte a Discord", null);
                reporteEnviado = true;
                liberarBloqueoReplay("Error al enviar reporte sin replay");
            }
        })
        .catch(error => {
            anunciarError("❌ Error de conexión con Discord", null);
            reporteEnviado = true;
            liberarBloqueoReplay("Error de conexión al enviar reporte sin replay");
        });
    }
}

// FUNCIÓN PARA LLAMAR ADMIN
function llamarAdmin(jugador, mensaje) {
// Verificar número mínimo de jugadores (5)
    const jugadores = room.getPlayerList();
    const jugadoresEnHost = jugadores.filter(j => !esBot(j)).length;
    if (jugadoresEnHost < 5) {
        anunciarError("❌ Se necesitan al menos 5 jugadores para llamar admin", jugador);
        return;
    }

    // Verificar cooldown de 30 minutos
    const tiempoActual = Date.now();
    const tiempoRestanteCooldown = cooldownLlamarAdmin.duracionCooldown - (tiempoActual - cooldownLlamarAdmin.ultimoUso);
    
    if (tiempoRestanteCooldown > 0) {
        const minutosRestantes = Math.ceil(tiempoRestanteCooldown / (60 * 1000));
anunciarError(`⏰ El comando !llamaradmin está en cooldown. Tiempo restante: ${minutosRestantes} minutos`, jugador);
        return;
    }
    
    
    // Obtener jugadores activos en los equipos
    const jugadoresEnEquipos = jugadores.filter(j => j.team === 1 || j.team === 2);
    const totalJugadores = jugadoresEnEquipos.length;
    
    // Definir votantes mínimos según el mapa
    let votantesMinimos;
    if (mapaActual === "biggerx5") {
        votantesMinimos = 5;
    } else if (mapaActual === "biggerx7") {
        votantesMinimos = 8;
    } else {
        votantesMinimos = 3; // Por defecto para otros mapas
    }
    
    // Verificar si hay suficientes jugadores para la votación
    if (totalJugadores < votantesMinimos) {
anunciarError(`❌ Se necesitan al menos ${votantesMinimos} jugadores en ${mapaActual} para usar !llamaradmin. Actualmente hay ${totalJugadores}`, jugador);
        return;
    }
    
    // Verificar si ya hay una votación activa
    if (votacionLlamarAdmin.activa) {
        // Si es el mismo jugador, mostrar estado
        if (votacionLlamarAdmin.iniciador.id === jugador.id) {
            const tiempoRestante = Math.max(0, 60 - Math.floor((Date.now() - votacionLlamarAdmin.tiempoInicio) / 1000));
            anunciarInfo(`⏳ Tu votación está activa. Votos: ${votacionLlamarAdmin.votos.size}/${votantesMinimos}. Tiempo restante: ${tiempoRestante}s`);
            return;
        }
        
        // Si es otro jugador, verificar si ya votó
        if (votacionLlamarAdmin.votos.has(jugador.id)) {
anunciarError("❌ Ya has votado en la votación actual", jugador);
            return;
        }
        
        // Agregar voto
        votacionLlamarAdmin.votos.add(jugador.id);
        anunciarInfo(`🗳️ ${jugador.name} votó para llamar admin. Votos: ${votacionLlamarAdmin.votos.size}/${votantesMinimos}`);
        
        // Verificar si se alcanzó el mínimo
        if (votacionLlamarAdmin.votos.size >= votantesMinimos) {
            enviarSolicitudAdmin(votacionLlamarAdmin.iniciador, votacionLlamarAdmin.mensaje, votacionLlamarAdmin.votos.size);
            limpiarVotacion();
        }
        return;
    }
    
    // Iniciar nueva votación
    votacionLlamarAdmin = {
        activa: true,
        iniciador: jugador,
        mensaje: mensaje,
        votos: new Set([jugador.id]), // El iniciador vota automáticamente
        tiempoInicio: Date.now(),
        timeout: null
    };
    
    // Configurar timeout de 60 segundos
    votacionLlamarAdmin.timeout = setTimeout(() => {
        if (votacionLlamarAdmin.activa) {
anunciarAdvertencia(`⏰ Tiempo agotado para la votación de llamar admin. Se obtuvieron ${votacionLlamarAdmin.votos.size}/${votantesMinimos} votos`, jugador);
            limpiarVotacion();
        }
    }, 60000);
    
    // Anunciar votación
anunciarAdvertencia(`🚨 ${jugador.name} quiere llamar a un admin: "${mensaje}"`, jugador);
    anunciarInfo(`🗳️ Escriban !llamaradmin para votar. Se necesitan ${votantesMinimos} votos. Tiempo: 60 segundos`);
    anunciarInfo(`📊 Votos actuales: 1/${votantesMinimos}`);
}

// FUNCIÓN PARA ENVIAR SOLICITUD DE ADMIN
function enviarSolicitudAdmin(iniciador, mensaje, totalVotos) {
    const embed = {
        title: "🚨 SOLICITUD DE ADMIN APROBADA",
        description: `**Jugador:** ${iniciador.name}\n**Mensaje:** ${mensaje}\n**Votos obtenidos:** ${totalVotos}\n**Mapa:** ${mapas[mapaActual].nombre}`,
        color: parseInt("FF0000", 16), // Color rojo para alertas
        timestamp: new Date().toISOString(),
        footer: {
            text: "Liga Nacional de Bigger LNB • Solicitud de Admin"
        }
    };
    
    const payload = {
        content: "🚨 **UN JUGADOR NECESITA AYUDA DE UN ADMIN** 🚨 <@&1389653604461183037>",
        embeds: [embed]
    };
    
    if (webhookLlamarAdmin && webhookLlamarAdmin.length > 0) {
        fetch(webhookLlamarAdmin, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.ok) {
                // Activar cooldown después del envío exitoso
                cooldownLlamarAdmin.ultimoUso = Date.now();
                anunciarExito(`🚨 ¡Solicitud de admin enviada con ${totalVotos} votos!`);
                anunciarInfo("📱 Un admin será notificado en Discord y vendrá a ayudarte");
                anunciarInfo("⏰ Cooldown de 30 minutos activado para próximas solicitudes");
            } else {
anunciarError("❌ Error al enviar mensaje a los administradores", null);
            }
        })
        .catch(error => {
anunciarError("❌ Error de conexión al enviar mensaje a admins", null);
        });
    } else {
anunciarError("❌ Webhook de administradores no configurado", null);
    }
}

// FUNCIÓN PARA LIMPIAR VOTACIÓN
function limpiarVotacion() {
    if (votacionLlamarAdmin.timeout) {
        clearTimeout(votacionLlamarAdmin.timeout);
    }
    votacionLlamarAdmin = {
        activa: false,
        iniciador: null,
        mensaje: "",
        votos: new Set(),
        tiempoInicio: 0,
        timeout: null
    };
}

// FUNCIÓN PARA ENVIAR NOTIFICACIÓN DE CLEARBANS AL WEBHOOK
function enviarNotificacionClearBans(adminNombre, tipoLimpieza, jugadoresLimpiados, ipsLimpiadas) {
    if (!webhookBanKick || webhookBanKick.length === 0) {
        return;
    }
    
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-AR');
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    
    let mensaje = "";
    let accionTexto = "";
    let detalles = "";
    
    switch (tipoLimpieza) {
        case "completa":
            accionTexto = "ejecutó limpieza COMPLETA de baneos";
            detalles = `🧹 Todos los baneos de HaxBall limpiados + ${ipsLimpiadas} IP(s) desbloqueadas | 💡 Resuelve desincronizaciones BD/HaxBall`;
            break;
        case "masiva":
            accionTexto = "ejecutó limpieza MASIVA de baneos";
            detalles = `🔨 ${jugadoresLimpiados} jugadores desbaneados + ${ipsLimpiadas} IP(s) limpiadas`;
            break;
        case "masiva_solo_haxball":
            accionTexto = "ejecutó limpieza MASIVA (solo HaxBall)";
            detalles = `🔨 ${jugadoresLimpiados} jugadores procesados | ⚠️ BD no actualizada`;
            break;
        case "alternativa_24h":
            accionTexto = "ejecutó limpieza de baneos (24h)";
            detalles = `⏰ ${jugadoresLimpiados} jugadores de últimas 24h procesados`;
            break;
        default:
            accionTexto = "ejecutó limpieza de baneos";
            detalles = `${jugadoresLimpiados} jugadores procesados`;
    }
    
    mensaje = `\`\`\`🧹 [${fecha}, ${hora}] 🛡️ ${adminNombre} ${accionTexto} | ${detalles}\`\`\``;
    
    const payload = {
        content: mensaje
    };
    
    fetch(webhookBanKick, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
            console.log(`📤 Notificación de clearbans enviada a Discord: ${tipoLimpieza}`);
        } else {
            console.error(`❌ Error enviando notificación clearbans: ${response.status}`);
        }
    })
    .catch(error => {
        console.error(`❌ Error de conexión enviando notificación clearbans:`, error);
    });
}

// FUNCIÓN PARA ENVIAR NOTIFICACIÓN DE BAN/KICK AL WEBHOOK
function enviarNotificacionBanKick(tipo, adminNombre, jugadorNombre, jugadorID, duracion = null, razon = "No especificada", ipJugador = null) {
    if (!webhookBanKick || webhookBanKick.length === 0) {
        return;
    }
    
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-AR');
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    
    let mensaje = "";
    let accionTexto = "";
    
    // Preparar información de IP si está disponible
    const infoIP = ipJugador ? ` | 🌐 IP: ${ipJugador}` : "";
    
    if (tipo === "ban") {
        accionTexto = "baneó a";
        if (duracion) {
            mensaje = `\`\`\`⛔ [${fecha}, ${hora}] 🔨 ${adminNombre} (ID: ${room.getPlayerList().find(p => p.name === adminNombre)?.id || 'N/A'}) ${accionTexto} ${jugadorNombre} (ID: ${jugadorID}) por 🕒 ${duracion}${infoIP} | 📄 Motivo: ${razon}\`\`\``;
        } else {
            mensaje = `\`\`\`⛔ [${fecha}, ${hora}] 🔨 ${adminNombre} (ID: ${room.getPlayerList().find(p => p.name === adminNombre)?.id || 'N/A'}) ${accionTexto} ${jugadorNombre} (ID: ${jugadorID}) permanentemente${infoIP} | 📄 Motivo: ${razon}\`\`\``;
        }
    } else if (tipo === "kick") {
        accionTexto = "expulsó a";
        mensaje = `\`\`\`⛔ [${fecha}, ${hora}] 🦵 ${adminNombre} (ID: ${room.getPlayerList().find(p => p.name === adminNombre)?.id || 'N/A'}) ${accionTexto} ${jugadorNombre} (ID: ${jugadorID})${infoIP} | 📄 Motivo: ${razon}\`\`\``;
    }
    
    const payload = {
        content: mensaje
    };
    
    fetch(webhookBanKick, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
        } else {
        }
    })
    .catch(error => {
    });
}

// FUNCIÓN PARA MOSTRAR PUNTUACIONES DEL PARTIDO
function mostrarPuntuacionesPartido() {
    if (!estadisticasPartido.iniciado) return;
    
    // Obtener todos los jugadores con sus puntuaciones
    const jugadoresConPuntuacion = Object.values(estadisticasPartido.jugadores)
        .map(jugador => ({
            ...jugador,
            puntuacion: calcularPuntuacion(jugador)
        }))
        .sort((a, b) => b.puntuacion - a.puntuacion);
    
    // Mostrar top 3 puntuaciones
    anunciarGeneral("🏆 ══════════ PUNTUACIONES DEL PARTIDO ══════════ 🏆", COLORES.DORADO, "bold");
    
    jugadoresConPuntuacion.slice(0, 3).forEach((jugador, index) => {
        const medallas = ["🥇", "🥈", "🥉"];
        const medalla = medallas[index] || "🏅";
        const equipoColor = jugador.equipo === 1 ? "🔴" : "🔵";
        
        anunciarGeneral(
            `${medalla} ${equipoColor} ${jugador.nombre}: ${jugador.puntuacion}/10 (⚽${jugador.goles} 🎯${jugador.asistencias})`,
            COLORES.DORADO,
            "bold"
        );
    });
    
    // Mostrar puntuaciones de todos los demás jugadores
    if (jugadoresConPuntuacion.length > 3) {
        anunciarGeneral("📊 Otras puntuaciones:", COLORES.INFO);
        
        jugadoresConPuntuacion.slice(3).forEach(jugador => {
            const equipoColor = jugador.equipo === 1 ? "🔴" : "🔵";
            anunciarGeneral(
                `${equipoColor} ${jugador.nombre}: ${jugador.puntuacion}/10`,
                COLORES.GRIS
            );
        });
    }
    
    anunciarGeneral("═══════════════════════════════════════════════════════", COLORES.DORADO, "bold");
}

// FUNCIÓN PARA ENVIAR PUNTUACIONES PRIVADAS AL FINALIZAR PARTIDO
function enviarPuntuacionesPrivadas() {
    if (!estadisticasPartido.iniciado) return;
    
    // Obtener todos los jugadores conectados
    const jugadoresConectados = room.getPlayerList();
    
    // Enviar puntuación a cada jugador que participó en el partido
    Object.entries(estadisticasPartido.jugadores).forEach(([playerId, statsJugador]) => {
        // Verificar si el jugador aún está conectado
        const jugadorConectado = jugadoresConectados.find(j => j.id === parseInt(playerId));
        
        if (jugadorConectado) {
            const puntuacion = calcularPuntuacion(statsJugador);
            const equipoColor = statsJugador.equipo === 1 ? "🔴" : "🔵";
            
            // Determinar el mensaje según la puntuación
            let mensajeCalificacion = "";
            if (puntuacion >= 9) {
                mensajeCalificacion = "🌟 ¡EXCELENTE PARTIDO!";
            } else if (puntuacion >= 7) {
                mensajeCalificacion = "👏 ¡Muy buen partido!";
            } else if (puntuacion >= 5) {
                mensajeCalificacion = "👍 Buen partido";
            } else if (puntuacion >= 3) {
                mensajeCalificacion = "📈 Puedes mejorar";
            } else {
                mensajeCalificacion = "💪 ¡Sigue practicando!";
            }
            
            // Enviar mensajes privados al jugador
            room.sendAnnouncement(
                `🏆 ══════════ TU RENDIMIENTO EN EL PARTIDO ══════════ 🏆`,
                jugadorConectado.id,
                parseInt(COLORES.DORADO, 16),
                "bold",
                0
            );
            
            room.sendAnnouncement(
                `📊 PUNTUACIÓN FINAL: ${puntuacion}/10 ${mensajeCalificacion}`,
                jugadorConectado.id,
                parseInt(COLORES.DORADO, 16),
                "bold",
                0
            );
            
            room.sendAnnouncement(
                `${equipoColor} ⚽ Goles: ${statsJugador.goles} | 🎯 Asistencias: ${statsJugador.asistencias} | 💀 Autogoles: ${statsJugador.autogoles}`,
                jugadorConectado.id,
                parseInt(COLORES.INFO, 16),
                "normal",
                0
            );
            
            // Mensaje adicional según el rol del jugador (removido mensaje de arquero)
            
            room.sendAnnouncement(
                `═══════════════════════════════════════════════════════`,
                jugadorConectado.id,
                parseInt(COLORES.DORADO, 16),
                "bold",
                0
            );
        }
    });
}

// Función duplicada eliminada - solo mantenemos la función principal

function compararEstadisticas(solicitante, nombre1, nombre2) {
    const stats1 = Object.values(estadisticasGlobales.jugadores).find(j => j.nombre.toLowerCase() === nombre1.toLowerCase());
    const stats2 = Object.values(estadisticasGlobales.jugadores).find(j => j.nombre.toLowerCase() === nombre2.toLowerCase());

    if (!stats1) {
        anunciarError(`No se encontraron estadísticas para ${nombre1}`, solicitante);
        return;
    }
    if (!stats2) {
        anunciarError(`No se encontraron estadísticas para ${nombre2}`, solicitante);
        return;
    }

    const w_r1 = stats1.partidos > 0 ? ((stats1.victorias / stats1.partidos) * 100).toFixed(1) : "0";
    const w_r2 = stats2.partidos > 0 ? ((stats2.victorias / stats2.partidos) * 100).toFixed(1) : "0";

    const gpp1 = stats1.partidos > 0 ? (stats1.goles / stats1.partidos).toFixed(2) : "0";
    const gpp2 = stats2.partidos > 0 ? (stats2.goles / stats2.partidos).toFixed(2) : "0";

    const app1 = stats1.partidos > 0 ? (stats1.asistencias / stats1.partidos).toFixed(2) : "0";
    const app2 = stats2.partidos > 0 ? (stats2.asistencias / stats2.partidos).toFixed(2) : "0";

    const lineas = [
        `📊 COMPARATIVA: ${stats1.nombre} vs ${stats2.nombre}`,
        `------------------------------------------`,
        `Partidos: ${stats1.partidos} vs ${stats2.partidos}`,
        `Victorias: ${stats1.victorias} vs ${stats2.victorias}`,
        `Derrotas: ${stats1.derrotas} vs ${stats2.derrotas}`,
        `Win Rate: ${w_r1}% vs ${w_r2}%`,
        `Goles: ${stats1.goles} vs ${stats2.goles}`,
        `Asistencias: ${stats1.asistencias} vs ${stats2.asistencias}`,
        `Goles/Partido: ${gpp1} vs ${gpp2}`,
        `Asist./Partido: ${app1} vs ${app2}`,
        `Hat-tricks: ${stats1.hatTricks} vs ${stats2.hatTricks}`
    ];

    lineas.forEach(linea => {
        room.sendAnnouncement(linea, solicitante.id, parseInt(CELESTE_LNB, 16), "normal", 0);
    });
}

// EVENTOS DEL ROOM - versión principal
// Función para verificar si un mensaje contiene caracteres prohibidos
function contieneCaracteresProhibidos(mensaje) {
    // Caracteres problemáticos que pueden causar errores de renderizado
    const caracteresProhibidos = [
        // Control characters y caracteres especiales problemáticos
        '\u0000', '\u0001', '\u0002', '\u0003', '\u0004', '\u0005', '\u0006', '\u0007',
        '\u0008', '\u000E', '\u000F', '\u0010', '\u0011', '\u0012', '\u0013', '\u0014',
        '\u0015', '\u0016', '\u0017', '\u0018', '\u0019', '\u001A', '\u001B', '\u001C',
        '\u001D', '\u001E', '\u001F',
        // Algunos caracteres Unicode problemáticos específicos
        '\uFEFF', // BOM
        '\u200B', // Zero-width space
        '\u200C', // Zero-width non-joiner
        '\u200D', // Zero-width joiner
        '\u2060', // Word joiner
    ];

    for (const char of caracteresProhibidos) {
        if (mensaje.includes(char)) {
            return true;
        }
    }
    
    // También verificar si hay caracteres de control generales
    return /[\u0000-\u001F\u007F-\u009F]/.test(mensaje);
}

function configurarEventos() {
    // Chat del jugador
    room.onPlayerChat = function(jugador, mensaje) {
        if (contieneCaracteresProhibidos(mensaje)) {
            return false;
        }
        // PROTECCIÓN AVANZADA CONTRA /store - Interceptar y convertir en comando personalizado
        if (mensaje.toLowerCase().trim() === '/store' || mensaje.toLowerCase().startsWith('/store ')) {
            // Mensaje de error público inmediato
            room.sendAnnouncement("❌ Couldn't store stadium", jugador.id, parseInt("FF0000", 16), "bold", 0);
            
            // Enviar mensajes privados educativos inmediatamente
            setTimeout(() => {
                room.sendAnnouncement(
                    "🎮 ¡Hola! Si buscas los mapas oficiales de LNB, te invitamos al Discord",
                    jugador.id,
                    parseInt(CELESTE_LNB, 16),
                    "bold",
                    0
                );
                
                room.sendAnnouncement(
                    "🔗 DISCORD LNB: discord.gg/nJRhZXRNCA (copia y pega en tu navegador)",
                    jugador.id,
                    parseInt("FFD700", 16),
                    "bold",
                    0
                );
                
                room.sendAnnouncement(
                    "📁 Tenemos un canal exclusivo con todos los mapas oficiales de LNB para descargar",
                    jugador.id,
                    parseInt(CELESTE_LNB, 16),
                    "normal",
                    0
                );
                
                room.sendAnnouncement(
                    "🏆 ¡Únete a la comunidad y descarga los mapas oficiales de la Liga!",
                    jugador.id,
                    parseInt("32CD32", 16),
                    "normal",
                    0
                );
                
                room.sendAnnouncement(
                    "⚠️ IMPORTANTE: /store está deshabilitado para proteger la integridad de los mapas oficiales",
                    jugador.id,
                    parseInt("FF6B6B", 16),
                    "bold",
                    0
                );
            }, 100); // Delay mínimo para asegurar que se procese
            
            anunciarAdvertencia(`⚠️ ${jugador.name} intentó usar /store (comando interceptado)`);
            console.log(`🛡️ Comando /store interceptado y bloqueado para jugador: ${jugador.name} (ID: ${jugador.id})`);
            
            // CRÍTICO: Retornar false para evitar que el comando llegue a HaxBall
            return false;
        }
        
        // PROTECCIÓN ADICIONAL - Bloquear otros comandos de administración de mapas
        const comandosBloqueados = ['/map store', '/stadium store', '/save', '/export'];
        const mensajeLower = mensaje.toLowerCase().trim();
        
        for (const comandoBloqueado of comandosBloqueados) {
            if (mensajeLower === comandoBloqueado || mensajeLower.startsWith(comandoBloqueado + ' ')) {
                anunciarError(`🚫 Comando "${comandoBloqueado}" bloqueado por seguridad.`, jugador);
                anunciarAdvertencia(`⚠️ ${jugador.name} intentó usar comando bloqueado: ${comandoBloqueado}`);
                console.log(`🛡️ Comando bloqueado: ${comandoBloqueado} por jugador: ${jugador.name} (ID: ${jugador.id})`);
                return false;
            }
        }
        
        // Verificar si está silenciado por spam
        if (estaSilenciadoPorSpam(jugador)) {
            return false;
        }
        
        // Verificar si está muteado por admin
        if (estaMuteadoPorAdmin(jugador)) {
            return false;
        }
        
        // Verificar si está en timeout (mantenido para otros tipos de timeout)
        if (estaEnTimeout(jugador)) {
            return false;
        }
        
        // Verificar spam
        if (verificarSpam(jugador, mensaje)) {
            return false;
        }
        
        // Comandos rápidos numéricos SIN ! - PROCESAR PRIMERO
        // Solo procesar si el mensaje NO empieza con espacios
        const numeroSolo = mensaje; // No usar trim() para detectar espacios adelante
        if (/^\d+$/.test(numeroSolo)) {
            const numero = parseInt(numeroSolo);
            let mensajeNumerico = null;
            
            // Mapear números a mensajes
            switch (numero) {
                case 4:
                    mensajeNumerico = "EZ 😎";
                    break;
                case 5:
                    mensajeNumerico = "💀";
                    break;
                case 6:
                    mensajeNumerico = "NOOOOOOO 😭";
                    break;
                case 7:
                    mensajeNumerico = "Perdón equipo 🙏";
                    break;
                case 8:
                    mensajeNumerico = "¡Buen pase!";
                    break;
                case 9:
                    mensajeNumerico = "¡Buen disparo!";
                    break;
                case 10:
                    mensajeNumerico = "¡Buena parada!";
                    break;
                case 11:
                    mensajeNumerico = "¡El 11 siempre presente!";
                    break;
                case 12:
                    mensajeNumerico = "BOCA BOCA BOCAAAA";
                    break;
                case 13:
                    mensajeNumerico = "Tenes menos timing que semáforo en el campo";
                    break;
                case 14:
                    mensajeNumerico = "Jugué tan mal que me sacaron del grupo familiar";
                    break;
                case 15:
                    mensajeNumerico = "Soy arquero, pero del otro equipo";
                    break;
                case 16:
                    mensajeNumerico = "Le pegué tan fuerte que se fue al metaverso";
                    break;
                case 17:
                    mensajeNumerico = "Vi el pase... pero desde el futuro";
                    break;
                case 18:
                    mensajeNumerico = "El lag es parte de mi estilo de juego";
                    break;
                case 19:
                    mensajeNumerico = "Mi defensa es tan sólida como el wifi de mi vecino";
                    break;
                case 20:
                    mensajeNumerico = "Amura inju";
                    break;
                case 21:
                    mensajeNumerico = "LA MAFIA A COLOCAAAAAAAAAAAR";
                    break;
                case 22:
                    mensajeNumerico = "MIRA LA BOCHA Q PUSO ESTE TIPO";
                    break;
                case 23:
                    mensajeNumerico = "A NO LO QUE SACA";
                    break;
                case 24:
                    mensajeNumerico = "Viven en un country...";
                    break;
                case 25:
                    mensajeNumerico = "54321 almiron por arribaaaaaaaaaaaa";
                    break;
                case 26:
                    mensajeNumerico = "Hacelo cuevas tiro goooooooool";
                    break;
                case 27:
                    mensajeNumerico = "PIPA PIPA PIPA PIPA NONONONONONO";
                    break;
                case 28:
                    mensajeNumerico = "776420 pesos la recaudacion para esta nueva edicion del superclasico del futbol argentino MARTEEEEN GOOOOOOOOOOOOOOL";
                    break;
                case 29:
                    mensajeNumerico = "¡NOOOO FABIÁNIIII!";
                    break;
                case 30:
                    mensajeNumerico = "¡LO MANDARON A COMPRAR PAN!";
                    break;
                case 31:
                    mensajeNumerico = "Y VA EL TERCEROOOO";
                    break;
                case 32:
                    mensajeNumerico = "¡GOOOOOOL DE CHACARITAAA!";
                    break;
                case 33:
                    mensajeNumerico = "QUINTEROOOOOOOOOOOOOO";
                    break;
                case 34:
                    mensajeNumerico = "¡PEGÁLEEEEE BURRO!";
                    break;
                case 35:
                    mensajeNumerico = "¡SE LE ESCAPÓ COMO A LUX CONTRA LANÚS!";
                    break;
                case 36:
                    mensajeNumerico = "¡TIRÁ UN CENTRO COMO LA GENTE!";
                    break;
                case 37:
                    mensajeNumerico = "¡TE PESA LA CAMISETA!";
                    break;
                case 38:
                    mensajeNumerico = "¡JUGÁS COMO EL ORT... Y COBRÁS EN DÓLARES!";
                    break;
                case 39:
                    mensajeNumerico = "¡ESTO CON MOSTAZA NO PASABA!";
                    break;
                case 40:
                    mensajeNumerico = "¡MIRALO A ROMÁN, CÓMO CAMINA LA CANCHA!";
                    break;
                case 41:
                    mensajeNumerico = "¡NO SE JUEGA MÁS EN ESA CANCHA, EH!";
                    break;
                case 42:
                    mensajeNumerico = "¡ES UN DESASTRE, MARCELO! (imitando a Ruggeri)";
                    break;
                case 43:
                    mensajeNumerico = "¡ESTE PARTIDO LO DIRIGE EL TÍO DEL 9!";
                    break;
                case 44:
                    mensajeNumerico = "¡LO DEJÓ TIRADO Y LE HIZO EL AMOR EN EL ÁREA!";
                    break;
                case 45:
                    mensajeNumerico = "dale que so vo dale q so vo";
                    break;
                case 46:
                    mensajeNumerico = "¡SE VIENE LA NOCHE, MUCHACHOS!";
                    break;
                case 47:
                    mensajeNumerico = "MAMITA POSHO";
                    break;
                case 48:
                    mensajeNumerico = "Entró la bala.";
                    break;
                case 49:
                    mensajeNumerico = "ANDA A LA CANCHA BOBO";
                    break;
                case 50:
                    mensajeNumerico = "La verdadera leyenda del bigger, bro";
                    break;
                case 51:
                    mensajeNumerico = "EL DIBUUUUUUUUUUU";
                    break;
                case 52:
                    mensajeNumerico = "Para que te traje";
                    break;
                case 53:
                    mensajeNumerico = "La pelota no se mancha";
                    break;
                case 54:
                    mensajeNumerico = "OLEEEEEE";
                    break;
                case 55:
                    mensajeNumerico = "PERO QUE VIVA EL FUTBOL";
                    break;
                case 56:
                    mensajeNumerico = "B 26/06/11";
                    break;
                case 57:
                    mensajeNumerico = "Pero q distinguido";
                    break;
                case 58:
                    mensajeNumerico = "No tag cono";
                    break;
                case 59:
                    mensajeNumerico = "Moriste en Madrid 9/12/18";
                    break;
                case 60:
                    mensajeNumerico = "La pelota siempre al 10";
                    break;
            }
            
            // Si hay un mensaje para este número, procesarlo como mensaje normal
            if (mensajeNumerico) {
                // Obtener el nivel del jugador y mostrar en el chat
                const nombreOriginal = obtenerNombreOriginal(jugador);
                const nivel = obtenerNivelJugador(nombreOriginal);
                const emojiNivel = obtenerEmojiNivel(nivel);
                
                // Crear el mensaje con formato de chat normal pero con el mensaje del comando
                const mensajeConNivel = `〔Nv. ${nivel} ${emojiNivel}〕 ${nombreOriginal}: ${mensajeNumerico}`;
                
                // Retransmitir el mensaje modificado con nivel usando color crema para comandos rápidos
                room.sendAnnouncement(mensajeConNivel, null, parseInt("F5DEB3", 16), "normal", 1);
                
                return false; // No mostrar el mensaje original
            }
        }
        
        // Comandos - PROCESAR PRIMERO para que sean completamente privados
        if (mensaje.startsWith("!")) {
            try {
procesarComando(jugador, mensaje);
            } catch (error) {
                console.error('❌ Error procesando comando:', error);
                anunciarError("Error procesando comando", jugador);
            }
            return false; // NO mostrar el comando en el chat público
        }
        
        // Team chat - INTERCEPTAR INMEDIATAMENTE AL INICIO
        if (mensaje.startsWith("t ") || mensaje.startsWith("T ")) {
            // INTERCEPTACIÓN INMEDIATA - Procesar AHORA mismo sin delays
            const msgEquipo = mensaje.slice(2).trim();
            
            // Verificar que el jugador esté en un equipo (no en espectadores)
            if (jugador.team === 0) {
                anunciarError("❌ Debes estar en un equipo para usar el chat de equipo", jugador);
                return false; // BLOQUEAR mensaje completamente
            }
            
            // Verificar que hay mensaje después del prefijo
            if (!msgEquipo || msgEquipo.length === 0) {
                anunciarError("❌ Escribe un mensaje después de 't '", jugador);
                return false; // BLOQUEAR mensaje completamente
            }
            
            // PROCESAMIENTO INMEDIATO SÍNCRONO
            try {
                const jugadores = room.getPlayerList();
                
                // Determinar color según el equipo
                const colorEquipo = jugador.team === 1 ? COLORES.CHAT_TEAM_ROJO : jugador.team === 2 ? AZUL_LNB : CELESTE_LNB;
                const nombreEquipo = jugador.team === 1 ? "ROJO" : jugador.team === 2 ? "AZUL" : "SPEC";
                
                // Obtener nombre original del jugador
                const nombreOriginal = obtenerNombreOriginal(jugador);
                
                // Enviar mensaje INMEDIATAMENTE - sin setTimeout ni delays
                jugadores.forEach(j => {
                    if (j.team === jugador.team && j.team !== 0) {
                        room.sendAnnouncement(
                            `👥 [EQUIPO ${nombreEquipo}] ${nombreOriginal}: ${msgEquipo}`, 
                            j.id, 
                            parseInt(colorEquipo, 16), 
                            "normal", 
                            0
                        );
                    }
                });
                
                console.log(`📢 TEAM CHAT PROCESADO: ${nombreOriginal} (equipo ${jugador.team}) -> "${msgEquipo}"`);
            } catch (error) {
                console.error('❌ Error en team chat:', error);
                anunciarError("❌ Error al procesar mensaje de equipo", jugador);
            }
            
            // RETORNAR FALSE INMEDIATAMENTE - CRÍTICO
            return false;
        }
        
        // Comando privado (whisper)
        if (mensaje.startsWith("@@")) {
            const textoCompleto = mensaje.slice(2).trim();
            const jugadores = room.getPlayerList();
            let jugadorDestino = null;
            let msgPrivado = '';

            // Primero intentar buscar por nombre original (sin niveles)
            for (const p of jugadores) {
                const nombreOriginal = obtenerNombreOriginal(p);
                const nombreBusqueda = textoCompleto.toLowerCase().replace(/_/g, ' ');
                
                // Buscar coincidencia exacta al inicio
                if (nombreBusqueda.startsWith(nombreOriginal.toLowerCase()) && 
                    (nombreBusqueda.length === nombreOriginal.length || nombreBusqueda[nombreOriginal.length] === ' ')) {
                    jugadorDestino = p;
                    msgPrivado = textoCompleto.substring(nombreOriginal.length).trim();
                    break;
                }
            }
            
            // Si no se encontró con nombre exacto, buscar con includes (más flexible)
            if (!jugadorDestino) {
                for (const p of jugadores) {
                    const nombreOriginal = obtenerNombreOriginal(p);
                    const nombreBusqueda = textoCompleto.toLowerCase().replace(/_/g, ' ');
                    
                    if (nombreOriginal.toLowerCase().includes(nombreBusqueda.split(' ')[0]) && nombreBusqueda.split(' ')[0].length >= 3) {
                        jugadorDestino = p;
                        // Tomar todo después del primer espacio como mensaje
                        const partesTexto = textoCompleto.split(' ');
                        if (partesTexto.length > 1) {
                            msgPrivado = partesTexto.slice(1).join(' ').trim();
                        }
                        break;
                    }
                }
            }

            if (jugadorDestino && msgPrivado) {
                const nombreOriginalRemitente = obtenerNombreOriginal(jugador);
                const nombreOriginalDestino = obtenerNombreOriginal(jugadorDestino);
                room.sendAnnouncement(`💬 [PRIVADO de ${nombreOriginalRemitente}]: ${msgPrivado}`, jugadorDestino.id, parseInt("FFD700", 16), "normal", 0);
                room.sendAnnouncement(`💬 [PRIVADO a ${nombreOriginalDestino}]: ${msgPrivado}`, jugador.id, parseInt("FFD700", 16), "normal", 0);
            } else {
                anunciarError("🔍 Jugador no encontrado o mensaje vacío.", jugador);
            }
            return false;
        }
        
        // ===============================================
        // ARREGLO CRÍTICO: FILTRADO DE MENSAJES NORMALES
        // ===============================================
        // Los mensajes normales DEBEN permitir que HaxBall los procese naturalmente
        // para que el sistema de chat nativo funcione correctamente.
        // Solo interceptamos comandos especiales, team chat y mensajes privados.
        
        // Obtener el nivel del jugador y mostrar en el chat
        const nombreOriginal = obtenerNombreOriginal(jugador);
        const nivel = obtenerNivelJugador(nombreOriginal);
        const emojiNivel = obtenerEmojiNivel(nivel);
        
        // Crear el mensaje con formato de chat normal pero agregando el nivel
        const mensajeConNivel = `〔Nv. ${nivel} ${emojiNivel}〕 ${nombreOriginal}: ${mensaje}`;
        
        // Retransmitir el mensaje modificado con nivel usando color blanco para mensajes normales
        room.sendAnnouncement(mensajeConNivel, null, parseInt("FFFFFF", 16), "normal", 1);
        
        return false; // No mostrar el mensaje original sin formato
    };
    
    // Jugador se une
    room.onPlayerJoin = async function(jugador) {
        console.log(`🎮 DEBUG: Jugador se unió: ${jugador.name} (ID: ${jugador.id})`);
        
        // Verificar que room esté disponible antes de proceder
        if (!room || !room.sendAnnouncement) {
            console.error('❌ Room no disponible en onPlayerJoin');
            return;
        }
        
        // ====================== PROTECCIÓN CONTRA MÚLTIPLES CONEXIONES ======================
        // Detectar múltiples pestañas usando auth del jugador
        if (detectarMultiplesConexiones(jugador)) {
            console.log(`🚫 MÚLTIPLES PESTAÑAS: ${jugador.name} (${jugador.auth}) intentó conectarse con múltiples pestañas`);
            
            // Expulsar inmediatamente
            room.kickPlayer(
                jugador.id, 
                `❌ Solo se permite una conexión por jugador. Cierra las otras pestañas/ventanas del juego.`, 
                false
            );
            
            // Registrar en la base de datos el intento de conexión múltiple
            try {
                if (typeof nodeRegistrarConexion === 'function') {
                    nodeRegistrarConexion(jugador.name, jugador.auth, 'REJECTED_IP', 'MULTIPLE_TABS_REJECTED');
                }
            } catch (error) {
                console.error('❌ Error registrando conexión múltiple:', error);
            }
            
            return; // Impedir que continúe el proceso de unión
        }
        
        // Obtener IP del jugador (simulada para HaxBall Headless)
        const ipJugador = obtenerIPJugador(jugador);
        
        if (ipJugador) {
            console.log(`🔍 DEBUG IP: Jugador ${jugador.name} conectado desde IP: ${ipJugador}`);
            
            // Limpiar conexiones expiradas usando la función de base de datos
            try {
                if (typeof nodeLimpiarConexionesInactivas === 'function') {
                    nodeLimpiarConexionesInactivas();
                }
            } catch (error) {
                console.error('❌ Error limpiando conexiones expiradas:', error);
            }
            
            // Verificar conexiones múltiples usando la base de datos
            let puedeConectarse = true;
            try {
                if (typeof nodeVerificarConexionesExistentes === 'function') {
                    try {
                        const verificacion = await nodeVerificarConexionesExistentes(jugador.name, jugador.auth);
                        console.log(`🔍 DEBUG DB: Verificación recibida:`, verificacion);
                        
                        if (verificacion && verificacion.tieneConexionesMultiples && verificacion.conexionesActivas >= 2) {
                            console.log(`🚫 BASE DE DATOS: Conexión rechazada para ${jugador.name}: ${verificacion.conexionesActivas} conexiones detectadas.`);
                            
                            room.kickPlayer(
                                jugador.id, 
                                `❌ Ya tienes una conexión activa. Solo se permite una conexión por jugador.`, 
                                false
                            );
                            
                            // Registrar el rechazo en la base de datos
                            if (typeof nodeRegistrarConexion === 'function') {
                                try {
                                    nodeRegistrarConexion(jugador.name, jugador.auth, 'REJECTED_DB', 'MULTIPLE_CONNECTIONS_DB');
                                } catch (regError) {
                                    console.error('❌ Error registrando rechazo DB:', regError);
                                }
                            }
                            
                            puedeConectarse = false;
                        } else {
                            console.log(`✅ DEBUG DB: Jugador ${jugador.name} puede conectarse - no hay conexiones múltiples`);
                        }
                    } catch (dbError) {
                        console.error('❌ Error específico en verificación DB:', dbError);
                        throw dbError;
                    }
                } else {
                    console.log('⚠️ DEBUG: nodeVerificarConexionesExistentes no está disponible');
                }
            } catch (error) {
                console.error('❌ Error verificando conexiones múltiples:', error);
                console.log('🔄 Continuando con sistema de memoria como respaldo');
                // En caso de error, usar el sistema de memoria como respaldo
            }
            
            if (!puedeConectarse) {
                return; // Impedir que continúe el proceso de unión
            }
            
            // Registrar la conexión en la base de datos
            try {
                if (typeof nodeRegistrarConexion === 'function') {
                    nodeRegistrarConexion(jugador.name, jugador.auth, ipJugador, 'CONNECTED');
                }
            } catch (error) {
                console.error('❌ Error registrando conexión:', error);
            }
            
            // Sistema de memoria como respaldo (mantenido para compatibilidad)
            // Verificar si la IP está bloqueada
            const ipBloqueada = ipsBloqueadas.get(ipJugador);
            if (ipBloqueada) {
                const tiempoRestante = Math.ceil((ipBloqueada.timestamp + TIEMPO_LIMITE_IP - Date.now()) / (60 * 1000));
                if (tiempoRestante > 0) {
                    console.log(`🚫 DEBUG IP: IP ${ipJugador} está bloqueada por ${tiempoRestante} minutos`);
                    room.kickPlayer(jugador.id, `Tu IP está temporalmente bloqueada por múltiples conexiones. Espera ${tiempoRestante} minutos.`, false);
                    return;
                } else {
                    // El bloqueo ha expirado, removerlo
                    ipsBloqueadas.delete(ipJugador);
                    console.log(`🔓 DEBUG IP: Bloqueo expirado para IP ${ipJugador}`);
                }
            }
            
            // Verificar conexiones actuales de esta IP (sistema de memoria)
            const conexionIP = conexionesPorIP.get(ipJugador);
            if (conexionIP) {
                const jugadoresActuales = Array.from(conexionIP.jugadores).filter(playerId => {
                    const jugadorExistente = room.getPlayerList().find(p => p.id === playerId);
                    return jugadorExistente !== undefined;
                });
                
                // Limpiar jugadores desconectados
                conexionIP.jugadores = new Set(jugadoresActuales);
                
                console.log(`🔍 DEBUG IP: IP ${ipJugador} tiene ${jugadoresActuales.length} conexiones activas`);
                
                if (jugadoresActuales.length >= MAX_JUGADORES_POR_IP) {
                    console.log(`🚫 DEBUG IP: IP ${ipJugador} excede el límite de ${MAX_JUGADORES_POR_IP} conexiones`);
                   
                    // Obtener nombres de los jugadores ya conectados
                    const nombresConectados = jugadoresActuales
                        .map(playerId => {
                            const p = room.getPlayerList().find(player => player.id === playerId);
                            return p ? p.name : `ID:${playerId}`;
                        })
                        .join(', ');
                    
                    // Expulsar al nuevo jugador
                    room.kickPlayer(
                        jugador.id, 
                        `Solo se permiten ${MAX_JUGADORES_POR_IP} jugadores por red. Ya conectados: ${nombresConectados}`, 
                        false
                    );
                    
                    // Bloquear temporalmente la IP si hay muchos intentos
                    const ahora = Date.now();
                    if (ahora - (conexionIP.timestamp || 0) < 60000) { // Si hay múltiples intentos en 1 minuto
                        ipsBloqueadas.set(ipJugador, {
                            razon: 'Múltiples intentos de conexión excesiva',
                            timestamp: ahora
                        });
                        console.log(`🔒 DEBUG IP: IP ${ipJugador} bloqueada temporalmente por múltiples intentos`);
                        
                        // Enviar notificación a Discord si está configurado
                        enviarNotificacionIPBloqueada(ipJugador, jugador.name, nombresConectados);
                    }
                    
                    return; // Impedir que continúe el proceso de unión
                }
                
                // Agregar el nuevo jugador a la conexión existente
                conexionIP.jugadores.add(jugador.id);
                conexionIP.timestamp = Date.now();
            } else {
                // Primera conexión de esta IP
                conexionesPorIP.set(ipJugador, {
                    jugadores: new Set([jugador.id]),
                    timestamp: Date.now()
                });
                console.log(`✅ DEBUG IP: Primera conexión registrada para IP ${ipJugador}`);
            }
            
            // Mapear jugador a su IP
            jugadoresPorIP.set(jugador.id, ipJugador);
            
            // Mensaje informativo si hay múltiples conexiones de la misma IP
            const conexionesIP = conexionesPorIP.get(ipJugador);
            if (conexionesIP && conexionesIP.jugadores.size > 1) {
                const otrosJugadores = Array.from(conexionesIP.jugadores)
                    .filter(id => id !== jugador.id)
                    .map(id => {
                        const p = room.getPlayerList().find(player => player.id === id);
                        return p ? p.name : `ID:${id}`;
                    })
                    .join(', ');
                
                console.log(`⚠️ DEBUG IP: Múltiples conexiones desde ${ipJugador}: ${jugador.name} + ${otrosJugadores}`);
                
                // Mensaje privado al jugador sobre conexiones de su red
                setTimeout(() => {
                    room.sendAnnouncement(
                        `ℹ️ Detectamos ${conexionesIP.jugadores.size} conexiones desde tu red: ${otrosJugadores}`,
                        jugador.id,
                        parseInt(COLORES.INFO, 16),
                        "normal",
                        0
                    );
                    room.sendAnnouncement(
                        `⚠️ Máximo ${MAX_JUGADORES_POR_IP} jugadores por red. Si alguien más se conecta, serás desconectado.`,
                        jugador.id,
                        parseInt(COLORES.ADVERTENCIA, 16),
                        "normal",
                        0
                    );
                }, 2000);
            }
        } else {
            console.log(`⚠️ DEBUG IP: No se pudo obtener IP para jugador ${jugador.name}`);
        }
        // ====================== FIN PROTECCIÓN CONTRA MÚLTIPLES CONEXIONES ======================
        
        // Guardar nombre original antes de modificarlo
        nombresOriginales.set(jugador.id, jugador.name);
        
        // ====================== GENERAR/VERIFICAR UID DEL JUGADOR (SISTEMA MEJORADO) ======================
        try {
            // Usar el nuevo sistema UID mejorado
            if (typeof nodeObtenerUIDMejorado === 'function') {
                nodeObtenerUIDMejorado(jugador).then(uid => {
                    if (uid) {
                        console.log(`🆔 UID mejorado asignado para ${jugador.name}: ${uid}`);
                        
                        // Actualizar UID en tabla jugadores si es necesario
                        if (typeof nodeActualizarUID === 'function') {
                            try {
                                nodeActualizarUID(jugador.name, uid);
                                console.log(`📊 UID actualizado en tabla jugadores para ${jugador.name}`);
                            } catch (error) {
                                console.error(`❌ Error actualizando UID en tabla jugadores para ${jugador.name}:`, error);
                            }
                        }
                        
                        // También actualizar en el sistema legacy para compatibilidad
                        jugadoresUID.set(jugador.id, uid);
                    }
                }).catch(error => {
                    console.error(`❌ No se pudo generar UID mejorado para ${jugador.name}:`, error);
                    
                    // Fallback al sistema anterior si el nuevo falla
                    const uidLegacy = obtenerUID(jugador);
                    if (uidLegacy) {
                        console.log(`🔄 Usando UID legacy para ${jugador.name}: ${uidLegacy}`);
                        jugadoresUID.set(jugador.id, uidLegacy);
                    }
                });
            } else {
                console.warn('⚠️ Sistema UID mejorado no disponible, usando sistema legacy');
                
                // Usar sistema anterior si las nuevas funciones no están disponibles
                const uid = obtenerUID(jugador);
                if (uid) {
                    console.log(`🆔 UID legacy asignado para ${jugador.name}: ${uid}`);
                    jugadoresUID.set(jugador.id, uid);
                } else {
                    console.error(`❌ No se pudo generar UID legacy para ${jugador.name}`);
                }
            }
        } catch (error) {
            console.error(`❌ Error generando UID mejorado para ${jugador.name}:`, error);
            
            // Fallback al sistema anterior en caso de error
            try {
                const uidLegacy = obtenerUID(jugador);
                if (uidLegacy) {
                    console.log(`🔄 Fallback: UID legacy para ${jugador.name}: ${uidLegacy}`);
                    jugadoresUID.set(jugador.id, uidLegacy);
                }
            } catch (legacyError) {
                console.error(`❌ Error también en sistema UID legacy para ${jugador.name}:`, legacyError);
            }
        }
        // ====================== FIN GENERACIÓN UID MEJORADO =======================
        
        try {
            // Mensaje de bienvenida centrado y llamativo
            const mensajeBienvenida = `🔵⚡ ¡BIENVENIDO ${jugador.name.toUpperCase()} A LA LIGA NACIONAL DE BIGGER LNB! ⚡🔵`;
            console.log(`📢 DEBUG: Enviando mensaje de bienvenida para ${jugador.name}`);
            room.sendAnnouncement(mensajeBienvenida, null, parseInt("FFD700", 16), "bold", 1);
            
            // Enviar mensajes informativos con delays escalonados
setTimeout(() => {
                if (room && room.sendAnnouncement) {
                    room.sendAnnouncement(
                        "📣 ¡LNB AHORA ESTÁ EN TODAS LAS REDES!!\n" +
                        "🎥 TikTok: https://www.tiktok.com/@lnbhaxball\n" +
                        "📸 Instagram: https://www.instagram.com/lnbhaxball/\n" +
                        "📹 YouTube: https://youtube.com/liganacionaldebigger\n" +
                        "📺 Twitch: https://twitch.tv/liganacionalbigger\n" +
                        "📤 Mandanos tus clips para compartir 💥\n" +
                        "━━━━━━━━━━━━━┓ LNB 🔥 Discord: 'discord.gg/nJRhZXRNCA' ┏━━━━━━━━━━━━━ \n" +
                        "Script by ИФT\n" +
                        "ℹ️ 🔵 Usa !ayuda para ver los comandos disponibles",
                        jugador.id,
                        parseInt(CELESTE_LNB, 16), "bold", 0
                    );
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error enviando mensajes de bienvenida:', error);
        }
        
        // Registrar jugador en estadísticas globales si no existe
        try {
            if (!estadisticasGlobales.jugadores[jugador.name]) {
                registrarJugadorGlobal(jugador.name);
            }
        } catch (error) {
            console.error('❌ Error registrando jugador global:', error);
        }
        
        // Actualizar nombre con nivel después de un breve delay
        setTimeout(() => {
            try {
                actualizarNombreConNivel(jugador);
            } catch (error) {
                console.error('❌ Error actualizando nombre con nivel:', error);
            }
        }, 500);
        
        // MOVER AUTOMÁTICAMENTE A EQUIPO - con delay para asegurar que el jugador esté completamente conectado
        setTimeout(() => {
            try {
                console.log(`🔄 DEBUG: Intentando mover ${jugador.name} a un equipo...`);
                agregarJugadorAEquipo(jugador);
            } catch (error) {
                console.error('❌ Error moviendo jugador a equipo:', error);
            }
        }, 1000);
        
        // Auto-detección de mapa
        setTimeout(() => {
            try {
                detectarCambioMapa();
            } catch (error) {
                console.error('❌ Error en detección de mapa:', error);
            }
        }, 2000);
    };
    
    // Jugador sale
    room.onPlayerLeave = function(jugador) {
        const nombreOriginal = obtenerNombreOriginal(jugador);
        anunciarGeneral(`👋 💨 ${nombreOriginal} se desconectó de la sala 💨`, "888888");
        
        // Si era admin
        if (adminActual && adminActual.id === jugador.id) {
            adminActual = null;
            // Mensaje removido para evitar spam
        }
        
        // Limpiar datos del jugador que se fue
        jugadoresAFK.delete(jugador.id);
        advertenciasAFK.delete(jugador.id);
        nombresOriginales.delete(jugador.id);
        desafiosPPT.delete(jugador.id); // Asegurar eliminación de desafíos
        jugadoresActivos.delete(jugador.id);
        jugadoresConRoles.delete(jugador.id);
        mensajesPersonalizados.delete(jugador.id);
        spamControl.delete(jugador.id);
        cooldownGlobal.delete(jugador.id);
        jugadoresSilenciadosPorSpam.delete(jugador.id);
        jugadoresMuteados.delete(jugador.id);
        jugadoresUID.delete(jugador.id); // Limpiar UID generado
        
        // Limpiar mute temporal si existe
        const muteTemp = jugadoresMuteadosTemporales.get(jugador.id);
        if (muteTemp) {
            clearTimeout(muteTemp.timeoutId);
            jugadoresMuteadosTemporales.delete(jugador.id);
        }
        
        // ====================== LIMPIAR CONEXIÓN DE BASE DE DATOS ======================
        // Desactivar todas las conexiones del jugador en la base de datos
        try {
            if (typeof nodeDesactivarConexionesJugador === 'function') {
                // Usar tanto nombre como auth (si está disponible) para limpiar conexiones
                const authJugador = jugador.auth || null;
                nodeDesactivarConexionesJugador(jugador.name, authJugador).then(() => {
                    console.log(`🧹 Conexiones desactivadas para ${jugador.name} al salir`);
                }).catch(error => {
                    console.error(`❌ Error desactivando conexiones para ${jugador.name}:`, error);
                });
            }
        } catch (error) {
            console.error(`❌ Error al desactivar conexiones para ${jugador.name}:`, error);
        }
        
        // Limpiar datos de IP (sistema de memoria)
        try {
            limpiarConexionesIP(jugador);
        } catch (error) {
            console.error(`❌ Error limpiando conexiones IP para ${jugador.name}:`, error);
        }
        // ====================== FIN LIMPIEZA DE CONEXIÓN ======================

        // Registrar puntuación del partido en estadísticas globales
        try {
            const statsGlobal = estadisticasGlobales.jugadores[jugador.name];
            if (statsGlobal) {
                statsGlobal.puntuaciones = statsGlobal.puntuaciones || [];
                const eqStats = estadisticasPartido.jugadores[jugador.id];
                if (eqStats && eqStats.puntuacionPartido !== undefined) {
                    statsGlobal.puntuaciones.push(eqStats.puntuacionPartido);
                }
            }
        } catch (error) {
            console.error(`❌ Error registrando puntuación para ${jugador.name}:`, error);
        }
        
        // Auto-detección de mapa y verificaciones
        setTimeout(() => {
            detectarCambioMapa();
            autoBalanceEquipos();
            verificarAutoStart();
            verificarAutoStop(null);
        }, 1000);
    };
    
    // Enlace de la sala (CRÍTICO para Headless)
    room.onRoomLink = function(url) {
        
        // Verificar que la URL sea válida
        if (!url || typeof url !== 'string' || url.length === 0) {
            console.warn('❌ URL inválida recibida en onRoomLink:', url);
            return;
        }
        
        console.log('\n' + '🎆'.repeat(40));
        console.log('🔗 ¡¡¡ENLACE DE LA SALA CAPTURADO!!!');
        console.log('📋 URL RECIBIDA: ' + url);
        console.log('📍 Tipo de URL: ' + typeof url);
        console.log('📐 Longitud de URL: ' + (url ? url.length : 'null'));
        console.log('🕐 Timestamp: ' + new Date().toISOString());
        console.log('🎆'.repeat(40) + '\n');
        
        // Almacenar el enlace real para usar en los informes
        const enlaceAnterior = enlaceRealSala;
        enlaceRealSala = url;
        
        console.log(`🔄 Enlace actualizado de "${enlaceAnterior}" a "${enlaceRealSala}"`);
        
        // Enviar reporte inmediato con el enlace actualizado usando SOLO formato embed
        setTimeout(() => {
            try {
                console.log('📤 Enviando reporte de sala con enlace actualizado...');
                enviarOEditarReporteSala("Enlace de sala actualizado", false);
            } catch (error) {
                console.error("❌ Error en reporte de sala:", error);
            }
        }, 2000);
    };

    // Gol marcado
room.onTeamGoal = function(equipo) {
        const scores = room.getScores();
        
        console.log(`🥅 DEBUG: Gol detectado para equipo ${equipo}`);
        console.log(`🥅 DEBUG: ultimoTocador: ${ultimoTocador ? ultimoTocador.name + ' (equipo ' + ultimoTocador.team + ')' : 'null'}`);
        console.log(`🥅 DEBUG: penultimoTocador: ${penultimoTocador ? penultimoTocador.name + ' (equipo ' + penultimoTocador.team + ')' : 'null'}`);
        
        // Usar un tiempo de espera fijo de 3 segundos como aproximación del tiempo estándar
        // entre gol y saque del medio en Haxball
        const tiempoEsperaEstandar = 3; // 3 segundos
        
        estadisticasPartido.tiempoEsperaSaque += tiempoEsperaEstandar;
        
        // Acumular tiempo de espera por equipo para cálculo de valla invicta
        if (equipo === 1) {
            // Gol del equipo rojo, el tiempo de espera afecta a la valla del equipo azul
            estadisticasPartido.tiempoEsperaSaqueBlue += tiempoEsperaEstandar;
        } else {
            // Gol del equipo azul, el tiempo de espera afecta a la valla del equipo rojo
            estadisticasPartido.tiempoEsperaSaqueRed += tiempoEsperaEstandar;
        }

        // Registrar tiempo de valla invicta para el equipo que recibió el gol
        if (estadisticasPartido.iniciado) {
            const scores = room.getScores();
            const tiempoJuegoActual = Math.floor(scores ? scores.time : 0); // Tiempo real de juego en segundos
            
            if (equipo === 1) {
                // Gol del equipo rojo, el azul recibió gol - registrar cuánto duró su valla invicta
                if (estadisticasPartido.golesRed === 0) {
                    // Es el primer gol que recibe el azul
                    estadisticasPartido.tiempoVallaInvictaBlue = tiempoJuegoActual;
                }
            } else {
                // Gol del equipo azul, el rojo recibió gol - registrar cuánto duró su valla invicta
                if (estadisticasPartido.golesBlue === 0) {
                    // Es el primer gol que recibe el rojo
                    estadisticasPartido.tiempoVallaInvictaRed = tiempoJuegoActual;
                }
            }
        }
        
        // MEJORADO: Registro más robusto de goles
        if (estadisticasPartido.iniciado) {
            let goleadorDetectado = null;
            let asistenteDetectado = null;
            
            // MÉTODO 1: Usar ultimoTocador si está disponible
            if (ultimoTocador) {
                goleadorDetectado = ultimoTocador;
                // El asistente es el penúltimo tocador si es diferente al goleador
                asistenteDetectado = (penultimoTocador && penultimoTocador.id !== ultimoTocador.id) ? penultimoTocador : null;
                console.log(`🥅 DEBUG: Método 1 - Goleador: ${goleadorDetectado.name} (${goleadorDetectado.team}), Asistente: ${asistenteDetectado ? asistenteDetectado.name : 'ninguno'}`);
            } else {
                // MÉTODO 2: Si no hay ultimoTocador, buscar jugador más cercano al gol
                console.log(`⚠️ DEBUG: ultimoTocador es null, buscando goleador alternativo...`);
                const jugadores = room.getPlayerList();
                const jugadoresEquipoContrario = jugadores.filter(j => j.team !== 0 && j.team !== equipo);
                
                if (jugadoresEquipoContrario.length > 0) {
                    // Asumir que el primer jugador del equipo contrario hizo el autogol
                    goleadorDetectado = jugadoresEquipoContrario[0];
                    console.log(`🥅 DEBUG: Método 2 - Goleador autogol detectado: ${goleadorDetectado.name} (${goleadorDetectado.team})`);
                }
            }
            
            // Registrar el gol si tenemos un goleador
            if (goleadorDetectado) {
                registrarGol(goleadorDetectado, equipo, asistenteDetectado);
            } else {
                // ÚLTIMO RECURSO: Registrar gol sin goleador específico
                console.log(`❌ DEBUG: No se pudo detectar goleador, registrando gol genérico`);
                registrarGolGenerico(equipo);
            }
        }

// Mostrar resultado actualizado después del gol

        // Detectar golden goal en overtime
        if (scores && scores.timeLimit === scores.time) {
            anunciarGeneral("👑 ¡GOL DE ORO! ¡PARTIDO FINALIZADO!", "FFD700", "bold");
        }
    };

    // Seguimiento de toques de pelota
    room.onPlayerBallKick = function(jugador) {
        const ahora = Date.now();
        
        // Solo actualizar si ha pasado al menos 100ms desde el último toque
        // Esto evita contar múltiples toques muy rápidos del mismo jugador
        if (ahora - tiempoUltimoToque > 100) {
            // Actualizar el seguimiento de tocadores
            if (ultimoTocador && ultimoTocador.id !== jugador.id) {
                penultimoTocador = ultimoTocador;
            }
            ultimoTocador = jugador;
            tiempoUltimoToque = ahora;
        }
    };
    
    // Jugador entra/sale del juego
    room.onPlayerTeamChange = function(jugador, equipoByAdmin) {
        // Verificar si el movimiento está bloqueado y no es por acción administrativa
        // IMPORTANTE: equipoByAdmin será el equipo destino cuando es movido por el sistema/bot
        if (bloqueoMovimientoActivo && !esBot(jugador) && (equipoByAdmin === null || equipoByAdmin === undefined)) {
            // Solo bloquear movimientos voluntarios del jugador (cuando equipoByAdmin es null/undefined)
            // Los movimientos del sistema/bot tendrán equipoByAdmin con valor numérico
            
            // Guardar el equipo actual antes de revertir
            const equipoAnterior = equiposJugadoresAntesMovimiento.get(jugador.id) || 0;
            
            // Revertir el movimiento
            setTimeout(() => {
                room.setPlayerTeam(jugador.id, equipoAnterior);
                anunciarAdvertencia(`${jugador.name}, no puedes cambiar de equipo. Usa !afk para salir o !back para volver`, jugador);
            }, 50);
            return;
        }
        
        // Actualizar el registro de equipos si no está bloqueado
        if (!bloqueoMovimientoActivo) {
            equiposJugadoresAntesMovimiento.set(jugador.id, equipoByAdmin);
        }
        
        if (estadisticasPartido.iniciado && equipoByAdmin !== 0) {
            // Registrar jugador en estadísticas si se une durante el partido
            if (!estadisticasPartido.jugadores[jugador.id]) {
                const nombreOriginal = obtenerNombreOriginal(jugador);
                estadisticasPartido.jugadores[jugador.id] = {
                    nombre: nombreOriginal,
                    equipo: equipoByAdmin,
                    goles: 0,
                    asistencias: 0,
                    autogoles: 0,
                    arquero: false,
                    tiempo: 0
                };
            }
        }
        
        // Limpiar datos AFK cuando cambia de equipo
        jugadoresAFK.delete(jugador.id);
        advertenciasAFK.delete(jugador.id);
        
        // Verificar auto start/stop después del cambio de equipo
        setTimeout(() => {
            verificarAutoStart();
            verificarAutoStop(null);
        }, 500);
    };
    
    // Admin change
    room.onPlayerAdminChange = function(jugador, esByJugador) {
        if (esByJugador && !adminActual) {
            adminActual = jugador;
            anunciarExito(`👑 ${jugador.name} reclamó administrador`);
        }
    };

    // Inicio del juego
    room.onGameStart = function(jugadorByAdmin) {
        partidoEnCurso = true;
        tiempoInicioPartido = Date.now(); // Registrar el inicio del partido
        
        if (validarMapaPersonalizado()) {
            inicializarEstadisticas();
            
            // Mensaje de inicio del partido removido
            
            // Inicializar grabación de replay
            if (typeof room.startRecording === 'function') {
                try {
                    room.startRecording();
                    anunciarInfo("🎬 Grabación de replay iniciada");
                } catch (error) {
                    console.log("❌ Error al iniciar grabación:", error);
                }
            }
            
            // CORRECCIÓN: Forzar posiciones correctas de spawn después de iniciar
            setTimeout(() => {
                corregirPosicionesSpawn();
            }, 100); // Muy poco tiempo para que se ejecute rápido
            
            // Detectar arqueros
            setTimeout(() => {
                detectarArqueros();
            }, 2000);
        }
    };
    
    // Fin del juego
    room.onGameStop = function(jugadorByAdmin) {
        partidoEnCurso = false;
        
        if (estadisticasPartido.iniciado) {
            estadisticasPartido.duracion = Math.floor((Date.now() - tiempoInicioPartido) / 1000) - estadisticasPartido.tiempoEsperaSaque; // Restar el tiempo de espera para saque
            
            // Verificar si el partido terminó por cambio de mapa
            if (terminoPorCambioMapa) {
                console.log('🏁 DEBUG: Partido finalizado por cambio de mapa. Omitiendo envío de replay e informes.');
                estadisticasPartido.iniciado = false;
                liberarBloqueoReplay('Fin por cambio de mapa');
                return;
            }

            // ACTIVAR BLOQUEO DE AUTO-START HASTA COMPLETAR ENVÍO DE REPLAY
            bloqueadoPorReplay = true;
            intentosAutoStartBloqueados = 0; // Resetear contador
            console.log(`🔒 DEBUG: Activando bloqueo de auto-start para envío de replay`);
            
            // Actualizar tiempo jugado de cada jugador activo hasta el final del partido
            const jugadoresActuales = room.getPlayerList();
            jugadoresActuales.forEach(jugadorActual => {
                const stats = estadisticasPartido.jugadores[jugadorActual.id];
                if (stats && jugadorActual.team !== 0) {
                    // El tiempo total que estuvo en un equipo es la duración del partido
                    // (esto es una aproximación, en un sistema más avanzado trackearíamos cambios de equipo)
                    stats.tiempo = estadisticasPartido.duracion;
                }
            });
            
            // PRIMERO: Enviar informe de la sala usando formato embed consistente
            if (tieneEnlaceReal()) {
                console.log(`📤 Enviando reporte de sala post-partido...`);
                enviarOEditarReporteSala("Partido finalizado - Reporte de sala", false);
            }
            
            anunciarGeneral("🏁 ⭐ ¡PARTIDO FINALIZADO! ⭐ 🏁", "FFA500", "bold");
            
            const mejorJugador = calcularMejorJugador();
            if (mejorJugador) {
                anunciarGeneral(`⭐ 👑 MEJOR JUGADOR: ${mejorJugador.nombre.toUpperCase()} 👑 ⭐`, "FFD700", "bold");
            }
            
            // Enviar puntuaciones privadas a cada jugador después de mostrar el resultado
            enviarPuntuacionesPrivadas(); // Eliminado delay innecesario
            
            // Finalizar replay antes de enviar reporte
            finalizarReplay();
            
            // Guardar replay en PC si está configurado
            if (guardarReplaysEnPC) {
                guardarReplayEnPC();
            }
            
            // SEGUNDO: Enviar reporte del partido (con replay) si es oficial o si se guardan amistosos
            if (guardarAmistosos && !reporteEnviado) {
                enviarReportePartidoDiscord(); // Eliminado delay innecesario
            } else {
                // Si no se envía reporte, liberar bloqueo inmediatamente
                console.log(`🔓 DEBUG: No hay reporte que enviar, liberando bloqueo inmediatamente`);
                liberarBloqueoReplay("No hay reporte que enviar");
            }
            
            // Actualizar estadísticas globales antes del reset
            actualizarEstadisticasGlobales(estadisticasPartido);
            
            // Reset estadísticas
            estadisticasPartido.iniciado = false;
            
            // MEZCLAR EQUIPOS AUTOMÁTICAMENTE - CON DELAY PARA PERMITIR ENVÍO DE REPLAY
            setTimeout(() => {
                mezclarEquiposAleatoriamenteFinPartido();
            }, 3000); // Esperar 3 segundos para que termine el envío del replay
        } else {
            // Si no había estadísticas iniciadas, hacer auto balance y verificar auto start
            setTimeout(() => {
                autoBalanceEquipos();
                
                // Desactivar bloqueo de movimiento si estaba activo
                if (bloqueoMovimientoActivo) {
                    bloqueoMovimientoActivo = false;
                    anunciarGeneral("🔓 Bloqueo de movimiento desactivado", "00FF00", "normal");
                }
                
                setTimeout(() => {
                    verificarAutoStart();
                }, 300);
            }, 500);
        }
    };
}

// Función para mostrar puntuación de jugador
function mostrarPuntuacionJugador(jugador) {
    const stats = obtenerEstadisticasJugador(jugador.name);
    
    if (stats) {
        // Calcular puntuación total
        const puntuacionTotal = (
            stats.goles * 3 +           // 3 puntos por gol
            stats.asistencias * 2 +     // 2 puntos por asistencia
            stats.vallasInvictas * 5 +  // 5 puntos por valla invicta
            stats.hatTricks * 10 -      // 10 puntos por hat-trick (MVP)
            stats.autogoles * 2         // -2 puntos por autogol
        );
        
        room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
        room.sendAnnouncement(`🏆 PUNTUACIÓN DE ${jugador.name.toUpperCase()}`, jugador.id, parseInt(AZUL_LNB, 16), "bold", 0);
        room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
        room.sendAnnouncement(`⚽ Goles: ${stats.goles} (${stats.goles * 3} pts)`, jugador.id, parseInt("00FF00", 16), "normal", 0);
        room.sendAnnouncement(`🎯 Asistencias: ${stats.asistencias} (${stats.asistencias * 2} pts)`, jugador.id, parseInt("00FF00", 16), "normal", 0);
        room.sendAnnouncement(`🥅 Vallas invictas: ${stats.vallasInvictas} (${stats.vallasInvictas * 5} pts)`, jugador.id, parseInt("00FF00", 16), "normal", 0);
        room.sendAnnouncement(`👑 Hat-tricks: ${stats.hatTricks} (${stats.hatTricks * 10} pts)`, jugador.id, parseInt("FFD700", 16), "normal", 0);
        if (stats.autogoles > 0) {
            room.sendAnnouncement(`🤦 Autogoles: ${stats.autogoles} (-${stats.autogoles * 2} pts)`, jugador.id, parseInt("FF0000", 16), "normal", 0);
        }
        room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
        room.sendAnnouncement(`📊 PUNTUACIÓN TOTAL: ${puntuacionTotal} puntos`, jugador.id, parseInt("FFD700", 16), "bold", 0);
        room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", jugador.id, parseInt(AZUL_LNB, 16), "normal", 0);
    } else {
        anunciarError("❌ No tienes estadísticas registradas aún", jugador);
    }
}

// FUNCIONES PARA SISTEMA DE CONTRASEÑAS AUTOMÁTICAS
function generarContraseñaAleatoria() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Función para obtener estadísticas de jugador (función faltante agregada)
function obtenerEstadisticasJugador(nombre) {
    const stats = estadisticasGlobales.jugadores[nombre];
    return stats || null;
}

// FUNCIÓN CORREGIDA: obtenerInfoSala
function obtenerInfoSala() {
    try {
        if (!room) {
            console.warn('⚠️ Room no disponible para obtener info');
            return {
                nombre: roomName || "Sala LNB",
                enlace: enlaceRealSala || "[Enlace no disponible]",
                jugadoresTotales: 0,
                jugadoresEnJuego: 0,
                maxJugadores: maxPlayers || 23,
                contraseña: contraseñaActual,
                esPublica: !contraseñaActual,
                estadoPartido: "En espera",
                tiempoPartido: "--:--",
                resultadoActual: "0 - 0"
            };
        }
        
        const jugadores = room.getPlayerList();
        const totalJugadores = jugadores.filter(j => j.id !== 0).length; // Excluir bot
        const jugadoresEnJuego = jugadores.filter(j => j.team === 1 || j.team === 2).length;
        
        // Determinar estado del partido
        let estadoPartido = "En espera";
        let tiempoPartido = "--:--";
        let resultadoActual = "0 - 0";
        
        if (partidoEnCurso) {
            try {
                const scores = room.getScores();
                if (scores) {
                    const minutos = Math.floor(scores.time / 60);
                    const segundos = Math.floor(scores.time % 60);
                    tiempoPartido = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
                    resultadoActual = `${scores.red} - ${scores.blue}`;
                    estadoPartido = "En partido";
                }
            } catch (e) {
                console.warn('⚠️ No se pudieron obtener scores:', e.message);
            }
        }
        
        return {
            nombre: roomName || "Sala LNB",
            enlace: enlaceRealSala || "[Enlace no disponible]",
            jugadoresTotales: totalJugadores,
            jugadoresEnJuego: jugadoresEnJuego,
            maxJugadores: maxPlayers || 23,
            contraseña: contraseñaActual,
            esPublica: !contraseñaActual,
            estadoPartido,
            tiempoPartido,
            resultadoActual
        };
    } catch (error) {
        console.error('❌ Error en obtenerInfoSala:', error);
        return {
            nombre: roomName || "Sala LNB",
            enlace: enlaceRealSala || "[Enlace no disponible]",
            jugadoresTotales: 0,
            jugadoresEnJuego: 0,
            maxJugadores: maxPlayers || 23,
            contraseña: contraseñaActual,
            esPublica: !contraseñaActual,
            estadoPartido: "Error",
            tiempoPartido: "--:--",
            resultadoActual: "0 - 0"
        };
    }
}

// Función para enviar o editar mensaje según corresponda
function enviarOEditarReporteSala(razon = "Reporte automático", forzarEnvio = false) {
    try {
        // Control de throttling para evitar spam de reportes
        const ahora = Date.now();
        if (!forzarEnvio && (ahora - ultimoReporteSala) < INTERVALO_MINIMO_REPORTE) {
            console.log('🕐 DEBUG: Reporte ignorado por throttling - muy pronto desde el último');
            return;
        }
        ultimoReporteSala = ahora;
        
        if (!webhookReportesSala || webhookReportesSala.length === 0) {
            console.warn('⚠️ Webhook de reportes no configurado');
            return;
        }
        
        console.log('📊 DEBUG: Iniciando envío/edición de reporte de sala');
        console.log('🆔 DEBUG: ID de mensaje actual:', MENSAJE_IDS_DISCORD.reportesSala);
        console.log('🔄 DEBUG: Forzar envío:', forzarEnvio);
        
        const info = obtenerInfoSala();
        const estadoSala = info.esPublica ? "pública" : "privada";
        const iconoEstado = info.esPublica ? "🟢" : "🔴";
        
        // Emojis específicos para contraseña
        const iconoContraseña = info.contraseña ? "🔒" : "🔓";
        const contraseñaTexto = info.contraseña ? `"${info.contraseña}"` : "Sin contraseña";
        
        // Emoji para estado del partido
        let estadoEmoji = "⏳"; // Por defecto esperando jugadores
        let estadoTexto = "Esperando jugadores";
        
        if (info.jugadoresEnJuego >= 2 && !partidoEnCurso) {
            estadoEmoji = "🧍🧍‍♂️";
            estadoTexto = "Jugadores presentes, pero sin juego aún";
        } else if (partidoEnCurso) {
            estadoEmoji = "🕹️";
            estadoTexto = "Partido en juego";
        }
        
        // Formatear el mensaje según el nuevo formato ASCII sin embed
        const tipoSala = info.esPublica ? "Pública" : "Privada";
        const enlaceTexto = info.enlace !== "[Enlace no disponible]" ? info.enlace : "Enlace no disponible";
        
        // Crear mensaje con formato ASCII
        let mensaje = `╭━━━ 🏟️ Sala ${tipoSala} de Haxball ━━━╮\n`;
        mensaje += `┃ 🏷️ Nombre: \`${info.nombre}\`\n`;
        mensaje += `┃ 🔗 Enlace: ${enlaceTexto}\n`;
        mensaje += `┃ 👥 Jugadores: \`${info.jugadoresEnJuego} / ${info.maxJugadores}\`\n`;
        mensaje += `┃ ${iconoContraseña} Contraseña: \`${contraseñaTexto}\`\n`;
        mensaje += `┃ ${estadoEmoji} Estado: ${estadoTexto}\n`;
        
        // Agregar información del partido si está en curso
        if (partidoEnCurso) {
            mensaje += `┃ ⏱️ Tiempo: ${info.tiempoPartido}\n`;
            mensaje += `┃ ⚽ Resultado: 🔴 ${info.resultadoActual} 🔵\n`;
        }
        
        mensaje += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
        
        
        // Si es cambio de contraseña, agregar encabezado especial
        let contenidoFinal = mensaje;
        if (forzarEnvio) {
            contenidoFinal = `🔐 **CAMBIO AUTOMÁTICO DE CONTRASEÑA MENSUAL**\n\n${mensaje}`;
        }
        
        const payload = {
            content: contenidoFinal
        };
        
        // Intentar editar si tenemos ID de mensaje previo de reportes de sala
        if (MENSAJE_IDS_DISCORD.reportesSala && !forzarEnvio) {
            editarMensajeDiscordReportes(payload);
        } else {
            enviarNuevoMensajeDiscordReportes(payload);
        }
    } catch (error) {
        console.error('❌ Error en enviarOEditarReporteSala:', error);
    }
}

// Función para editar mensaje existente de reportes de sala
function editarMensajeDiscordReportes(payload) {
    console.log('🔧 DEBUG: Iniciando edición de mensaje con ID:', MENSAJE_IDS_DISCORD.reportesSala);
    console.log('🔧 DEBUG: Payload para edición:', JSON.stringify(payload, null, 2));

    // Usar nueva función nodeEditarMensajeDiscord si está disponible
    if (typeof nodeEditarMensajeDiscord === 'function') {
        console.log('📡 DEBUG: Usando nodeEditarMensajeDiscord para edición...');
        
        nodeEditarMensajeDiscord(webhookReportesSala, MENSAJE_IDS_DISCORD.reportesSala, payload)
            .then(result => {
                if (result.success) {
                    console.log('✅ DEBUG: Mensaje editado exitosamente via nodeEditarMensajeDiscord');
                    console.log('🆔 DEBUG: ID del mensaje confirmado:', result.messageId);
                    
                    // Actualizar ID si cambió
                    if (result.messageId && result.messageId !== MENSAJE_IDS_DISCORD.reportesSala) {
                        MENSAJE_IDS_DISCORD.reportesSala = result.messageId;
                    }
                } else {
                    console.log('❌ DEBUG: Error en nodeEditarMensajeDiscord:', result.status, result.error);
                    throw new Error(`nodeEditarMensajeDiscord falló: ${result.status || result.error}`);
                }
            })
            .catch(error => {
                console.error('❌ DEBUG: Error en nodeEditarMensajeDiscord:', error);
                console.log('🔄 DEBUG: Intentando con fetch como respaldo...');
                usarFetchParaEdicion(`${webhookReportesSala}/messages/${MENSAJE_IDS_DISCORD.reportesSala}`, payload);
            });
    } else {
        console.log('📡 DEBUG: Usando fetch nativo para edición...');
        usarFetchParaEdicion(`${webhookReportesSala}/messages/${MENSAJE_IDS_DISCORD.reportesSala}`, payload);
    }
}

// Función auxiliar para usar fetch en la edición
function usarFetchParaEdicion(webhookEditUrl, payload) {
    fetch(webhookEditUrl, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        console.log('📡 DEBUG: Respuesta de edición - Status:', response.status);
        console.log('📡 DEBUG: Respuesta OK:', response.ok);
        
        if (response.ok) {
            console.log('✅ DEBUG: Mensaje de reportes editado exitosamente');
            return response.json();
        } else {
            console.log('❌ DEBUG: Error al editar mensaje - status:', response.status);
            return response.text().then(text => {
                console.log('❌ DEBUG: Respuesta de error:', text);
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
    })
    .then(data => {
        console.log('📤 DEBUG: Edición completada exitosamente, data:', data);
        // Confirmar que el ID sigue siendo válido
        if (data && data.id && data.id !== MENSAJE_IDS_DISCORD.reportesSala) {
            console.log('🆔 DEBUG: ID del mensaje actualizado:', data.id);
            MENSAJE_IDS_DISCORD.reportesSala = data.id;
        }
    })
    .catch(error => {
        console.error('❌ DEBUG: Error en edición de mensaje de reportes:', error);
        console.log('🔄 DEBUG: El mensaje podría haber sido eliminado, enviando uno nuevo...');
        // Resetear ID y enviar mensaje nuevo
        const idAnterior = MENSAJE_IDS_DISCORD.reportesSala;
        MENSAJE_IDS_DISCORD.reportesSala = null;
        console.log('🗑️ DEBUG: ID resetado de', idAnterior, 'a null');
        
        setTimeout(() => {
            console.log('🔄 DEBUG: Enviando mensaje nuevo como respaldo después de fallo en edición');
            enviarNuevoMensajeDiscordReportes(payload);
        }, 2000); // Aumentar delay a 2 segundos
    });
}

// Función para enviar nuevo mensaje de reportes de sala
function enviarNuevoMensajeDiscordReportes(payload) {
    console.log('📤 DEBUG: Enviando nuevo mensaje de reportes...');
    console.log('🔗 DEBUG: Webhook URL:', webhookReportesSala);
    console.log('📦 DEBUG: Payload:', JSON.stringify(payload, null, 2));
    
    // Usar función nodeEnviarWebhook si está disponible (para Node.js)
    if (typeof nodeEnviarWebhook === 'function') {
        console.log('📡 DEBUG: Usando nodeEnviarWebhook para envío...');
        
        nodeEnviarWebhook(webhookReportesSala, payload)
            .then(success => {
                if (success) {
                    console.log('✅ DEBUG: Mensaje enviado exitosamente via nodeEnviarWebhook');
                    // Nota: nodeEnviarWebhook no devuelve el ID del mensaje
                    // Por eso no podemos guardarlo para futuras ediciones
                    console.log('⚠️ DEBUG: No se puede obtener ID del mensaje con nodeEnviarWebhook');
                } else {
                    throw new Error('nodeEnviarWebhook falló');
                }
            })
            .catch(error => {
                console.error('❌ DEBUG: Error en nodeEnviarWebhook:', error);
                console.log('🔄 DEBUG: Intentando con fetch como respaldo...');
                usarFetchParaEnvio(payload);
            });
    } else {
        console.log('📡 DEBUG: Usando fetch nativo para envío...');
        usarFetchParaEnvio(payload);
    }
}

// Función auxiliar para usar fetch en el envío
function usarFetchParaEnvio(payload) {
    fetch(webhookReportesSala, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        console.log('📡 DEBUG: Respuesta de envío - Status:', response.status);
        console.log('📡 DEBUG: Respuesta OK:', response.ok);
        
        if (response.ok) {
            return response.json();
        } else {
            return response.text().then(text => {
                console.log('❌ DEBUG: Error en envío:', text);
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
    })
    .then(data => {
        console.log('✅ DEBUG: Nuevo mensaje de reportes enviado exitosamente');
        console.log('📋 DEBUG: Respuesta completa:', data);
        
        if (data && data.id) {
            const idAnterior = MENSAJE_IDS_DISCORD.reportesSala;
            MENSAJE_IDS_DISCORD.reportesSala = data.id;
            console.log('🆔 DEBUG: ID del mensaje guardado:', data.id);
            console.log('🔄 DEBUG: ID anterior:', idAnterior, '-> ID nuevo:', data.id);
            
            // Marcar enlace como confirmado si se solicita
            if (!enlaceRealConfirmado && enlaceRealSala && !enlaceRealSala.includes('abcd1234')) {
                enlaceRealConfirmado = true;
                console.log('🔗 DEBUG: enlaceRealConfirmado = true (mensaje nuevo enviado)');
            }
        } else {
            console.warn('⚠️ DEBUG: No se recibió ID en la respuesta:', data);
        }
    })
    .catch(error => {
        console.error('❌ DEBUG: Error al enviar nuevo mensaje de reportes:', error);
        // En caso de error, resetear el ID para forzar nuevos envíos
        MENSAJE_IDS_DISCORD.reportesSala = null;
        console.log('🗑️ DEBUG: ID resetado a null debido al error');
    });
}

// Función para editar mensaje existente en Discord (función general mantenida para compatibilidad)
function editarMensajeDiscord(mensaje) {
    if (!ultimoMensajeDiscordId) {
        console.log('❌ DEBUG: No hay mensaje previo para editar, enviando mensaje nuevo...');
        enviarMensajeDiscord(mensaje);
        return;
    }

    const webhookUrl = webhookReportesSala;
    if (!webhookUrl || webhookUrl.length === 0) {
        console.log('❌ DEBUG: No hay webhook URL configurado para editar');
        return;
    }

    // URL para editar mensaje usando webhook
    const webhookEditUrl = `${webhookUrl}/messages/${ultimoMensajeDiscordId}`;
    console.log('🔧 DEBUG: Editando mensaje con ID:', ultimoMensajeDiscordId);

    const payload = {
        content: mensaje
    };

    fetch(webhookEditUrl, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
            console.log('✅ DEBUG: Mensaje editado exitosamente en Discord');
        } else {
            console.log('❌ DEBUG: Error al editar mensaje:', response.status);
            // Si falla la edición, enviar mensaje nuevo como respaldo
            console.log('🔄 DEBUG: Enviando mensaje nuevo como respaldo...');
            ultimoMensajeDiscordId = null; // Resetear ID para próximos envíos
            enviarMensajeDiscord(mensaje);
        }
    })
    .catch(error => {
        console.error('❌ DEBUG: Error en fetch al editar mensaje:', error);
        // Si falla la edición, enviar mensaje nuevo como respaldo
        console.log('🔄 DEBUG: Enviando mensaje nuevo como respaldo...');
        ultimoMensajeDiscordId = null; // Resetear ID para próximos envíos
        enviarMensajeDiscord(mensaje);
    });
}

// FUNCIÓN DEPRECADA - Reemplazada por enviarOEditarReporteSala para consistencia
function enviarOEditarMensajeDiscord(mensaje, confirmarEnlace = false) {
    console.warn('⚠️ enviarOEditarMensajeDiscord() está deprecada - redirigiendo a enviarOEditarReporteSala()');
    console.log('📤 DEBUG: Redirigiendo a formato embed unificado');
    
    // Redirigir a la función unificada
    enviarOEditarReporteSala("Mensaje redirigido desde función deprecada", confirmarEnlace);
}

// FUNCIÓN DEPRECADA - Reemplazada por enviarOEditarReporteSala para consistencia
function enviarMensajeDiscord(mensaje, confirmarEnlace = false) {
    console.warn('⚠️ enviarMensajeDiscord() está deprecada - redirigiendo a enviarOEditarReporteSala()');
    console.log('📤 DEBUG: Redirigiendo mensaje de texto simple a formato embed unificado');
    
    // Redirigir a la función unificada que usa embeds
    enviarOEditarReporteSala("Mensaje redirigido desde función deprecada", confirmarEnlace);
}

// Función fallback usando XMLHttpRequest para entornos donde fetch no funciona
function enviarMensajeDiscordXHR(webhookUrl, payload, confirmarEnlace = false) {
    try {
        console.log('🔄 DEBUG: Usando XMLHttpRequest para enviar mensaje...');
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', webhookUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                console.log('📤 DEBUG XHR: Estado final:', xhr.readyState, 'Status:', xhr.status);
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log('✅ DEBUG XHR: Mensaje enviado exitosamente');
                    
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data && data.id) {
                            ultimoMensajeDiscordId = data.id;
                            console.log('🆔 DEBUG XHR: ID del mensaje guardado:', ultimoMensajeDiscordId);
                        }
                    } catch (parseError) {
                        console.log('⚠️ DEBUG XHR: No se pudo parsear respuesta, pero envío exitoso');
                    }
                    
                    if (confirmarEnlace) {
                        enlaceRealConfirmado = true;
                        console.log('🔗 DEBUG XHR: enlaceRealConfirmado = true');
                    }
                } else {
                    console.error('❌ DEBUG XHR: Error en envío:', xhr.status, xhr.statusText);
                    console.error('❌ DEBUG XHR: Respuesta:', xhr.responseText);
                }
            }
        };
        
        xhr.onerror = function() {
            console.error('❌ DEBUG XHR: Error de red al enviar mensaje');
        };
        
        xhr.ontimeout = function() {
            console.error('❌ DEBUG XHR: Timeout al enviar mensaje');
        };
        
        // Establecer timeout de 10 segundos
        xhr.timeout = 10000;
        
        xhr.send(JSON.stringify(payload));
        console.log('📦 DEBUG XHR: Payload enviado');
        
    } catch (error) {
        console.error('❌ DEBUG XHR: Error general:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    }
}

// Función para verificar si el enlace real está disponible
function tieneEnlaceReal() {
    // Si ya se confirmó el envío exitoso del enlace real, siempre permitir
    if (enlaceRealConfirmado) {
        return true;
    }
    // Si no, verificar que tengamos un enlace real válido
    return enlaceRealSala && !enlaceRealSala.includes('abcd1234');
}

// FUNCIÓN DEPRECADA - Reemplazada por enviarOEditarReporteSala para consistencia
// Esta función ya no se usa para evitar inconsistencias en formatos
function generarInformeSala(razon = "Estado de sala actualizado", forzarEnvio = false) {
    console.warn('⚠️ generarInformeSala() está deprecada - redirigiendo a enviarOEditarReporteSala()');
    
    // Redirigir a la función unificada
    enviarOEditarReporteSala(razon, forzarEnvio);
    
    return "Redirigido a función unificada";
}

// Función para cambiar contraseña automáticamente
function cambiarContraseñaAutomatica() {
    const nuevaContraseña = generarContraseñaAleatoria();
    contraseñaActual = nuevaContraseña;
    ultimoCambioContraseña = Date.now();
    
    room.setPassword(nuevaContraseña);
    
    // Solo enviar reporte si tenemos el enlace real
    if (tieneEnlaceReal()) {
        enviarOEditarReporteSala("Cambio automático de contraseña", true);
    }
    
    anunciarGeneral(`🔐 ⚠️ CONTRASEÑA CAMBIADA AUTOMÁTICAMENTE ⚠️ 🔐`, "FF6B6B", "bold");
    anunciarGeneral(`🔑 Nueva contraseña: ${nuevaContraseña}`, "FFD700", "bold");
}

// Función para verificar si debe cambiar la contraseña (cada mes)
function verificarCambioContraseña() {
    const ahora = Date.now();
    const unMes = 30 * 24 * 60 * 60 * 1000; // 30 días en milisegundos
    
    if (!ultimoCambioContraseña || (ahora - ultimoCambioContraseña) >= unMes) {
        cambiarContraseñaAutomatica();
    }
}

// INICIALIZACIÓN
function inicializar() {
    console.log('🚀 DEBUG: Iniciando configuración de la sala...');
    console.log('📋 DEBUG: Configuración de sala:', {
        roomName: roomName,
        maxPlayers: maxPlayers,
        public: roomPublic,
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        geo: geo,
        password: roomPassword
    });
    
    // Verificar que HBInit esté disponible
    if (typeof HBInit === 'undefined') {
        console.error('❌ CRITICAL: HBInit no está disponible!');
        console.error('❌ Verificando contexto global:', {
            hasWindow: typeof window !== 'undefined',
            hasGlobal: typeof global !== 'undefined',
            isNode: typeof process !== 'undefined'
        });
        return;
    }
    
    console.log('✅ HBInit está disponible');
    console.log('🔧 DEBUG: Tipo de HBInit:', typeof HBInit);
    
    // Validar el token antes de crear la sala
    if (!token || token.length < 10) {
        console.error('❌ CRITICAL: Token inválido o muy corto:', {
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            tokenStart: token ? token.substring(0, 10) + '...' : 'N/A'
        });
        return;
    }
    
    console.log('✅ Token válido detectado:', {
        length: token.length,
        start: token.substring(0, 10) + '...'
    });
    
    try {
        console.log('🔧 DEBUG: Llamando a HBInit con configuración...');
        
        const configSala = {
            roomName: roomName,
            playerName: "", // Nombre vacío para ocultar el bot
            password: roomPassword,
            maxPlayers: maxPlayers,
            public: roomPublic,
            token: token,
            geo: geo, // Usar coordenadas de Buenos Aires, Argentina
            noPlayer: true // Bot no aparece como jugador
        };
        
        console.log('📄 DEBUG: Configuración final para HBInit:', configSala);
        
        // Crear sala
        room = HBInit(configSala);
        
        console.log('✅ DEBUG: HBInit ejecutado sin errores');
        console.log('🔍 DEBUG: Objeto room creado:', {
            type: typeof room,
            isNull: room === null,
            isUndefined: room === undefined,
            hasOnRoomLink: room && typeof room.onRoomLink !== 'undefined',
            onRoomLinkType: room ? typeof room.onRoomLink : 'N/A'
        });
        
        // Verificar todas las propiedades importantes del room
        if (room) {
            console.log('🔍 DEBUG: Propiedades del objeto room:', {
                onRoomLink: typeof room.onRoomLink,
                onPlayerJoin: typeof room.onPlayerJoin,
                onPlayerLeave: typeof room.onPlayerLeave,
                onPlayerChat: typeof room.onPlayerChat,
                onGameStart: typeof room.onGameStart,
                onGameStop: typeof room.onGameStop,
                sendAnnouncement: typeof room.sendAnnouncement,
                getPlayerList: typeof room.getPlayerList,
                setCustomStadium: typeof room.setCustomStadium
            });
        } else {
            console.error('❌ CRITICAL: room es null o undefined después de HBInit');
            return;
        }
        
        // Verificar que el objeto room tenga las propiedades esperadas
        if (room && typeof room.onRoomLink !== 'undefined') {
            console.log('✅ DEBUG: room.onRoomLink está disponible:', typeof room.onRoomLink);
            
            if (typeof room.onRoomLink === 'function') {
                console.log('✅ DEBUG: room.onRoomLink es una función válida');
            } else {
                console.log('⚠️ DEBUG: room.onRoomLink existe pero no es función:', typeof room.onRoomLink);
            }
        } else {
            console.error('❌ DEBUG: room.onRoomLink NO está disponible');
            console.error('❌ DEBUG: Propiedades disponibles en room:', Object.keys(room || {}));
        }
        
        // CONFIGURAR MANUALMENTE onRoomLink SI NO ESTÁ DISPONIBLE
        if (room && typeof room.onRoomLink === 'undefined') {
            console.log('🔧 DEBUG: Configurando onRoomLink manualmente...');
            
            // Configurar el evento onRoomLink manualmente
            room.onRoomLink = function(link) {
                console.log('\n' + '🎆'.repeat(40));
                console.log('🔗 ¡¡¡ENLACE DE LA SALA CAPTURADO MANUALMENTE!!!');
                console.log('📋 URL RECIBIDA: ' + link);
                console.log('📍 Tipo de URL: ' + typeof link);
                console.log('📐 Longitud de URL: ' + (link ? link.length : 'null'));
                console.log('🕐 Timestamp: ' + new Date().toISOString());
                console.log('🎆'.repeat(40) + '\n');
                
                if (link && typeof link === 'string' && link.length > 0) {
                    enlaceRealSala = link;
                    console.log('✅ enlaceRealSala actualizado manualmente: ' + enlaceRealSala);
                    
                    // Enviar reporte inmediato con el enlace
                    setTimeout(() => {
                        try {
                            enviarOEditarReporteSala("Enlace capturado manualmente", false);
                            console.log('📤 Reporte enviado con enlace capturado manualmente');
                        } catch (error) {
                            console.error('❌ Error al enviar reporte:', error);
                        }
                    }, 2000);
                } else {
                    console.error('❌ ERROR: URL inválida recibida en onRoomLink manual');
                }
            };
            
            console.log('✅ DEBUG: onRoomLink configurado manualmente');
        }
        
        // Verificar si ya hay un enlace disponible inmediatamente
        if (room && typeof room.getLink === 'function') {
            try {
                const linkInmediato = room.getLink();
                console.log('🔗 DEBUG: Enlace inmediato disponible:', linkInmediato);
                if (linkInmediato) {
                    enlaceRealSala = linkInmediato;
                    console.log('✅ DEBUG: Enlace guardado inmediatamente');
                    
                    // Si ya tenemos el enlace, enviar reporte inmediatamente
                    setTimeout(() => {
                        try {
                            enviarOEditarReporteSala("Enlace inmediato disponible", false);
                            console.log('📤 Reporte enviado con enlace inmediato');
                        } catch (error) {
                            console.error('❌ Error al enviar reporte inmediato:', error);
                        }
                    }, 3000);
                }
            } catch (error) {
                console.log('⚠️ DEBUG: No se pudo obtener enlace inmediato:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ ERROR CRÍTICO al crear sala con HBInit:', error);
        console.error('❌ Nombre del error:', error.name);
        console.error('❌ Mensaje del error:', error.message);
        console.error('❌ Stack trace completo:', error.stack);
        
        // Intentar diagnosticar el error
        if (error.message && error.message.includes('token')) {
            console.error('💡 POSIBLE CAUSA: Problema con el token de autenticación');
            console.error('🔧 SUGERENCIA: Verificar que el token sea válido y esté actualizado');
        }
        
        if (error.message && error.message.includes('geo')) {
            console.error('💡 POSIBLE CAUSA: Problema con la configuración geográfica');
        }
        
        return;
    }
    
    // Bot configurado - sin intentos de invisibilidad
    
    // Cargar estadísticas globales desde localStorage
    cargarEstadisticasGlobalesCompletas();
    
    // Configurar eventos
    configurarEventos();
    
    // Establecer mapa inicial usando la variable mapaActual
    console.log('🗺️ DEBUG: Configurando mapa inicial INMEDIATAMENTE...');
    console.log(`🔍 DEBUG: mapaActual definido: ${mapaActual}`);
    
    // Intento inmediato usando la variable mapaActual
    if (cambiarMapa(mapaActual)) {
        console.log(`✅ DEBUG: Mapa inicial configurado correctamente (inmediato): ${mapaActual}`);
        mapaRealmenteAplicado = true;
    } else {
        console.log('⚠️ DEBUG: Fallo en intento inmediato, programando reintento...');
        mapaRealmenteAplicado = false;
    }
    
    // Segundo intento después de 100ms
    setTimeout(() => {
        console.log('🗺️ DEBUG: Configurando mapa inicial (Intento con delay 100ms)...');
        console.log(`🔍 DEBUG: Intentando configurar: ${mapaActual}`);
    
        if (cambiarMapa(mapaActual)) {
            console.log(`✅ DEBUG: Mapa configurado correctamente en intento 100ms: ${mapaActual}`);
            console.log(`🔍 DEBUG: Variable mapaActual confirmada: ${mapaActual}`);
            mapaRealmenteAplicado = true;
        } else {
            console.error(`❌ DEBUG: Error al configurar mapa inicial en intento 100ms: ${mapaActual}`);
            mapaRealmenteAplicado = false;
        }
    }, 100);
    
    // Tercer intento después de 500ms
    setTimeout(() => {
        console.log('🗺️ DEBUG: Configurando mapa inicial (Intento 500ms)...');
        console.log(`🔍 DEBUG: Variable mapaActual antes del cambio: ${mapaActual}`);
        console.log(`🔍 DEBUG: Mapa objetivo: ${mapaActual}`);
    
        // Verificar si el mapa actual no coincide con el objetivo o si falló el cambio
        const mapaConfigurado = mapaActual; // Guardar referencia
        if (!cambiarMapa(mapaActual)) {
            console.log(`🔄 DEBUG: Forzando cambio de mapa a: ${mapaActual}`);
    
            try {
                // Forzar el cambio usando la variable mapaActual
                const mapa = mapas[mapaActual];
                if (mapa && room && typeof room.setCustomStadium === 'function') {
                    room.setCustomStadium(mapa.hbs);
                    
                    // Configurar límites según el mapa
                    if (mapaActual === "biggerx3") {
                        room.setTimeLimit(3); // 3 minutos
                        room.setScoreLimit(5); // Máximo 5 goles
                    } else if (mapaActual === "biggerx5") {
                        room.setTimeLimit(5); // 5 minutos
                        room.setScoreLimit(4); // Máximo 4 goles
                    } else if (mapaActual === "biggerx7") {
                        room.setTimeLimit(5); // 5 minutos
                        room.setScoreLimit(5); // Máximo 5 goles
                    } else {
                        room.setTimeLimit(5); // 5 minutos por defecto
                        room.setScoreLimit(0); // Sin límite por defecto
                    }
    
                    console.log(`✅ DEBUG: Mapa forzado exitosamente a: ${mapaActual}`);
                    anunciarExito(`🗺️ Mapa establecido: ${mapa.nombre}`);
                    mapaRealmenteAplicado = true;
                } else {
                    console.error(`❌ DEBUG: No se pudo forzar el cambio de mapa a: ${mapaActual}`);
                    console.error(`❌ DEBUG: Mapa disponible: ${!!mapas[mapaActual]}`);
                    console.error(`❌ DEBUG: Room disponible: ${!!room}`);
                    console.error(`❌ DEBUG: setCustomStadium disponible: ${!!(room && room.setCustomStadium)}`);
                    mapaRealmenteAplicado = false;
                }
            } catch (error) {
                console.error(`❌ DEBUG: Error al forzar cambio de mapa a ${mapaActual}:`, error);
            }
        } else {
            console.log(`✅ DEBUG: Mapa ya está configurado correctamente: ${mapaActual}`);
        }
    
        setTimeout(() => {
            console.log('🔍 DEBUG: Verificación final del mapa después de intentos...');
            console.log(`🗺️ DEBUG: mapaActual final: ${mapaActual}`);
            console.log(`🗺️ DEBUG: Mapa objetivo era: ${mapaConfigurado}`);
    
            // Verificación final: si no coincide con el objetivo, último intento
            if (mapaActual !== mapaConfigurado) {
                console.error(`❌ DEBUG: CRÍTICO - El mapa no coincide con el objetivo`);
                console.error(`❌ DEBUG: Esperado: ${mapaConfigurado}, Actual: ${mapaActual}`);
                console.error(`❌ DEBUG: Último intento de cambio forzado...`);
    
                try {
                    const mapa = mapas[mapaConfigurado];
                    if (mapa) {
                        room.setCustomStadium(mapa.hbs);
                        mapaActual = mapaConfigurado; // Actualizar la variable
                        
                        // Configurar límites según el mapa
                        if (mapaConfigurado === "biggerx3") {
                            room.setTimeLimit(3);
                            room.setScoreLimit(5);
                        } else if (mapaConfigurado === "biggerx5") {
                            room.setTimeLimit(5);
                            room.setScoreLimit(4);
                        } else if (mapaConfigurado === "biggerx7") {
                            room.setTimeLimit(5);
                            room.setScoreLimit(5);
                        } else {
                            room.setTimeLimit(5);
                            room.setScoreLimit(0);
                        }
                        
                        console.log(`🔧 DEBUG: Cambio forzado en última tentativa exitoso: ${mapaConfigurado}`);
                        anunciarExito(`🗺️ Mapa final establecido: ${mapa.nombre}`);
                        mapaRealmenteAplicado = true;
                    }
                } catch (finalError) {
                    console.error(`❌ DEBUG: FALLO CRÍTICO - No se pudo establecer el mapa ${mapaConfigurado}:`, finalError);
                    mapaRealmenteAplicado = false;
                }
            } else {
                console.log(`✅ DEBUG: Mapa inicial confirmado correctamente: ${mapaActual}`);
                mapaRealmenteAplicado = true;
            }
        }, 2000);
    }, 500);
    
    // Configuración inicial de la sala
    room.setKickRateLimit(2, 1, 0); // Límite de kicks (configurado al inicio)
    
    // Iniciar verificación de inactividad después de crear la sala
    intervalAFK = setInterval(verificarInactividad, 5000); // Verificar cada 5 segundos
    
    // Iniciar verificación automática de cambio de mapa cada 10 segundos
    setInterval(detectarCambioMapa, 10000); // Verificar cada 10 segundos
    
    // Actualizar nombres con niveles cada 30 segundos
    setInterval(actualizarTodosLosNombres, 30000);
    
    // Iniciar anuncios de Discord
    iniciarAnunciosDiscord();
    
    // Sistema de contraseñas automáticas DESACTIVADO para mantener sala pública
    // Se eliminó el cambio automático de contraseñas para permitir acceso libre
    
    // Mensaje de bienvenida
    anunciarGeneral("🔵⚡ ¡BIENVENIDOS A LA LIGA NACIONAL DE BIGGER LNB! ⚡🔵", AZUL_LNB, "bold");
    anunciarInfo("🎮 Usa !ayuda para ver todos los comandos disponibles");
    anunciarInfo("🏆 Modo oficial disponible para administradores");
    anunciarInfo("🤖 Auto balance, auto start y auto stop ACTIVADOS");
    
}

// FUNCIÓN AUXILIAR PARA INICIALIZAR SISTEMAS
function inicializarSistemas() {
    // Cargar estadísticas globales
    cargarEstadisticasGlobalesCompletas();
    
    // Inicializar intervalos y timers
    if (intervalAFK) {
        clearInterval(intervalAFK);
    }
    intervalAFK = setInterval(verificarInactividad, 5000);
    
    // Iniciar detección de cambio de mapa
    setInterval(detectarCambioMapa, 10000);
    
    // Actualizar nombres con niveles
    setInterval(actualizarTodosLosNombres, 30000);
    
    // Iniciar anuncios de Discord
    iniciarAnunciosDiscord();
    
    // Sistema de limpieza de datos
    setInterval(limpiarDatosExpirados, 60000); // Cada minuto
    setInterval(limpiarDatosSpam, 120000); // Cada 2 minutos
    
    console.log('✅ Sistemas inicializados correctamente');
}

// FUNCIÓN PRINCIPAL DE INICIALIZACIÓN DEL BOT
function inicializarBot() {
    console.log('🤖 Iniciando BOT LNB...');
    
    // PREVENIR DOBLE INICIALIZACIÓN - Verificar si ya existe room
    if (typeof room !== 'undefined' && room !== null) {
        console.log('⚠️ ADVERTENCIA: Room ya existe, evitando doble inicialización');
        console.log('✅ Sala ya creada exitosamente (usando instancia existente)');
        return true;
    }
    
    // Verificar que HBInit esté disponible
    if (typeof HBInit === 'undefined') {
        console.error('❌ HBInit no está disponible');
        return false;
    }
    
    try {
        // Crear la sala
        room = HBInit({
            roomName: roomName,
            playerName: "", // Nombre vacío para ocultar el bot
            maxPlayers: maxPlayers,
            public: roomPublic,
            password: roomPassword,
            token: token,
            geo: geo,
            noPlayer: true // Bot no aparece como jugador (INVISIBLE)
        });
        
        console.log('✅ Sala creada exitosamente');
        
        // Configurar eventos
        configurarEventos();
        
        // Inicializar sistemas
        inicializarSistemas();
        
        // Establecer mapa inicial con delay para asegurar que la sala esté completamente lista
        setTimeout(() => {
            console.log('🗺️ Configurando mapa inicial:', mapaActual);
            if (cambiarMapa(mapaActual)) {
                console.log('✅ Mapa configurado exitosamente:', mapas[mapaActual].nombre);
            } else {
                console.error('❌ Error al configurar mapa inicial');
                // Intentar con biggerx1 como respaldo
                if (cambiarMapa('biggerx1')) {
                    console.log('✅ Mapa de respaldo configurado: Bigger x1');
                }
            }
        }, 1000);
        
        console.log('🎮 BOT LNB iniciado completamente');
        return true;
        
    } catch (error) {
        console.error('❌ Error al inicializar el bot:', error);
        return false;
    }
}

// FUNCIÓN PARA LIMPIAR TODAS LAS CONEXIONES AL INICIALIZAR
function limpiarTodasLasConexionesAlInicializar() {
    console.log('🧹 Limpiando todas las conexiones activas al inicializar el bot...');
    
    return new Promise((resolve, reject) => {
        try {
            // Usar la función de Node.js para limpiar todas las conexiones
            if (typeof nodeLimpiarTodasLasConexiones === 'function') {
                nodeLimpiarTodasLasConexiones().then(resultado => {
                    if (resultado && resultado.success) {
                        console.log(`✅ ${resultado.conexionesDesactivadas || 0} conexiones desactivadas al inicializar`);
                    } else {
                        console.warn('⚠️ No se pudieron limpiar las conexiones o no había conexiones activas');
                    }
                    
                    // También limpiar los mapas de memoria
                    conexionesPorIP.clear();
                    jugadoresPorIP.clear();
                    ipsBloqueadas.clear();
                    console.log('🧹 Mapas de memoria de conexiones IP limpiados');
                    
                    resolve();
                }).catch(error => {
                    console.error('❌ Error limpiando conexiones al inicializar:', error);
                    
                    // También limpiar los mapas de memoria aunque falle la BD
                    conexionesPorIP.clear();
                    jugadoresPorIP.clear();
                    ipsBloqueadas.clear();
                    console.log('🧹 Mapas de memoria de conexiones IP limpiados');
                    
                    resolve(); // Resolver aunque falle para continuar con la inicialización
                });
            } else if (typeof nodeLimpiarConexionesInactivas === 'function') {
                // Función alternativa si no existe la función específica
                try {
                    nodeLimpiarConexionesInactivas();
                    console.log('✅ Limpieza de conexiones inactivas ejecutada al inicializar');
                } catch (error) {
                    console.error('❌ Error en nodeLimpiarConexionesInactivas:', error);
                }
                
                // También limpiar los mapas de memoria
                conexionesPorIP.clear();
                jugadoresPorIP.clear();
                ipsBloqueadas.clear();
                console.log('🧹 Mapas de memoria de conexiones IP limpiados');
                
                resolve();
            } else {
                console.warn('⚠️ Funciones de limpieza de conexiones no disponibles');
                
                // Solo limpiar los mapas de memoria
                conexionesPorIP.clear();
                jugadoresPorIP.clear();
                ipsBloqueadas.clear();
                console.log('🧹 Mapas de memoria de conexiones IP limpiados');
                
                resolve();
            }
        } catch (error) {
            console.error('❌ Error limpiando conexiones al inicializar:', error);
            
            // También limpiar los mapas de memoria aunque falle
            conexionesPorIP.clear();
            jugadoresPorIP.clear();
            ipsBloqueadas.clear();
            console.log('🧹 Mapas de memoria de conexiones IP limpiados');
            
            resolve(); // Resolver aunque falle para continuar con la inicialización
        }
    });
}

// INICIALIZACIÓN AUTOMÁTICA
// Solo ejecutar si estamos en el contexto correcto (navegador con HBInit disponible)
if (typeof window !== 'undefined' && typeof HBInit !== 'undefined') {
    // Estamos en el navegador con HBInit disponible
    console.log('🌐 Detectado contexto de navegador con HBInit');
    
    // Usar setTimeout para evitar top-level await en page.evaluate()
    setTimeout(function inicializarBotCompleto() {
        try {
            console.log('🧹 Iniciando limpieza de conexiones...');
            limpiarTodasLasConexionesAlInicializar().then(() => {
                console.log('✅ Limpieza inicial completada, iniciando bot...');
                inicializarBot();
            }).catch(error => {
                console.error('❌ Error en limpieza inicial, pero continuando con inicialización:', error);
                inicializarBot();
            });
        } catch (error) {
            console.error('❌ Error en limpieza inicial, pero continuando con inicialización:', error);
            inicializarBot();
        }
    }, 100);
} else {
    console.log('⚠️ Esperando contexto de HaxBall...');
    // Exportar la función para uso externo
    if (typeof window !== 'undefined') {
        window.inicializarBot = inicializarBot;
        window.limpiarTodasLasConexionesAlInicializar = limpiarTodasLasConexionesAlInicializar;
    }
}
