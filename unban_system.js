/**
 * SISTEMA DE DESBANEO MEJORADO
 * Sistema robusto para desbanear jugadores usando múltiples métodos de búsqueda
 */

// Función principal para desbanear un jugador
async function ejecutarDesbaneo(uidParametro, jugadorAdmin, room, funciones) {
    const { 
        nodeObtenerJugadoresBaneados24h, 
        nodeObtenerBaneosActivos,
        nodeDesbanearJugador,
        nodeDesbanearJugadorNuevo,
        anunciarError,
        anunciarExito,
        anunciarInfo,
        anunciarAdvertencia
    } = funciones;
    
    // Debug: Mostrar información del admin ejecutor
    console.log(`🔐 UNBAN: Admin ejecutor: ${jugadorAdmin.name} (Auth: ${jugadorAdmin.auth || 'N/A'})`);
    
    // Protección adicional: Verificar si se intenta desbanear el propio UID del admin
    if (jugadorAdmin.auth && (uidParametro === jugadorAdmin.auth || uidParametro === jugadorAdmin.auth.toString())) {
        console.log(`🛡️ UNBAN: PROTECCIÓN GENERAL - El admin intenta desbanearse a sí mismo`);
        anunciarError(`❌ No puedes desbanearte a ti mismo usando tu propio UID`, jugadorAdmin);
        anunciarError(`💡 Tu UID actual es: ${jugadorAdmin.auth}`, jugadorAdmin);
        return false;
    }

    console.log(`🔍 UNBAN: Iniciando desbaneo para parámetro: "${uidParametro}"`);
    
    try {
        // PASO 1: Buscar en jugadores baneados de la tabla principal (jugadores)
        let jugadorEncontrado = null;
        
        if (typeof nodeObtenerJugadoresBaneados24h === 'function') {
            try {
                const jugadoresBaneados = await nodeObtenerJugadoresBaneados24h();
                console.log(`📊 UNBAN: Encontrados ${jugadoresBaneados.length} jugadores baneados en tabla 'jugadores'`);
                
                // Buscar por múltiples criterios
                jugadorEncontrado = buscarJugadorEnLista(jugadoresBaneados, uidParametro);
                
                if (jugadorEncontrado) {
                    console.log(`✅ UNBAN: Jugador encontrado en tabla 'jugadores': ${jugadorEncontrado.nombre} (UID: ${jugadorEncontrado.uid})`);
                    
                    // Desbanear usando el sistema de tabla jugadores
                    return await desbanearEnTablaJugadores(jugadorEncontrado, jugadorAdmin, room, {
                        nodeDesbanearJugador,
                        anunciarExito,
                        anunciarAdvertencia,
                        anunciarError
                    });
                }
            } catch (error) {
                console.error('⚠️ UNBAN: Error buscando en tabla jugadores:', error);
            }
        }
        
        // PASO 2: Buscar en la tabla de baneos activos
        if (!jugadorEncontrado && typeof nodeObtenerBaneosActivos === 'function') {
            try {
                const baneosActivos = await nodeObtenerBaneosActivos();
                console.log(`📊 UNBAN: Encontrados ${baneosActivos.length} baneos activos en tabla 'baneos'`);
                
                // Buscar por múltiples criterios (usar authId como uid)
                const baneosList = baneosActivos.map(b => ({
                    nombre: b.nombre,
                    uid: b.authId, // En la tabla baneos, el UID se llama authId
                    fechaBan: b.fecha,
                    razonBan: b.razon,
                    adminBan: b.admin
                }));
                
                jugadorEncontrado = buscarJugadorEnLista(baneosList, uidParametro);
                
                if (jugadorEncontrado) {
                    console.log(`✅ UNBAN: Jugador encontrado en tabla 'baneos': ${jugadorEncontrado.nombre} (AuthID: ${jugadorEncontrado.uid})`);
                    
                    // Desbanear usando el sistema de tabla baneos
                    return await desbanearEnTablaBaneos(jugadorEncontrado, jugadorAdmin, room, {
                        nodeDesbanearJugadorNuevo,
                        anunciarExito,
                        anunciarAdvertencia,
                        anunciarError
                    });
                }
            } catch (error) {
                console.error('⚠️ UNBAN: Error buscando en tabla baneos:', error);
            }
        }
        
        // PASO 3: No se encontró el jugador
        if (!jugadorEncontrado) {
            anunciarError(`❌ No se encontró ningún jugador baneado con: "${uidParametro}"`, jugadorAdmin);
            anunciarInfo(`💡 Verifica que el jugador esté efectivamente baneado`, jugadorAdmin);
            anunciarInfo(`💡 Usa: !banlist para ver todos los jugadores baneados`, jugadorAdmin);
            return false;
        }
        
    } catch (error) {
        console.error('❌ UNBAN: Error general en ejecutarDesbaneo:', error);
        anunciarError('❌ Error interno al intentar desbanear jugador', jugadorAdmin);
        return false;
    }
}

