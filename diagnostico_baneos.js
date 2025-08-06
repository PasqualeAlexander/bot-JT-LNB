// diagnostico_baneos.js - Herramienta para verificar el estado de los baneos

const sqlite3 = require("sqlite3").verbose();

// Función para mostrar todos los baneos activos
function mostrarBaneosActivos(room, jugadorAdmin) {
    const db = new sqlite3.Database("./lnb_estadisticas.db");
    
    console.log("🔍 DIAGNÓSTICO: Consultando baneos activos...");
    
    // Consultar baneos activos en la nueva tabla
    const query = `
        SELECT id, nombre, auth_id, ip, razon, admin, fecha, duracion, activo
        FROM baneos 
        WHERE activo = 1 
        ORDER BY id DESC 
        LIMIT 10
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("❌ Error consultando baneos:", err);
            room.sendAnnouncement("❌ Error consultando la base de datos", jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
        } else if (rows && rows.length > 0) {
            room.sendAnnouncement("📋 Baneos activos:", jugadorAdmin.id, parseInt("87CEEB", 16), "bold", 0);
            
            rows.forEach(ban => {
                const duracionTexto = ban.duracion === 0 ? "Permanente" : `${ban.duracion} min`;
                room.sendAnnouncement(
                    `🆔 ID: ${ban.id} | 👤 ${ban.nombre} | ⏱️ ${duracionTexto}`, 
                    jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0
                );
                
                // Mostrar detalles adicionales en consola
                console.log(`Ban ID ${ban.id}:`);
                console.log(`  - Nombre: ${ban.nombre}`);
                console.log(`  - UID: ${ban.auth_id}`);
                console.log(`  - IP: ${ban.ip || 'N/A'}`);
                console.log(`  - Razón: ${ban.razon}`);
                console.log(`  - Admin: ${ban.admin}`);
                console.log(`  - Fecha: ${ban.fecha}`);
                console.log(`  - Duración: ${duracionTexto}`);
                console.log(`  - Activo: ${ban.activo}`);
                console.log('---');
            });
        } else {
            room.sendAnnouncement("✅ No hay baneos activos", jugadorAdmin.id, parseInt("00FF00", 16), "bold", 0);
            console.log("✅ No hay baneos activos en la tabla 'baneos'");
        }
        
        db.close();
    });
}

// Función para verificar un ban específico por ID
function verificarBanPorID(banId, room, jugadorAdmin) {
    const db = new sqlite3.Database("./lnb_estadisticas.db");
    
    console.log(`🔍 DIAGNÓSTICO: Verificando Ban ID ${banId}...`);
    
    // Buscar el ban específico
    const query = "SELECT * FROM baneos WHERE id = ?";
    
    db.get(query, [banId], (err, row) => {
        if (err) {
            console.error("❌ Error consultando ban:", err);
            room.sendAnnouncement(`❌ Error consultando Ban ID ${banId}`, jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
        } else if (row) {
            const estadoTexto = row.activo === 1 ? "ACTIVO ✅" : "INACTIVO ❌";
            const duracionTexto = row.duracion === 0 ? "Permanente" : `${row.duracion} minutos`;
            
            room.sendAnnouncement(`📋 Ban ID ${banId} - ${estadoTexto}`, jugadorAdmin.id, parseInt("87CEEB", 16), "bold", 0);
            room.sendAnnouncement(`👤 Jugador: ${row.nombre}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`🔑 UID: ${row.auth_id}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`🌐 IP: ${row.ip || 'N/A'}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`📄 Razón: ${row.razon}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`👨‍💼 Admin: ${row.admin}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`📅 Fecha: ${row.fecha}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`⏱️ Duración: ${duracionTexto}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            
            // Log detallado en consola
            console.log(`✅ Ban ID ${banId} encontrado:`);
            console.log(`  - Estado: ${estadoTexto}`);
            console.log(`  - Nombre: ${row.nombre}`);
            console.log(`  - UID: ${row.auth_id}`);
            console.log(`  - IP: ${row.ip || 'N/A'}`);
            console.log(`  - Razón: ${row.razon}`);
            console.log(`  - Admin: ${row.admin}`);
            console.log(`  - Fecha: ${row.fecha}`);
            console.log(`  - Duración: ${duracionTexto}`);
            
            if (row.activo === 0) {
                room.sendAnnouncement("💡 Este ban ya está inactivo (desbaneado)", jugadorAdmin.id, parseInt("FFA500", 16), "normal", 0);
            }
        } else {
            room.sendAnnouncement(`⚠️ No existe ningún Ban ID: ${banId}`, jugadorAdmin.id, parseInt("FFA500", 16), "bold", 0);
            console.log(`❌ No se encontró Ban ID ${banId} en la base de datos`);
        }
        
        db.close();
    });
}

