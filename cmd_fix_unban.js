// cmd_fix_unban.js - Comando para resolver desincronizaciones de unban

// Este código debe ser integrado al message.js como un nuevo comando !fixunban

const COMANDO_FIX_UNBAN = `
        case "fixunban":
        case "forceunban":
            if (!esAdminBasico(jugador)) return;
            if (args[1]) {
                const input = args[1].trim();
                
                if (!input) {
                    anunciarError("❌ Uso correcto: !fixunban <auth_id>", jugador);
                    return false;
                }

                console.log(\`🔧 FIXUNBAN: Admin \${jugador.name} forzando desbaneo para: "\${input}"\`);
                anunciarAdvertencia(\`🔧 Forzando resolución de desincronización para: \${input}\`, jugador);

                try {
                    // Primero verificar si está baneado en BD
                    let baneoActivoEnBD = false;
                    
                    if (typeof nodeObtenerBaneosActivos === 'function') {
                        try {
                            const baneosActivos = await nodeObtenerBaneosActivos();
                            const baneoActivo = baneosActivos.find(b => b.authId === input);
                            
                            if (baneoActivo) {
                                baneoActivoEnBD = true;
                                console.log(\`📋 FIXUNBAN: Baneo activo encontrado en BD: \${baneoActivo.nombre}\`);
                                anunciarInfo(\`📋 Baneo activo encontrado en BD: \${baneoActivo.nombre}\`, jugador);
                            } else {
                                console.log(\`📋 FIXUNBAN: No hay baneos activos en BD para \${input}\`);
                                anunciarInfo(\`📋 No hay baneos activos en BD - Desincronización confirmada\`, jugador);
                            }
                        } catch (bdError) {
                            console.error(\`❌ FIXUNBAN: Error verificando baneos activos:\`, bdError);
                            anunciarError(\`❌ Error verificando BD: \${bdError.message}\`, jugador);
                        }
                    }
                    
                    // Forzar limpieza en BD si hay baneos
                    if (baneoActivoEnBD) {
                        anunciarInfo(\`🔄 Limpiando baneo en BD...\`, jugador);
                        try {
                            if (typeof nodeDesbanearJugadorNuevo === 'function') {
                                await nodeDesbanearJugadorNuevo(input);
                                console.log(\`✅ FIXUNBAN: Jugador desbaneado en BD\`);
                                anunciarExito(\`✅ Jugador desbaneado en BD\`);
                            }
                        } catch (bdError) {
                            console.error(\`❌ FIXUNBAN: Error desbaneando en BD:\`, bdError);
                            anunciarError(\`❌ Error desbaneando en BD: \${bdError.message}\`, jugador);
                        }
                    }
                    
                    // Forzar múltiples métodos de limpieza en HaxBall
                    anunciarInfo(\`🔄 Forzando limpieza en HaxBall con múltiples métodos...\`, jugador);
                    
                    let exitoso = false;
                    let metodosExitosos = [];
                    let metodosFallidos = [];
                    
                    // Método 1: clearBan directo
                    try {
                        room.clearBan(input);
                        console.log(\`✅ FIXUNBAN: clearBan directo exitoso para \${input}\`);
                        metodosExitosos.push('directo');
                        exitoso = true;
                    } catch (error) {
                        console.warn(\`⚠️ FIXUNBAN: clearBan directo falló para \${input}:\`, error.message);
                        metodosFallidos.push('directo');
                    }
                    
                    // Método 2: clearBan como string
                    try {
                        room.clearBan(String(input));
                        console.log(\`✅ FIXUNBAN: clearBan string exitoso para \${input}\`);
                        metodosExitosos.push('string');
                        exitoso = true;
                    } catch (error) {
                        console.warn(\`⚠️ FIXUNBAN: clearBan string falló para \${input}:\`, error.message);
                        metodosFallidos.push('string');
                    }
                    
                    // Método 3: Variantes de mayúsculas/minúsculas
                    const variantes = [input.toUpperCase(), input.toLowerCase()];
                    
                    for (const variante of variantes) {
                        if (variante === input) continue; // Skip si es igual al original
                        
                        try {
                            room.clearBan(variante);
                            console.log(\`✅ FIXUNBAN: clearBan \${variante === input.toUpperCase() ? 'mayúsculas' : 'minúsculas'} exitoso\`);
                            metodosExitosos.push(variante === input.toUpperCase() ? 'upper' : 'lower');
                            exitoso = true;
                        } catch (error) {
                            console.warn(\`⚠️ FIXUNBAN: clearBan \${variante === input.toUpperCase() ? 'mayúsculas' : 'minúsculas'} falló:\`, error.message);
                            metodosFallidos.push(variante === input.toUpperCase() ? 'upper' : 'lower');
                        }
                    }
                    
                    // Método 4: clearBans general (solo si hay muy pocos jugadores)
                    const jugadoresConectados = room.getPlayerList().length;
                    if (jugadoresConectados <= 2) {
                        try {
                            room.clearBans();
                            console.log(\`✅ FIXUNBAN: clearBans general ejecutado (pocos jugadores: \${jugadoresConectados})\`);
                            metodosExitosos.push('clearAll');
                            exitoso = true;
                        } catch (error) {
                            console.warn(\`⚠️ FIXUNBAN: clearBans general falló:\`, error.message);
                            metodosFallidos.push('clearAll');
                        }
                    } else {
                        console.log(\`⚠️ FIXUNBAN: clearBans omitido - demasiados jugadores (\${jugadoresConectados})\`);
                        metodosFallidos.push('clearAll-OMITIDO');
                    }
                    
                    // Mostrar resultados
                    console.log(\`📊 FIXUNBAN: Métodos exitosos: [\${metodosExitosos.join(', ')}]\`);
                    console.log(\`📊 FIXUNBAN: Métodos fallidos: [\${metodosFallidos.join(', ')}]\`);
                    
                    if (exitoso) {
                        anunciarExito(\`✅ Desincronización resuelta para \${input}\`);
                        anunciarInfo(\`🔧 Métodos exitosos: \${metodosExitosos.join(', ')}\`, jugador);
                        anunciarInfo(\`💡 El jugador debería poder conectar ahora\`, jugador);
                        console.log(\`✅ FIXUNBAN: Exitoso para \${input}\`);
                        
                        // Notificar éxito por webhook si está disponible
                        if (typeof enviarNotificacionBanKick === 'function') {
                            enviarNotificacionBanKick(
                                "fixunban", 
                                jugador.name, 
                                input, 
                                input, 
                                0, 
                                \`Desincronización resuelta - Métodos: \${metodosExitosos.join(', ')}\`, 
                                null, 
                                null
                            );
                        }
                    } else {
                        anunciarError(\`❌ No se pudo resolver la desincronización para \${input}\`, jugador);
                        anunciarInfo(\`🔧 Métodos intentados: \${metodosFallidos.join(', ')}\`, jugador);
                        anunciarAdvertencia(\`⚠️ Puede requerir intervención manual o reinicio del bot\`, jugador);
                        console.log(\`❌ FIXUNBAN: Falló para \${input}\`);
                    }
                    
                    // Verificar después del fix
                    anunciarInfo(\`🔍 Verificación post-fix recomendada:\`, jugador);
                    anunciarInfo(\`💡 1. El jugador debe intentar conectar ahora\`, jugador);
                    anunciarInfo(\`💡 2. Si persiste el problema, usar !debug_unban \${input}\`, jugador);
                    anunciarInfo(\`💡 3. Como último recurso, reiniciar el bot\`, jugador);
                    
                } catch (error) {
                    console.error(\`❌ FIXUNBAN: Error crítico:\`, error);
                    anunciarError(\`❌ Error crítico en fixunban: \${error.message}\`, jugador);
                }

                return false; // Evita que el mensaje se vea públicamente
            } else {
                anunciarError('❌ Debes especificar un Auth ID para forzar desbaneo', jugador);
                anunciarInfo('💡 Uso: !fixunban <auth_id>', jugador);
                anunciarInfo('💡 Este comando resuelve desincronizaciones entre BD y HaxBall', jugador);
            }
            break;
`;

module.exports = COMANDO_FIX_UNBAN;