// Función para buscar jugador en una lista usando múltiples criterios
function buscarJugadorEnLista(lista, parametroBusqueda) {
    console.log(`🔍 UNBAN: Buscando "${parametroBusqueda}" en lista de ${lista.length} jugadores`);
    
    // 1. Búsqueda exacta por UID
    let encontrado = lista.find(j => j.uid && j.uid === parametroBusqueda);
    if (encontrado) {
        console.log(`✅ UNBAN: Encontrado por UID exacto: ${encontrado.nombre}`);
        return encontrado;
    }
    
    // 2. Búsqueda exacta por nombre (case insensitive)
    encontrado = lista.find(j => j.nombre && j.nombre.toLowerCase() === parametroBusqueda.toLowerCase());
    if (encontrado) {
        console.log(`✅ UNBAN: Encontrado por nombre exacto: ${encontrado.nombre}`);
        return encontrado;
    }
    
    // 3. Búsqueda parcial por nombre
    encontrado = lista.find(j => j.nombre && j.nombre.toLowerCase().includes(parametroBusqueda.toLowerCase()));
    if (encontrado) {
        console.log(`✅ UNBAN: Encontrado por nombre parcial: ${encontrado.nombre}`);
        return encontrado;
    }
    
    // 4. Búsqueda por UID decodificado (si parece ser hexadecimal)
    if (/^[0-9A-F]+$/i.test(parametroBusqueda) && parametroBusqueda.length % 2 === 0) {
        try {
            let decodificado = '';
            for (let i = 0; i < parametroBusqueda.length; i += 2) {
                const hex = parametroBusqueda.substr(i, 2);
                const char = String.fromCharCode(parseInt(hex, 16));
                decodificado += char;
            }
            
            encontrado = lista.find(j => j.uid && j.uid === decodificado);
            if (encontrado) {
                console.log(`✅ UNBAN: Encontrado por UID decodificado: ${encontrado.nombre} (${decodificado})`);
                return encontrado;
            }
        } catch (error) {
            console.log(`⚠️ UNBAN: Error decodificando hex, continuando...`);
        }
    }
    
    // 5. Búsqueda parcial en UID
    encontrado = lista.find(j => j.uid && (j.uid.includes(parametroBusqueda) || parametroBusqueda.includes(j.uid)));
    if (encontrado) {
        console.log(`✅ UNBAN: Encontrado por UID parcial: ${encontrado.nombre}`);
        return encontrado;
    }
    
    console.log(`❌ UNBAN: No se encontró jugador con "${parametroBusqueda}"`);
    return null;
}

