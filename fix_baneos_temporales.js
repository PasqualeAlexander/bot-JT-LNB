/**
 * SISTEMA DE REPARACIÓN PARA BANEOS TEMPORALES
 * Este archivo implementa la solución para el problema de baneos temporales
 * que no se remueven automáticamente de HaxBall cuando expiran.
 */

// Mapa para almacenar los timeouts activos de baneos temporales
let baneosTemporalesActivos = new Map(); // {uid: {timeout: timeoutId, expiracion: Date, nombre: string}}

/**
 * Programa el desbaneo automático para un baneo temporal
 */
function programarDesbaneoAutomatico(uid, nombre, tiempoMinutos, room) {
    if (!tiempoMinutos || tiempoMinutos <= 0) {
        console.log(`❌ No se programa desbaneo automático: tiempo inválido (${tiempoMinutos})`);
        return;
    }

    const tiempoMs = tiempoMinutos * 60 * 1000; // Convertir minutos a milisegundos
    const fechaExpiracion = new Date(Date.now() + tiempoMs);
    
    console.log(`⏰ Programando desbaneo automático para ${nombre} (${uid}) en ${tiempoMinutos} minutos (${fechaExpiracion.toLocaleString()})`);
    
    // Cancelar cualquier timeout previo para este UID
    const timeoutPrevio = baneosTemporalesActivos.get(uid);
    if (timeoutPrevio) {
        clearTimeout(timeoutPrevio.timeout);
        console.log(`🔄 Cancelado timeout previo para ${uid}`);
    }
    
    // Crear el nuevo timeout
    const timeoutId = setTimeout(() => {
        ejecutarDesbaneoAutomatico(uid, nombre, room);
    }, tiempoMs);
    
    // Guardar en el mapa
    baneosTemporalesActivos.set(uid, {
        timeout: timeoutId,
        expiracion: fechaExpiracion,
        nombre: nombre
    });
    
    console.log(`✅ Desbaneo programado correctamente para ${nombre} (${uid})`);
}

/**
 * Ejecuta el desbaneo automático cuando expira el tiempo
 */
