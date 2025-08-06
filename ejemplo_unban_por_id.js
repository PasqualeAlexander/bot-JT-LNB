// ejemplo_unban_por_id.js - Ejemplo de integración del desbaneo por Ban ID

const { unbanMejorado, validarTipoInput } = require('./unban_mejorado.js');

// Ejemplo de cómo integrar en tu comando !unban existente
function manejarComandoUnban(message, jugadorAdmin, room) {
    const args = message.trim().split(' ');
    
    if (args.length < 2) {
        room.sendAnnouncement("❌ Uso: !unban <nombre|UID|IP|BanID>", jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
        room.sendAnnouncement("💡 Ejemplos:", jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
        room.sendAnnouncement("   !unban NombreJugador", jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
        room.sendAnnouncement("   !unban dQrCF4tFKgw62vs_SYc3-F_HWhqB14OkfxjVuHxObFI", jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
        room.sendAnnouncement("   !unban 192.168.1.100", jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
        room.sendAnnouncement("   !unban 11  (Ban ID)", jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
        return;
    }
    
    const inputDesbaneo = args.slice(1).join(' ').trim();
    
    // Validar el tipo de input para mostrar información útil al admin
    const tipoInput = validarTipoInput(inputDesbaneo);
    
    let tipoDetectado = "";
    if (tipoInput.esBanID) {
        tipoDetectado = `🆔 Ban ID: ${inputDesbaneo}`;
    } else if (tipoInput.esUID) {
        tipoDetectado = `🔑 UID: ${inputDesbaneo}`;
    } else if (tipoInput.esIP) {
        tipoDetectado = `🌐 IP: ${inputDesbaneo}`;
    } else {
        tipoDetectado = `👤 Nombre: ${inputDesbaneo}`;
    }
    
    room.sendAnnouncement(`🔧 Iniciando desbaneo ${tipoDetectado}...`, jugadorAdmin.id, parseInt("FFA500", 16), "normal", 0);
    
    // Ejecutar el desbaneo mejorado
    unbanMejorado(inputDesbaneo, jugadorAdmin, room)
        .then(exito => {
            if (exito) {
                console.log(`✅ Desbaneo exitoso para: ${inputDesbaneo}`);
            } else {
                console.log(`❌ Desbaneo falló para: ${inputDesbaneo}`);
            }
        })
        .catch(error => {
            console.error(`❌ Error en desbaneo:`, error);
            room.sendAnnouncement(`❌ Error inesperado al desbanear: ${error.message}`, jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
        });
}

// Ejemplo de uso con tu sistema de comandos existente
function procesarComando(player, message, room) {
    // Verificar permisos de admin (ajusta según tu sistema)
    if (!esAdmin(player)) {
        room.sendAnnouncement("❌ No tienes permisos para este comando", player.id, parseInt("FF6347", 16), "bold", 0);
        return;
    }
    
    const comando = message.toLowerCase().split(' ')[0];
    
    switch (comando) {
        case '!unban':
            manejarComandoUnban(message, player, room);
            break;
        // ... otros comandos
    }
}

// Función auxiliar para verificar permisos (personaliza según tu sistema)
function esAdmin(player) {
    // Ejemplo básico - ajusta según tu sistema de permisos
    return player.admin || 
           (player.auth && ['admin1', 'admin2'].includes(player.auth)) ||
           ['Admin1', 'Admin2'].includes(player.name);
}

// Función para mostrar información sobre un baneo específico (opcional)
async function mostrarInfoBaneo(banId, jugadorAdmin, room) {
    const sqlite3 = require("sqlite3").verbose();
    const db = new sqlite3.Database("./lnb_estadisticas.db");
    
    const query = "SELECT * FROM baneos WHERE id = ? AND activo = 1";
    
    db.get(query, [banId], (err, row) => {
        if (err) {
            room.sendAnnouncement(`❌ Error consultando baneo: ${err.message}`, jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
        } else if (row) {
            room.sendAnnouncement(`📋 Info del Ban ID ${banId}:`, jugadorAdmin.id, parseInt("87CEEB", 16), "bold", 0);
            room.sendAnnouncement(`   👤 Jugador: ${row.nombre}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`   🔑 UID: ${row.auth_id}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`   🌐 IP: ${row.ip}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`   📄 Razón: ${row.razon}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`   👨‍💼 Admin: ${row.admin}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
            room.sendAnnouncement(`   📅 Fecha: ${row.fecha}`, jugadorAdmin.id, parseInt("FFFFFF", 16), "normal", 0);
        } else {
            room.sendAnnouncement(`⚠️ No se encontró baneo activo con ID: ${banId}`, jugadorAdmin.id, parseInt("FFA500", 16), "bold", 0);
        }
        db.close();
    });
}

module.exports = {
    manejarComandoUnban,
    procesarComando,
    mostrarInfoBaneo,
    esAdmin
};

/*
INSTRUCCIONES DE USO:

1. DESBANEO POR BAN ID:
   !unban 11
   
2. DESBANEO POR NOMBRE:
   !unban NombreJugador
   
3. DESBANEO POR UID:
   !unban dQrCF4tFKgw62vs_SYc3-F_HWhqB14OkfxjVuHxObFI
   
4. DESBANEO POR IP:
   !unban 192.168.242.189

VENTAJAS DEL NUEVO SISTEMA:
- ✅ Detecta automáticamente si el input es un Ban ID (número puro)
- ✅ Prioriza la búsqueda por Ban ID cuando detecta un número
- ✅ Funciona con el sistema existente sin romper compatibilidad
- ✅ Múltiples métodos de clearBan para garantizar el desbaneo
- ✅ Actualiza correctamente la base de datos
- ✅ Mensajes informativos para el admin

Para usar en tu código principal, simplemente:
1. Importa el módulo: const { unbanMejorado } = require('./unban_mejorado.js');
2. Reemplaza tu función de unban existente con unbanMejorado()
3. ¡El desbaneo por Ban ID funcionará automáticamente!
*/
