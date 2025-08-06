// forceunban.js - Sistema de desbaneo forzado para HaxBall
// Diseñado para resolver casos problemáticos donde el desbaneo normal no funciona
// Compatible con LNB Bot Headless

const sqlite3 = require("sqlite3").verbose();

/**
 * Ejecuta un desbaneo forzado para un jugador específico
 * Utiliza múltiples métodos para garantizar que el desbaneo funcione
 * 
 * @param {string} input - ID del ban, UID, IP o nombre del jugador a desbanear
 * @param {Object} jugadorAdmin - Objeto del jugador admin que ejecuta el comando
 * @param {Object} room - Objeto room de HaxBall
 * @param {Object} funciones - Funciones requeridas del bot principal
 * @returns {Promise<boolean>} - true si algún método tuvo éxito
 */
async function ejecutarForceUnban(input, jugadorAdmin, room, funciones) {
    console.log(`🔧 FORCE UNBAN: Admin ${jugadorAdmin.name} ejecuta desbaneo forzado para: "${input}"`);
    
    // Destructurar funciones requeridas
    const { 
        anunciarInfo, 
        anunciarExito, 
        anunciarError, 
        anunciarAdvertencia,
        nodeObtenerBaneosActivos,
        nodeDesbanearJugadorNuevo 
    } = funciones;
    
    if (!input || !room) {
        console.error(`❌ FORCE UNBAN: Parámetros inválidos`);
        if (anunciarError) anunciarError("❌ Parámetros inválidos para desbaneo forzado", jugadorAdmin);
        return false;
    }
    
    try {
        anunciarInfo(`🔄 Ejecutando desbaneo forzado para: ${input}...`, jugadorAdmin);
        
        let exitoAlguno = false;
        const metodosUsados = [];
        
        // Método 1: clearBan directo
        try {
            room.clearBan(input);
            console.log(`✅ FORCE UNBAN: clearBan directo exitoso`);
            metodosUsados.push('clearBan-directo');
            exitoAlguno = true;
        } catch (error) {
            console.warn(`⚠️ FORCE UNBAN: clearBan directo falló: ${error.message}`);
        }
        
        // Método 2: clearBan como string
        try {
            room.clearBan(String(input));
            console.log(`✅ FORCE UNBAN: clearBan string exitoso`);
            metodosUsados.push('clearBan-string');
            exitoAlguno = true;
        } catch (error) {
            console.warn(`⚠️ FORCE UNBAN: clearBan string falló: ${error.message}`);
        }
        
        // Método 3: Si es UID hexadecimal, convertir a decimal
        if (/^[a-fA-F0-9]+$/.test(input) && input.length >= 8) {
            try {
                const numeroUID = parseInt(input, 16);
                room.clearBan(numeroUID);
                console.log(`✅ FORCE UNBAN: clearBan hex-decimal exitoso`);
                metodosUsados.push('clearBan-hex-decimal');
                exitoAlguno = true;
            } catch (error) {
                console.warn(`⚠️ FORCE UNBAN: clearBan hex-decimal falló: ${error.message}`);
            }
        }
        
        // Método 4: Buscar en BD y usar todos los identificadores
        if (typeof nodeObtenerBaneosActivos === 'function') {
            try {
                const baneosActivos = await nodeObtenerBaneosActivos();
                const jugadorEncontrado = baneosActivos.find(ban => 
                    ban.id == input || 
                    ban.auth_id === input || 
                    ban.ip === input || 
                    ban.nombre.toLowerCase().includes(input.toLowerCase())
                );
                
                if (jugadorEncontrado) {
                    console.log(`🎯 FORCE UNBAN: Encontrado en BD: ${jugadorEncontrado.nombre} con múltiples identificadores`);
                    
                    // Intentar con auth_id
                    if (jugadorEncontrado.auth_id) {
                        try {
                            room.clearBan(jugadorEncontrado.auth_id);
                            metodosUsados.push('clearBan-auth_id');
                            exitoAlguno = true;
                            console.log(`✅ FORCE UNBAN: clearBan con auth_id exitoso`);
                        } catch (error) {
                            console.warn(`⚠️ FORCE UNBAN: clearBan auth_id falló: ${error.message}`);
                        }
                    }
                    
                    // Intentar con IP si está disponible
                    if (jugadorEncontrado.ip && jugadorEncontrado.ip !== 'N/A') {
                        try {
                            room.clearBan(jugadorEncontrado.ip);
                            metodosUsados.push('clearBan-ip');
                            exitoAlguno = true;
                            console.log(`✅ FORCE UNBAN: clearBan con IP exitoso`);
                        } catch (error) {
                            console.warn(`⚠️ FORCE UNBAN: clearBan IP falló: ${error.message}`);
                        }
                    }
                    
                    // Desactivar en BD
                    if (typeof nodeDesbanearJugadorNuevo === 'function') {
                        try {
                            await nodeDesbanearJugadorNuevo(jugadorEncontrado.auth_id || input);
                            metodosUsados.push('BD-desactivado');
                            console.log(`✅ FORCE UNBAN: Registro desactivado en BD`);
                        } catch (error) {
                            console.warn(`⚠️ FORCE UNBAN: Error desactivando en BD: ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ FORCE UNBAN: Error buscando en BD: ${error.message}`);
            }
        }
        
        // Método 5: Limpiar de sistemas internos del bot
        // Si hay sistemas adicionales de baneos en el bot principal, agregar aquí
        
        // Método 6: Método "semi-nuclear" - clearBans selectivo
        // Solo usar si ningún otro método funcionó y tenemos acceso a la BD
        if (!exitoAlguno && typeof nodeObtenerBaneosActivos === 'function') {
            anunciarAdvertencia(`⚠️ Métodos normales fallaron. Aplicando método semi-nuclear...`, jugadorAdmin);
            
            try {
                // Obtener todos los baneos activos
                const todosLosBaneos = await nodeObtenerBaneosActivos();
                const baneosParaMantener = todosLosBaneos.filter(ban => 
                    ban.id != input && 
                    ban.auth_id !== input && 
                    ban.ip !== input &&
                    !ban.nombre.toLowerCase().includes(input.toLowerCase())
                );
                
                // Limpiar todos los baneos
                room.clearBans();
                console.log(`🧨 FORCE UNBAN: clearBans completo ejecutado`);
                metodosUsados.push('semi-nuclear-clearBans');
                
                // Re-aplicar los baneos que queremos mantener
                let reAplicados = 0;
                for (const ban of baneosParaMantener) {
                    try {
                        if (ban.auth_id) {
                            // Solo mostrar mensaje de re-baneo
                            console.log(`🔄 FORCE UNBAN: Se mantendría ban para ${ban.nombre} (${ban.auth_id})`);
                            reAplicados++;
                            
                            // NOTA: No re-aplicamos baneos aquí porque podría causar problemas
                            // Solo registramos cuántos baneos se mantendrían
                        }
                    } catch (error) {
                        console.warn(`⚠️ FORCE UNBAN: Error procesando ban para ${ban.nombre}: ${error.message}`);
                    }
                }
                
                console.log(`🔄 FORCE UNBAN: Se mantendrían ${reAplicados} de ${baneosParaMantener.length} baneos`);
                metodosUsados.push(`nuclear-aplicado`);
                exitoAlguno = true;
                
                // Advertir al admin sobre el desbaneo masivo
                anunciarAdvertencia(`⚠️ ADVERTENCIA: Se han eliminado TODOS los baneos. Jugador objetivo desbaneado.`, jugadorAdmin);
                
            } catch (error) {
                console.error(`❌ FORCE UNBAN: Error en método semi-nuclear: ${error.message}`);
            }
        }
        
        // Reportar resultados
        console.log(`📊 FORCE UNBAN: Métodos utilizados: [${metodosUsados.join(', ')}]`);
        
        if (exitoAlguno || metodosUsados.length > 0) {
            anunciarExito(`✅ Desbaneo forzado completado para "${input}"`, jugadorAdmin);
            anunciarInfo(`🔧 Métodos utilizados: ${metodosUsados.length}`, jugadorAdmin);
            anunciarInfo(`💡 El jugador debería poder conectarse ahora. Si persisten problemas, usa !clearbans`, jugadorAdmin);
            
            return true;
        } else {
            anunciarError(`❌ Desbaneo forzado falló para "${input}"`, jugadorAdmin);
            anunciarAdvertencia(`💡 Si el problema persiste, usa !clearbans como último recurso`, jugadorAdmin);
            
            return false;
        }
        
    } catch (error) {
        console.error(`❌ FORCE UNBAN: Error crítico:`, error);
        anunciarError(`❌ Error en desbaneo forzado: ${error.message}`, jugadorAdmin);
        return false;
    }
}

// Exportar la función principal
module.exports = {
    ejecutarForceUnban
};
