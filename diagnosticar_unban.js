// diagnosticar_unban.js - Diagnosticar problema de unban
const sqlite3 = require("sqlite3").verbose();

const AUTH_ID = "dQrCF4tFKgw62vs_SYc3-F_HWhqB14OkfxjVuHxObFI";

function diagnosticarUnban() {
    console.log("🔍 DIAGNÓSTICO DEL PROBLEMA DE UNBAN");
    console.log("=" .repeat(50));
    console.log(`🎯 Auth ID a diagnosticar: ${AUTH_ID}`);
    console.log("");
    
    const db = new sqlite3.Database("./lnb_estadisticas.db");
    
    // 1. Verificar en tabla baneos (sistema nuevo)
    console.log("📋 1. VERIFICANDO TABLA 'baneos' (Sistema nuevo):");
    const queryBaneos = `SELECT id, auth_id, nombre, razon, admin, fecha, duracion, activo 
                         FROM baneos 
                         WHERE auth_id = ?
                         ORDER BY fecha DESC`;
    
    db.all(queryBaneos, [AUTH_ID], (err, rows) => {
        if (err) {
            console.error("❌ Error consultando tabla baneos:", err);
        } else {
            if (rows.length === 0) {
                console.log("⚠️  NO se encontró el Auth ID en tabla 'baneos'");
            } else {
                console.log(`✅ Se encontraron ${rows.length} registros en tabla 'baneos':`);
                rows.forEach((row, index) => {
                    const fechaBan = new Date(row.fecha);
                    const tiempoTranscurrido = Math.floor((new Date() - fechaBan) / (1000 * 60)); // minutos
                    
                    console.log(`   [${index + 1}] ID: ${row.id}`);
                    console.log(`       📝 Nombre: ${row.nombre}`);
                    console.log(`       📅 Fecha: ${row.fecha} (hace ${tiempoTranscurrido} min)`);
                    console.log(`       👮 Admin: ${row.admin}`);
                    console.log(`       📋 Razón: ${row.razon}`);
                    console.log(`       ⏱️  Duración: ${row.duracion} min (${row.duracion === 0 ? 'PERMANENTE' : 'TEMPORAL'})`);
                    console.log(`       🔥 Estado: ${row.activo === 1 ? 'ACTIVO ❌' : 'INACTIVO ✅'}`);
                    
                    // Verificar si es temporal y ha expirado
                    if (row.duracion > 0) {
                        const tiempoLimite = row.duracion;
                        if (tiempoTranscurrido >= tiempoLimite) {
                            console.log(`       ⚠️  TEMPORAL EXPIRADO (${tiempoTranscurrido} >= ${tiempoLimite} min)`);
                        } else {
                            const minutosRestantes = tiempoLimite - tiempoTranscurrido;
                            console.log(`       ⏳ Tiempo restante: ${minutosRestantes} minutos`);
                        }
                    }
                    console.log("");
                });
            }
        }
        
        // 2. Verificar en tabla jugadores (sistema viejo)
        console.log("📋 2. VERIFICANDO TABLA 'jugadores' (Sistema viejo):");
        const queryJugadores = `SELECT uid, nombre, baneado, fecha_ban, razon_ban, admin_ban 
                                FROM jugadores 
                                WHERE uid = ? OR uid LIKE ?
                                ORDER BY fecha_ban DESC`;
        
        db.all(queryJugadores, [AUTH_ID, `%${AUTH_ID}%`], (err2, rows2) => {
            if (err2) {
                console.error("❌ Error consultando tabla jugadores:", err2);
            } else {
                if (rows2.length === 0) {
                    console.log("⚠️  NO se encontró el Auth ID en tabla 'jugadores'");
                } else {
                    console.log(`✅ Se encontraron ${rows2.length} registros en tabla 'jugadores':`);
                    rows2.forEach((row, index) => {
                        console.log(`   [${index + 1}] UID: ${row.uid}`);
                        console.log(`       📝 Nombre: ${row.nombre}`);
                        console.log(`       🔥 Baneado: ${row.baneado === 1 ? 'SÍ ❌' : 'NO ✅'}`);
                        console.log(`       📅 Fecha ban: ${row.fecha_ban || 'N/A'}`);
                        console.log(`       👮 Admin ban: ${row.admin_ban || 'N/A'}`);
                        console.log(`       📋 Razón ban: ${row.razon_ban || 'N/A'}`);
                        console.log("");
                    });
                }
            }
            
            // 3. Verificar estadísticas generales
            console.log("📊 3. ESTADÍSTICAS GENERALES:");
            const statsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM baneos WHERE activo = 1) as baneos_activos,
                    (SELECT COUNT(*) FROM baneos WHERE activo = 0) as baneos_inactivos,
                    (SELECT COUNT(*) FROM jugadores WHERE baneado = 1) as jugadores_baneados,
                    (SELECT COUNT(*) FROM jugadores WHERE baneado = 0) as jugadores_no_baneados
            `;
            
            db.get(statsQuery, [], (err3, stats) => {
                if (err3) {
                    console.error("❌ Error obteniendo estadísticas:", err3);
                } else {
                    console.log(`   📈 Baneos activos (tabla baneos): ${stats.baneos_activos}`);
                    console.log(`   📉 Baneos inactivos (tabla baneos): ${stats.baneos_inactivos}`);
                    console.log(`   👥 Jugadores baneados (tabla jugadores): ${stats.jugadores_baneados}`);
                    console.log(`   👤 Jugadores no baneados (tabla jugadores): ${stats.jugadores_no_baneados}`);
                }
                
                console.log("");
                console.log("🔧 4. ANÁLISIS Y RECOMENDACIONES:");
                
                // Realizar análisis basado en los datos
                if (rows.length === 0 && rows2.length === 0) {
                    console.log("❌ PROBLEMA: El Auth ID no existe en ninguna tabla.");
                    console.log("💡 SOLUCIÓN: Verificar que el Auth ID sea correcto.");
                } else {
                    let hayBaneoActivo = false;
                    
                    // Verificar baneos activos en tabla baneos
                    const baneosActivos = rows.filter(r => r.activo === 1);
                    if (baneosActivos.length > 0) {
                        console.log("❌ PROBLEMA: Hay baneos ACTIVOS en tabla 'baneos'");
                        hayBaneoActivo = true;
                    }
                    
                    // Verificar baneos activos en tabla jugadores
                    const jugadoresBaneados = rows2.filter(r => r.baneado === 1);
                    if (jugadoresBaneados.length > 0) {
                        console.log("❌ PROBLEMA: Hay baneos ACTIVOS en tabla 'jugadores'");
                        hayBaneoActivo = true;
                    }
                    
                    if (!hayBaneoActivo) {
                        console.log("✅ ESTADO: No hay baneos activos en las bases de datos");
                        console.log("💡 POSIBLE PROBLEMA: Desincronización entre HaxBall y BD");
                        console.log("🔧 SOLUCIÓN SUGERIDA: Usar room.clearBan() directamente en HaxBall");
                    } else {
                        console.log("💡 SOLUCIONES SUGERIDAS:");
                        console.log("   1. Ejecutar manualmente en BD: UPDATE baneos SET activo = 0 WHERE auth_id = ?");
                        console.log("   2. Ejecutar manualmente en BD: UPDATE jugadores SET baneado = 0 WHERE uid = ?");
                        console.log("   3. Usar room.clearBan() en HaxBall");
                        console.log("   4. Verificar que el comando unban esté usando las funciones correctas");
                    }
                }
                
                console.log("");
                console.log("🔍 5. COMANDO DE PRUEBA RECOMENDADO:");
                console.log(`!debug_unban ${AUTH_ID}`);
                
                db.close();
            });
        });
    });
}

// Función para forzar desbaneo en BD
function forzarDesbaneoEnBD() {
    console.log("🔧 FORZANDO DESBANEO EN BASE DE DATOS...");
    
    const db = new sqlite3.Database("./lnb_estadisticas.db");
    
    // Desactivar en tabla baneos
    db.run("UPDATE baneos SET activo = 0 WHERE auth_id = ?", [AUTH_ID], function(err1) {
        if (err1) {
            console.error("❌ Error actualizando tabla baneos:", err1);
        } else {
            console.log(`✅ Tabla baneos actualizada. Filas afectadas: ${this.changes}`);
        }
        
        // Desactivar en tabla jugadores
        db.run("UPDATE jugadores SET baneado = 0, fecha_ban = NULL, razon_ban = NULL, admin_ban = NULL WHERE uid = ?", [AUTH_ID], function(err2) {
            if (err2) {
                console.error("❌ Error actualizando tabla jugadores:", err2);
            } else {
                console.log(`✅ Tabla jugadores actualizada. Filas afectadas: ${this.changes}`);
            }
            
            console.log("🎉 DESBANEO FORZADO COMPLETADO EN BD");
            console.log("⚠️  NOTA: Aún puede ser necesario ejecutar room.clearBan() en HaxBall");
            
            db.close();
        });
    });
}

// Ejecutar diagnóstico
if (process.argv[2] === "--fix") {
    forzarDesbaneoEnBD();
} else {
    diagnosticarUnban();
}