// Función para diagnosticar el estado de ambas tablas
function diagnosticoCompleto(room, jugadorAdmin) {
    const db = new sqlite3.Database("./lnb_estadisticas.db");
    
    console.log("🔍 DIAGNÓSTICO COMPLETO: Analizando ambas tablas...");
    
    // Contar baneos en tabla 'baneos'
    db.get("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE activo = 1) as activos FROM baneos", [], (err1, baneosStats) => {
        if (err1) {
            console.error("❌ Error consultando tabla baneos:", err1);
        } else {
            console.log(`📊 Tabla 'baneos': ${baneosStats.total} total, ${baneosStats.activos} activos`);
            room.sendAnnouncement(`📊 Tabla baneos: ${baneosStats.total} total, ${baneosStats.activos} activos`, jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
        }
        
        // Contar baneos en tabla 'jugadores'
        db.get("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE baneado = 1) as baneados FROM jugadores", [], (err2, jugadoresStats) => {
            if (err2) {
                console.error("❌ Error consultando tabla jugadores:", err2);
            } else {
                console.log(`📊 Tabla 'jugadores': ${jugadoresStats.total} total, ${jugadoresStats.baneados} baneados`);
                room.sendAnnouncement(`📊 Tabla jugadores: ${jugadoresStats.total} total, ${jugadoresStats.baneados} baneados`, jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
            }
            
            db.close();
        });
    });
}

// Comandos adicionales para debugging
function procesarComandoDiagnostico(player, message, room) {
    // Verificar permisos
    if (!esAdmin(player)) {
        room.sendAnnouncement("❌ No tienes permisos para este comando", player.id, parseInt("FF6347", 16), "bold", 0);
        return;
    }
    
    const args = message.trim().split(' ');
    const comando = args[0].toLowerCase();
    
    switch (comando) {
        case '!bans':
            mostrarBaneosActivos(room, player);
            break;
            
        case '!checkban':
            if (args.length < 2) {
                room.sendAnnouncement("❌ Uso: !checkban <ID>", player.id, parseInt("FF6347", 16), "bold", 0);
                return;
            }
            const banId = parseInt(args[1]);
            if (isNaN(banId)) {
                room.sendAnnouncement("❌ El ID debe ser un número", player.id, parseInt("FF6347", 16), "bold", 0);
                return;
            }
            verificarBanPorID(banId, room, player);
            break;
            
        case '!diagban':
            diagnosticoCompleto(room, player);
            break;
            
        default:
            return false; // No es un comando de diagnóstico
    }
    
    return true; // Comando procesado
}

// Función auxiliar para verificar permisos (personaliza según tu sistema)
function esAdmin(player) {
    return player.admin || 
           (player.auth && ['admin1', 'admin2'].includes(player.auth)) ||
           ['Admin1', 'Admin2'].includes(player.name);
}

module.exports = {
    mostrarBaneosActivos,
    verificarBanPorID,
    diagnosticoCompleto,
    procesarComandoDiagnostico,
    esAdmin
};

/*
COMANDOS DE DIAGNÓSTICO:

1. !bans
   - Muestra los 10 baneos más recientes que están activos
   
2. !checkban <ID>
   - Verifica el estado específico de un Ban ID
   - Ejemplo: !checkban 12
   
3. !diagban
   - Muestra estadísticas completas de ambas tablas

EJEMPLOS DE USO:
- Para ver baneos activos: !bans
- Para verificar si existe el Ban ID 12: !checkban 12
- Para diagnóstico completo: !diagban

SOLUCIÓN AL PROBLEMA:
Si !unban 12 dice "completado" pero no funciona, usa:
1. !checkban 12 (para ver si existe y está activo)
2. Si existe pero está inactivo, ya fue desbaneado antes
3. Si no existe, significa que el número 12 no es un Ban ID válido
*/