// Función para desbanear usando tabla jugadores
async function desbanearEnTablaJugadores(jugadorEncontrado, jugadorAdmin, room, funciones) {
    const { nodeDesbanearJugador, anunciarExito, anunciarAdvertencia, anunciarError } = funciones;
    const { uid, nombre } = jugadorEncontrado;
    
    console.log(`🎯 UNBAN: Desbaneando desde tabla 'jugadores': ${nombre} (UID: ${uid})`);
    
    // PROTECCIÓN CRÍTICA: Verificar que no se intente desbanear al admin que ejecuta el comando
    if (jugadorAdmin.auth && jugadorAdmin.auth === uid) {
        console.log(`🛡️ UNBAN: PROTECCIÓN ACTIVADA - No se puede desbanear al admin ejecutor`);
        anunciarError(`❌ No puedes desbanearte a ti mismo`, jugadorAdmin);
        anunciarError(`💡 El UID que intentas desbanear (${uid}) es el tuyo propio`, jugadorAdmin);
        return false;
    }
    
    try {
        // 1. Desbanear en HaxBall
        room.clearBan(uid);
        console.log(`✅ UNBAN: room.clearBan(${uid}) ejecutado para ${nombre}`);
        
        // 2. Actualizar en base de datos
        if (typeof nodeDesbanearJugador === 'function') {
            try {
                const resultado = await nodeDesbanearJugador(uid);
                console.log(`✅ UNBAN: ${nombre} desbaneado en BD exitosamente`);
                anunciarExito(`✅ ${nombre} ha sido desbaneado por ${jugadorAdmin.name}`);
                return true;
            } catch (error) {
                console.error(`❌ UNBAN: Error actualizando BD para ${nombre}:`, error);
                anunciarAdvertencia(`⚠️ ${nombre} desbaneado en HaxBall, pero hubo error en la base de datos`);
                return true; // Aún consideramos exitoso el desbaneo en HaxBall
            }
        } else {
            console.log(`⚠️ UNBAN: Función nodeDesbanearJugador no disponible`);
            anunciarExito(`✅ ${nombre} desbaneado de HaxBall (BD no disponible)`);
            return true;
        }
        
    } catch (banError) {
        console.error(`❌ UNBAN: Error en room.clearBan para ${nombre} (${uid}):`, banError);
        throw new Error(`Error al ejecutar desbaneo en HaxBall: ${banError.message}`);
    }
}

// Función para desbanear usando tabla baneos
async function desbanearEnTablaBaneos(jugadorEncontrado, jugadorAdmin, room, funciones) {
    const { nodeDesbanearJugadorNuevo, anunciarExito, anunciarAdvertencia, anunciarError } = funciones;
    const { uid, nombre } = jugadorEncontrado; // uid aquí es realmente authId
    
    console.log(`🎯 UNBAN: Desbaneando desde tabla 'baneos': ${nombre} (AuthID: ${uid})`);
    
    // PROTECCIÓN CRÍTICA: Verificar que no se intente desbanear al admin que ejecuta el comando
    if (jugadorAdmin.auth && jugadorAdmin.auth === uid) {
        console.log(`🛡️ UNBAN: PROTECCIÓN ACTIVADA - No se puede desbanear al admin ejecutor`);
        anunciarError(`❌ No puedes desbanearte a ti mismo`, jugadorAdmin);
        anunciarError(`💡 El AuthID que intentas desbanear (${uid}) es el tuyo propio`, jugadorAdmin);
        return false;
    }
    
    try {
        // 1. Desbanear en HaxBall
        room.clearBan(uid);
        console.log(`✅ UNBAN: room.clearBan(${uid}) ejecutado para ${nombre}`);
        
        // 2. Actualizar en base de datos (tabla baneos)
        if (typeof nodeDesbanearJugadorNuevo === 'function') {
            try {
                const resultado = await nodeDesbanearJugadorNuevo(uid);
                console.log(`✅ UNBAN: ${nombre} desbaneado en tabla baneos exitosamente`);
                anunciarExito(`✅ ${nombre} ha sido desbaneado por ${jugadorAdmin.name}`);
                return true;
            } catch (error) {
                console.error(`❌ UNBAN: Error actualizando tabla baneos para ${nombre}:`, error);
                anunciarAdvertencia(`⚠️ ${nombre} desbaneado en HaxBall, pero hubo error en la base de datos`);
                return true; // Aún consideramos exitoso el desbaneo en HaxBall
            }
        } else {
            console.log(`⚠️ UNBAN: Función nodeDesbanearJugadorNuevo no disponible`);
            anunciarExito(`✅ ${nombre} desbaneado de HaxBall (BD no disponible)`);
            return true;
        }
        
    } catch (banError) {
        console.error(`❌ UNBAN: Error en room.clearBan para ${nombre} (${uid}):`, banError);
        throw new Error(`Error al ejecutar desbaneo en HaxBall: ${banError.message}`);
    }
}

// Exportar la función principal
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ejecutarDesbaneo };
} else {
    // Para uso en el navegador
    window.ejecutarDesbaneo = ejecutarDesbaneo;
}
