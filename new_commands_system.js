/**
 * NUEVO SISTEMA DE COMANDOS
 * Sistema usando librariesMap.commands para el comando unban
 */

function initializeCommandSystem(room, permissionCtx, permissionsIds) {
    // Verificar que el sistema de comandos esté disponible
    if (!room.librariesMap || !room.librariesMap.commands) {
        console.error("❌ COMMANDS: Sistema de comandos no disponible en room.librariesMap");
        return false;
    }

    console.log("✅ COMMANDS: Inicializando nuevo sistema de comandos...");

    // Definir constantes para tipos de variables
    const VariableType = {
        Integer: 'integer',
        String: 'string',
        Boolean: 'boolean',
        Float: 'float'
    };

    try {
        // Comando UNBAN
        room.librariesMap.commands.add({
            name: "unban",
            parameters: [{
                name: "playerId",
                type: VariableType.Integer,
                range: {
                    min: 0
                },
            }],
            minParameterCount: 1,
            helpText: "Unbans a user.",
            callback: ({ playerId }, byId) => {
                console.log(`🔧 UNBAN: Nuevo sistema - Admin ID ${byId} solicita desbanear playerId: ${playerId}`);
                
                // Verificar permisos
                if (!permissionCtx?.checkPlayerPermission(byId, permissionsIds.unban)) {
                    room.librariesMap.commands?.announcePermissionDenied(byId);
                    return;
                }

                const byObj = room.getPlayer(byId);
                if (!byObj) {
                    console.error(`❌ UNBAN: Admin con ID ${byId} no encontrado`);
                    return;
                }

                console.log(`🔧 UNBAN: Ejecutando desbaneo para playerId=${playerId} por admin ${byObj.name}`);

                try {
                    // Ejecutar room.clearBan con el playerId
                    room.clearBan(playerId);
                    
                    // Anunciar éxito
                    const mensaje = `El jugador ID: ${playerId} fue desbaneado por ${byObj.name}`;
                    room.librariesMap.commands.announceAction(mensaje, byId);
                    
                    console.log(`✅ UNBAN: ${mensaje}`);
                    
                } catch (error) {
                    console.error(`❌ UNBAN: Error ejecutando clearBan(${playerId}):`, error);
                    
                    // Intentar métodos alternativos
                    let exitoso = false;
                    const metodosAlternativos = [
                        String(playerId),
                        playerId.toString(),
                        parseInt(playerId, 10)
                    ];
                    
                    for (const metodo of metodosAlternativos) {
                        try {
                            room.clearBan(metodo);
                            const mensajeAlternativo = `El jugador ID: ${playerId} fue desbaneado por ${byObj.name} (método alternativo)`;
                            room.librariesMap.commands.announceAction(mensajeAlternativo, byId);
                            console.log(`✅ UNBAN: ${mensajeAlternativo}`);
                            exitoso = true;
                            break;
                        } catch (altError) {
                            console.warn(`⚠️ UNBAN: Método alternativo ${metodo} falló:`, altError.message);
                        }
                    }
                    
                    if (!exitoso) {
                        const mensajeError = `Error al desbanear jugador ID: ${playerId}`;
                        room.sendAnnouncement(mensajeError, byId, 0xFF6347, "bold", 0);
                        console.error(`❌ UNBAN: Todos los métodos fallaron para playerId=${playerId}`);
                    }
                }
            }
        });

        console.log("✅ COMMANDS: Comando 'unban' registrado exitosamente");

        // Agregar más comandos aquí en el futuro si es necesario
        // room.librariesMap.commands.add({ ... });

        return true;

    } catch (error) {
        console.error("❌ COMMANDS: Error inicializando sistema de comandos:", error);
        return false;
    }
}

// Función para verificar si el sistema está disponible
function checkCommandSystemAvailability(room) {
    const checks = {
        room: !!room,
        librariesMap: !!room?.librariesMap,
        commands: !!room?.librariesMap?.commands,
        add: typeof room?.librariesMap?.commands?.add === 'function',
        announceAction: typeof room?.librariesMap?.commands?.announceAction === 'function',
        announcePermissionDenied: typeof room?.librariesMap?.commands?.announcePermissionDenied === 'function'
    };

    console.log("🔍 COMMANDS: Verificación del sistema de comandos:", checks);

    const allAvailable = Object.values(checks).every(check => check === true);
    
    if (allAvailable) {
        console.log("✅ COMMANDS: Sistema de comandos completamente disponible");
    } else {
        console.warn("⚠️ COMMANDS: Sistema de comandos no completamente disponible");
    }

    return allAvailable;
}

// Función para limpiar comandos anteriores (opcional)
function cleanupOldCommands(room) {
    try {
        if (room.librariesMap?.commands?.clear) {
            room.librariesMap.commands.clear();
            console.log("🧹 COMMANDS: Comandos anteriores limpiados");
        }
    } catch (error) {
        console.warn("⚠️ COMMANDS: No se pudieron limpiar comandos anteriores:", error);
    }
}

module.exports = {
    initializeCommandSystem,
    checkCommandSystemAvailability,
    cleanupOldCommands
};
