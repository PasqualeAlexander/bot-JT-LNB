// fix_unban_desync.js - Arreglar desincronización entre HaxBall y BD

// Este script debe ser integrado al message.js para casos de desincronización

const FIXES_UNBAN = {
    
    // Función para forzar limpieza de ban desincronizado
    forzarLimpiezaBanDesincronizado: function(room, authId, adminName) {
        console.log(`🔧 FORZANDO LIMPIEZA DE BAN DESINCRONIZADO: ${authId}`);
        
        let exitoso = false;
        let metodosIntentados = [];
        
        // Método 1: clearBan directo
        try {
            room.clearBan(authId);
            console.log(`✅ clearBan directo exitoso para ${authId}`);
            metodosIntentados.push('directo-OK');
            exitoso = true;
        } catch (error) {
            console.warn(`⚠️ clearBan directo falló para ${authId}:`, error.message);
            metodosIntentados.push('directo-FALLO');
        }
        
        // Método 2: clearBan como string
        if (!exitoso) {
            try {
                room.clearBan(String(authId));
                console.log(`✅ clearBan string exitoso para ${authId}`);
                metodosIntentados.push('string-OK');
                exitoso = true;
            } catch (error) {
                console.warn(`⚠️ clearBan string falló para ${authId}:`, error.message);
                metodosIntentados.push('string-FALLO');
            }
        }
        
        // Método 3: clearBan en mayúsculas y minúsculas
        if (!exitoso) {
            const variantes = [authId.toUpperCase(), authId.toLowerCase()];
            
            for (const variante of variantes) {
                try {
                    room.clearBan(variante);
                    console.log(`✅ clearBan ${variante === authId.toUpperCase() ? 'mayúsculas' : 'minúsculas'} exitoso para ${authId}`);
                    metodosIntentados.push(`${variante === authId.toUpperCase() ? 'upper' : 'lower'}-OK`);
                    exitoso = true;
                    break;
                } catch (error) {
                    console.warn(`⚠️ clearBan ${variante === authId.toUpperCase() ? 'mayúsculas' : 'minúsculas'} falló:`, error.message);
                    metodosIntentados.push(`${variante === authId.toUpperCase() ? 'upper' : 'lower'}-FALLO`);
                }
            }
        }
        
        // Método 4: clearBans general (solo si hay pocos jugadores)
        if (!exitoso && room.getPlayerList().length <= 2) {
            try {
                room.clearBans();
                console.log(`✅ clearBans general ejecutado (pocos jugadores conectados)`);
                metodosIntentados.push('clearAll-OK');
                exitoso = true;
            } catch (error) {
                console.warn(`⚠️ clearBans general falló:`, error.message);
                metodosIntentados.push('clearAll-FALLO');
            }
        }
        
        console.log(`📊 Métodos intentados para ${authId}: [${metodosIntentados.join(', ')}]`);
        
        return {
            exitoso: exitoso,
            metodos: metodosIntentados,
            solucion: exitoso ? 'Desincronización resuelta' : 'Requiere intervención manual'
        };
    },
    
    // Comando mejorado para casos de desincronización
    comandoUnbanMejorado: async function(room, input, adminPlayer, funcionesDB) {
        console.log(`🔧 UNBAN MEJORADO: Procesando ${input} por admin ${adminPlayer.name}`);
        
        // 1. Verificar estado en BD primero
        let baneoEnBD = false;
        let jugadorInfo = null;
        
        try {
            if (typeof funcionesDB.nodeObtenerBaneosActivos === 'function') {
                const baneosActivos = await funcionesDB.nodeObtenerBaneosActivos();
                const baneoActivo = baneosActivos.find(b => b.authId === input);
                
                if (baneoActivo) {
                    baneoEnBD = true;
                    jugadorInfo = baneoActivo;
                    console.log(`📋 Baneo ACTIVO encontrado en BD: ${baneoActivo.nombre}`);
                } else {
                    console.log(`📋 No hay baneos ACTIVOS en BD para ${input}`);
                }
            }
        } catch (error) {
            console.error(`❌ Error verificando baneos activos:`, error);
        }
        
        // 2. Si no hay baneo activo en BD, es desincronización
        if (!baneoEnBD) {
            room.sendAnnouncement(
                `🔄 Detectada posible desincronización: ${input} no está baneado en BD`,
                adminPlayer.id,
                parseInt("FFA500", 16),
                "normal",
                0
            );
            
            room.sendAnnouncement(
                `🔧 Forzando limpieza de ban en HaxBall...`,
                adminPlayer.id,
                parseInt("87CEEB", 16),
                "normal",
                0
            );
            
            const resultado = this.forzarLimpiezaBanDesincronizado(room, input, adminPlayer.name);
            
            if (resultado.exitoso) {
                room.sendAnnouncement(
                    `✅ Desincronización resuelta para ${input}`,
                    adminPlayer.id,
                    parseInt("00FF00", 16),
                    "bold",
                    0
                );
                
                room.sendAnnouncement(
                    `💡 El jugador debería poder conectar ahora`,
                    adminPlayer.id,
                    parseInt("87CEEB", 16),
                    "normal",
                    0
                );
                
                console.log(`✅ UNBAN DESINCRONIZACIÓN: Exitoso para ${input}`)
                return { success: true, message: 'Desincronización resuelta' };
            } else {
                room.sendAnnouncement(
                    `❌ No se pudo resolver la desincronización para ${input}`,
                    adminPlayer.id,
                    parseInt("FF0000", 16),
                    "normal",
                    0
                );
                
                room.sendAnnouncement(
                    `🔧 Métodos intentados: ${resultado.metodos.join(', ')}`,
                    adminPlayer.id,
                    parseInt("FFA500", 16),
                    "normal",
                    0
                );
                
                console.log(`❌ UNBAN DESINCRONIZACIÓN: Falló para ${input}`)
                return { success: false, message: 'No se pudo resolver desincronización' };
            }
        }
        
        // 3. Si hay baneo activo en BD, usar proceso normal
        else {
            console.log(`🔧 Baneo activo en BD, procesando desbaneo normal...`);
            
            try {
                // Desbanear en BD
                if (typeof funcionesDB.nodeDesbanearJugadorNuevo === 'function') {
                    await funcionesDB.nodeDesbanearJugadorNuevo(input);
                    console.log(`✅ Jugador desbaneado en BD: ${jugadorInfo.nombre}`);
                }
                
                // Limpiar en HaxBall
                const resultado = this.forzarLimpiezaBanDesincronizado(room, input, adminPlayer.name);
                
                if (resultado.exitoso) {
                    room.sendAnnouncement(
                        `✅ ${jugadorInfo.nombre} desbaneado correctamente`,
                        adminPlayer.id,
                        parseInt("00FF00", 16),
                        "bold",
                        0
                    );
                    
                    console.log(`✅ UNBAN NORMAL: Exitoso para ${jugadorInfo.nombre}`)
                    return { success: true, message: `${jugadorInfo.nombre} desbaneado` };
                } else {
                    room.sendAnnouncement(
                        `⚠️ ${jugadorInfo.nombre} desbaneado en BD pero puede haber problemas en HaxBall`,
                        adminPlayer.id,
                        parseInt("FFA500", 16),
                        "normal",
                        0
                    );
                    
                    console.log(`⚠️ UNBAN PARCIAL: BD OK, HaxBall con problemas para ${jugadorInfo.nombre}`)
                    return { success: false, message: 'Desbaneado en BD, problemas en HaxBall' };
                }
                
            } catch (error) {
                console.error(`❌ Error en desbaneo normal:`, error);
                room.sendAnnouncement(
                    `❌ Error desbaneando ${input}: ${error.message}`,
                    adminPlayer.id,
                    parseInt("FF0000", 16),
                    "normal",
                    0
                );
                
                return { success: false, message: error.message };
            }
        }
    }
};

module.exports = FIXES_UNBAN;