function ejecutarDesbaneoAutomatico(uid, nombre, room) {
    console.log(`🔓 Ejecutando desbaneo automático para ${nombre} (${uid})`);
    
    try {
        // Ejecutar clearBan en HaxBall
        room.clearBan(uid);
        console.log(`✅ room.clearBan(${uid}) ejecutado exitosamente para ${nombre}`);
        
        // Remover del mapa de baneos activos
        baneosTemporalesActivos.delete(uid);
        
        // Actualizar en la base de datos si las funciones están disponibles
        if (typeof nodeDesactivarBaneoTemporal === 'function') {
            try {
                nodeDesactivarBaneoTemporal(uid)
                    .then(() => {
                        console.log(`✅ Baneo temporal desactivado en BD para ${nombre}`);
                    })
                    .catch(error => {
                        console.error(`❌ Error actualizando BD para ${nombre}:`, error);
                    });
            } catch (error) {
                console.error(`❌ Error llamando nodeDesactivarBaneoTemporal:`, error);
            }
        }
        
        // Anunciar en la sala si hay jugadores conectados
        if (room && room.getPlayerList && typeof anunciarInfo === 'function') {
            const jugadores = room.getPlayerList();
            if (jugadores.length > 1) { // Solo si hay jugadores además del bot
                anunciarInfo(`⏰ El baneo temporal de ${nombre} ha expirado automáticamente`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error en desbaneo automático para ${nombre} (${uid}):`, error);
        
        // Re-intentar una vez más después de 30 segundos
        setTimeout(() => {
            try {
                console.log(`🔄 Reintentando desbaneo automático para ${nombre} (${uid})`);
                room.clearBan(uid);
                console.log(`✅ Segundo intento exitoso para ${nombre}`);
                baneosTemporalesActivos.delete(uid);
            } catch (error2) {
                console.error(`❌ Segundo intento también falló para ${nombre}:`, error2);
                baneosTemporalesActivos.delete(uid);
            }
        }, 30000);
    }
}

/**
 * Verifica y limpia baneos temporales expirados al iniciar
 */
async function limpiarBaneosExpirados(room) {
    console.log(`🧹 Verificando baneos temporales expirados...`);
    
    try {
        // Obtener baneos activos de la base de datos
        if (typeof nodeObtenerBaneosActivos === 'function') {
            const baneosActivos = await nodeObtenerBaneosActivos();
            let baneosLimpiados = 0;
            
            for (const baneo of baneosActivos) {
                if (baneo.duracion && baneo.duracion > 0) {
                    const fechaBan = new Date(baneo.fecha);
                    const tiempoTranscurrido = Date.now() - fechaBan.getTime();
                    const tiempoLimite = baneo.duracion * 60 * 1000;
                    
                    if (tiempoTranscurrido >= tiempoLimite) {
                        // El baneo ha expirado
                        console.log(`🕐 Baneo expirado encontrado: ${baneo.nombre} (${baneo.authId})`);
                        
                        try {
                            room.clearBan(baneo.authId);
                            console.log(`✅ Baneo expirado removido de HaxBall: ${baneo.nombre}`);
                            baneosLimpiados++;
                            
                            // Desactivar en la base de datos
                            if (typeof nodeDesactivarBaneoTemporal === 'function') {
                                await nodeDesactivarBaneoTemporal(baneo.authId);
                                console.log(`✅ Baneo expirado desactivado en BD: ${baneo.nombre}`);
                            }
                            
                        } catch (error) {
                            console.error(`❌ Error limpiando baneo expirado para ${baneo.nombre}:`, error);
                        }
                    } else {
                        // El baneo aún está activo, programar su desbaneo automático
                        const tiempoRestante = Math.max(0, tiempoLimite - tiempoTranscurrido);
                        if (tiempoRestante > 0) {
                            const minutosRestantes = Math.ceil(tiempoRestante / (60 * 1000));
                            console.log(`⏰ Reprogramando desbaneo para ${baneo.nombre} en ${minutosRestantes} minutos`);
                            
                            // Programar usando el tiempo restante
                            const timeoutId = setTimeout(() => {
                                ejecutarDesbaneoAutomatico(baneo.authId, baneo.nombre, room);
                            }, tiempoRestante);
                            
                            baneosTemporalesActivos.set(baneo.authId, {
                                timeout: timeoutId,
                                expiracion: new Date(fechaBan.getTime() + tiempoLimite),
                                nombre: baneo.nombre
                            });
                        }
                    }
                }
            }
            
            if (baneosLimpiados > 0) {
                console.log(`✅ Limpiados ${baneosLimpiados} baneos expirados`);
            } else {
                console.log(`ℹ️ No se encontraron baneos expirados para limpiar`);
            }
        }
    } catch (error) {
        console.error(`❌ Error en limpiezaBaneosExpirados:`, error);
    }
}

/**
 * Obtiene información sobre baneos temporales activos
 */
function obtenerBaneosTemporalesActivos() {
    const baneos = [];
    for (const [uid, info] of baneosTemporalesActivos.entries()) {
        const tiempoRestante = Math.max(0, info.expiracion.getTime() - Date.now());
        const minutosRestantes = Math.ceil(tiempoRestante / (60 * 1000));
        
        baneos.push({
            uid: uid,
            nombre: info.nombre,
            expiracion: info.expiracion,
            minutosRestantes: minutosRestantes
        });
    }
    return baneos;
}

/**
 * Cancela un baneo temporal programado
 */
function cancelarBaneoTemporal(uid) {
    const baneo = baneosTemporalesActivos.get(uid);
    if (baneo) {
        clearTimeout(baneo.timeout);
        baneosTemporalesActivos.delete(uid);
        console.log(`✅ Baneo temporal cancelado para UID: ${uid}`);
        return true;
    }
    return false;
}

// Función para integrar con el comando ban existente
function integrarConComandoBan(jugadorObjetivo, uid, tiempo, room) {
    if (tiempo && tiempo > 0) {
        programarDesbaneoAutomatico(uid, jugadorObjetivo.name, tiempo, room);
    }
}

// Exportar funciones
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        programarDesbaneoAutomatico,
        ejecutarDesbaneoAutomatico,
        limpiarBaneosExpirados,
        obtenerBaneosTemporalesActivos,
        cancelarBaneoTemporal,
        integrarConComandoBan
    };
} else {
    // Para uso en el navegador
    window.programarDesbaneoAutomatico = programarDesbaneoAutomatico;
    window.ejecutarDesbaneoAutomatico = ejecutarDesbaneoAutomatico;
    window.limpiarBaneosExpirados = limpiarBaneosExpirados;
    window.obtenerBaneosTemporalesActivos = obtenerBaneosTemporalesActivos;
    window.cancelarBaneoTemporal = cancelarBaneoTemporal;
    window.integrarConComandoBan = integrarConComandoBan;
}
