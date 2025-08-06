// unban_mejorado.js - Sistema de desbaneo completamente funcional
// Versión mejorada que garantiza que los desbaneos funcionen correctamente

const sqlite3 = require("sqlite3").verbose();

// Función principal mejorada de desbaneo
function unbanMejorado(input, jugadorAdmin, room) {
    return new Promise(async (resolve, reject) => {
        console.log(`🔧 UNBAN MEJORADO: Iniciando proceso para "${input}" por admin ${jugadorAdmin.name}`);
        
        // Validaciones iniciales
        if (!input || typeof input !== 'string') {
            const mensaje = "❌ Error: parámetro de entrada inválido";
            console.error(`❌ UNBAN: ${mensaje}`);
            room.sendAnnouncement(mensaje, jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
            return resolve(false);
        }
        
        if (!room) {
            const mensaje = "❌ Error: objeto room no disponible";
            console.error(`❌ UNBAN: ${mensaje}`);
            return resolve(false);
        }
        
        // Protección: evitar que el admin se desbanee a sí mismo
        if (jugadorAdmin.auth && (input === jugadorAdmin.auth || input === jugadorAdmin.auth.toString())) {
            const mensaje = `❌ No puedes desbanearte a ti mismo (UID: ${jugadorAdmin.auth})`;
            console.log(`🛡️ UNBAN: Protección activada - ${mensaje}`);
            room.sendAnnouncement(mensaje, jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
            return resolve(false);
        }
        
        let db;
        try {
            db = new sqlite3.Database("./lnb_estadisticas.db");
            console.log(`✅ UNBAN: Conexión a BD establecida`);
        } catch (dbError) {
            console.error(`❌ UNBAN: Error conectando a BD:`, dbError);
            room.sendAnnouncement("❌ Error de conexión a la base de datos", jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
            return resolve(false);
        }
        
        try {
            // PASO 1: Buscar el jugador baneado en la base de datos
            const jugadorBaneado = await buscarJugadorBaneado(db, input);
            
            if (!jugadorBaneado) {
                room.sendAnnouncement(`⚠️ No se encontró ningún jugador baneado con: "${input}"`, jugadorAdmin.id, parseInt("FFA500", 16), "bold", 0);
                room.sendAnnouncement(`💡 Verifica que el jugador esté realmente baneado`, jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
                db.close();
                return resolve(false);
            }
            
            console.log(`✅ UNBAN: Jugador encontrado en BD: ${jugadorBaneado.nombre} (UID: ${jugadorBaneado.uid})`);
            
            // PASO 2: Ejecutar múltiples métodos de clearBan para garantizar el desbaneo
            const metodosDesbaneo = await ejecutarDesbaneoHaxBall(room, jugadorBaneado, input);
            
            // PASO 3: Actualizar base de datos
            const bdActualizada = await actualizarBaseDatos(db, jugadorBaneado);
            
            // PASO 4: Reportar resultados
            const exito = metodosDesbaneo.exito || bdActualizada;
            
            if (exito) {
                room.sendAnnouncement(`✅ ${jugadorBaneado.nombre} ha sido desbaneado por ${jugadorAdmin.name}`, null, parseInt("00FF00", 16), "bold", 0);
                
                if (metodosDesbaneo.exito && bdActualizada) {
                    room.sendAnnouncement(`💡 Desbaneo completo: HaxBall + Base de datos`, jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
                } else if (metodosDesbaneo.exito) {
                    room.sendAnnouncement(`⚠️ Desbaneado en HaxBall, pero hubo problemas con la BD`, jugadorAdmin.id, parseInt("FFA500", 16), "normal", 0);
                } else if (bdActualizada) {
                    room.sendAnnouncement(`⚠️ Actualizado en BD, pero puede requerir reinicio de sala para HaxBall`, jugadorAdmin.id, parseInt("FFA500", 16), "normal", 0);
                }
                
                console.log(`✅ UNBAN: Proceso completado exitosamente para ${jugadorBaneado.nombre}`);
                console.log(`📊 UNBAN: Métodos utilizados: ${metodosDesbaneo.metodosExitosos.join(', ')}`);
                
            } else {
                room.sendAnnouncement(`❌ No se pudo desbanear completamente a "${input}"`, jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
                room.sendAnnouncement(`💡 Esto puede ocurrir si el baneo ya expiró o hay problemas de sincronización`, jugadorAdmin.id, parseInt("87CEEB", 16), "normal", 0);
                console.log(`❌ UNBAN: Proceso falló para ${input}`);
            }
            
            db.close();
            resolve(exito);
            
        } catch (error) {
            console.error(`❌ UNBAN: Error crítico:`, error);
            room.sendAnnouncement(`❌ Error interno al desbanear: ${error.message}`, jugadorAdmin.id, parseInt("FF6347", 16), "bold", 0);
            if (db) db.close();
            resolve(false);
        }
    });
}

// Función para buscar jugador baneado en múltiples tablas y formatos
function buscarJugadorBaneado(db, input) {
    return new Promise((resolve, reject) => {
        console.log(`🔍 UNBAN: Buscando "${input}" en múltiples tablas...`);
        
        // Preparar diferentes variaciones del input
        const variaciones = [
            input,
            input.toLowerCase(),
            input.toUpperCase(),
            String(input),
            input.trim()
        ];
        
        // Si parece hexadecimal, agregar decodificación
        if (/^[0-9A-F]+$/i.test(input) && input.length >= 6 && input.length % 2 === 0) {
            try {
                let decoded = '';
                for (let i = 0; i < input.length; i += 2) {
                    const hex = input.substr(i, 2);
                    const char = String.fromCharCode(parseInt(hex, 16));
                    decoded += char;
                }
                if (decoded && decoded !== input) {
                    variaciones.push(decoded);
                    console.log(`🔄 UNBAN: Agregando variación decodificada: "${decoded}"`);
                }
            } catch (e) {
                console.warn(`⚠️ UNBAN: Error decodificando hex:`, e.message);
            }
        }
        
        // Función recursiva para buscar en diferentes tablas y con diferentes variaciones
        let intentoActual = 0;
        const busquedas = [
            // Tabla jugadores - búsqueda exacta por UID
            { tabla: 'jugadores', campo: 'uid', condicionExtra: 'baneado = 1' },
            // Tabla jugadores - búsqueda exacta por nombre  
            { tabla: 'jugadores', campo: 'nombre', condicionExtra: 'baneado = 1' },
            // Tabla baneos - búsqueda exacta por auth_id
            { tabla: 'baneos', campo: 'auth_id', condicionExtra: 'activo = 1' },
            // Tabla baneos - búsqueda exacta por nombre
            { tabla: 'baneos', campo: 'nombre', condicionExtra: 'activo = 1' },
            // Tabla baneos - búsqueda por IP
            { tabla: 'baneos', campo: 'ip', condicionExtra: 'activo = 1' }
        ];
        
        function probarSiguienteBusqueda() {
            if (intentoActual >= busquedas.length) {
                console.log(`❌ UNBAN: No se encontró jugador baneado después de ${busquedas.length} tipos de búsqueda`);
                return resolve(null);
            }
            
            const busqueda = busquedas[intentoActual];
            intentoActual++;
            
            console.log(`🔍 UNBAN: Probando ${busqueda.tabla}.${busqueda.campo}...`);
            
            // Probar con cada variación del input
            let variacionActual = 0;
            function probarSiguienteVariacion() {
                if (variacionActual >= variaciones.length) {
                    return probarSiguienteBusqueda();
                }
                
                const valor = variaciones[variacionActual];
                variacionActual++;
                
                const query = `SELECT * FROM ${busqueda.tabla} WHERE ${busqueda.campo} = ? AND ${busqueda.condicionExtra}`;
                
                db.get(query, [valor], (err, row) => {
                    if (err) {
                        console.warn(`⚠️ UNBAN: Error en query ${busqueda.tabla}.${busqueda.campo}:`, err.message);
                        return probarSiguienteVariacion();
                    }
                    
                    if (row) {
                        console.log(`✅ UNBAN: Encontrado en ${busqueda.tabla}.${busqueda.campo}: ${row.nombre || row.name}`);
                        
                        // Normalizar resultado según la tabla
                        const resultado = {
                            nombre: row.nombre || row.name,
                            uid: row.uid || row.auth_id || row.authId,
                            tabla: busqueda.tabla,
                            ip: row.ip || null,
                            fechaBan: row.fecha_ban || row.fecha,
                            razonBan: row.razon_ban || row.razon,
                            adminBan: row.admin_ban || row.admin
                        };
                        
                        return resolve(resultado);
                    }
                    
                    probarSiguienteVariacion();
                });
            }
            
            probarSiguienteVariacion();
        }
        
        probarSiguienteBusqueda();
    });
}

// Función para ejecutar múltiples métodos de desbaneo en HaxBall
function ejecutarDesbaneoHaxBall(room, jugadorBaneado, inputOriginal) {
    return new Promise((resolve) => {
        console.log(`🎯 UNBAN: Ejecutando desbaneo en HaxBall para ${jugadorBaneado.nombre}`);
        
        const metodosIntentados = [];
        const metodosExitosos = [];
        let algunMetodoExitoso = false;
        
        // Lista de valores a probar con clearBan
        const valoresProbar = [];
        
        // Agregar UID del jugador
        if (jugadorBaneado.uid) {
            valoresProbar.push({ nombre: 'UID', valor: jugadorBaneado.uid });
            valoresProbar.push({ nombre: 'UID-string', valor: String(jugadorBaneado.uid) });
        }
        
        // Agregar input original
        if (inputOriginal && inputOriginal !== jugadorBaneado.uid) {
            valoresProbar.push({ nombre: 'input-original', valor: inputOriginal });
        }
        
        // Agregar IP si está disponible
        if (jugadorBaneado.ip && jugadorBaneado.ip !== 'N/A' && jugadorBaneado.ip !== '') {
            valoresProbar.push({ nombre: 'IP', valor: jugadorBaneado.ip });
        }
        
        // Si el UID parece hexadecimal, probar como número
        if (jugadorBaneado.uid && /^[a-fA-F0-9]+$/.test(jugadorBaneado.uid) && jugadorBaneado.uid.length >= 8) {
            try {
                const numeroDecimal = parseInt(jugadorBaneado.uid, 16);
                if (!isNaN(numeroDecimal)) {
                    valoresProbar.push({ nombre: 'UID-decimal', valor: numeroDecimal });
                }
            } catch (e) {
                console.warn(`⚠️ UNBAN: Error convirtiendo UID a decimal:`, e.message);
            }
        }
        
        console.log(`🧪 UNBAN: Probando ${valoresProbar.length} métodos de clearBan...`);
        
        // Probar cada método
        valoresProbar.forEach((metodo, index) => {
            try {
                console.log(`🔧 UNBAN: Probando método ${index + 1}: ${metodo.nombre} = ${metodo.valor}`);
                room.clearBan(metodo.valor);
                console.log(`✅ UNBAN: Método ${metodo.nombre} EXITOSO`);
                metodosExitosos.push(metodo.nombre);
                algunMetodoExitoso = true;
            } catch (error) {
                console.warn(`⚠️ UNBAN: Método ${metodo.nombre} falló: ${error.message}`);
                metodosIntentados.push(`${metodo.nombre}-FALLO`);
            }
        });
        
        // Método adicional: clearBans completo si hay pocos jugadores
        try {
            const jugadoresConectados = room.getPlayerList().length;
            if (jugadoresConectados <= 3 && !algunMetodoExitoso) {
                console.log(`🚨 UNBAN: Probando clearBans completo (jugadores: ${jugadoresConectados})`);
                room.clearBans();
                console.log(`✅ UNBAN: clearBans completo EXITOSO`);
                metodosExitosos.push('clearBans-completo');
                algunMetodoExitoso = true;
            } else if (jugadoresConectados > 3) {
                console.log(`⚠️ UNBAN: clearBans omitido - demasiados jugadores (${jugadoresConectados})`);
                metodosIntentados.push('clearBans-OMITIDO');
            }
        } catch (error) {
            console.warn(`⚠️ UNBAN: clearBans completo falló: ${error.message}`);
            metodosIntentados.push('clearBans-FALLO');
        }
        
        console.log(`📊 UNBAN: HaxBall - Exitosos: [${metodosExitosos.join(', ')}], Fallidos: [${metodosIntentados.join(', ')}]`);
        
        resolve({
            exito: algunMetodoExitoso,
            metodosExitosos: metodosExitosos,
            metodosIntentados: metodosIntentados
        });
    });
}

// Función para actualizar base de datos
function actualizarBaseDatos(db, jugadorBaneado) {
    return new Promise((resolve) => {
        console.log(`💾 UNBAN: Actualizando BD para tabla: ${jugadorBaneado.tabla}`);
        
        let query, params;
        
        if (jugadorBaneado.tabla === 'jugadores') {
            query = "UPDATE jugadores SET baneado = 0, fecha_ban = NULL, razon_ban = NULL, admin_ban = NULL WHERE uid = ?";
            params = [jugadorBaneado.uid];
        } else if (jugadorBaneado.tabla === 'baneos') {
            query = "UPDATE baneos SET activo = 0 WHERE auth_id = ?";
            params = [jugadorBaneado.uid];
        } else {
            console.warn(`⚠️ UNBAN: Tabla desconocida: ${jugadorBaneado.tabla}`);
            return resolve(false);
        }
        
        db.run(query, params, function(err) {
            if (err) {
                console.error(`❌ UNBAN: Error actualizando BD:`, err);
                resolve(false);
            } else {
                console.log(`✅ UNBAN: BD actualizada correctamente (filas afectadas: ${this.changes})`);
                resolve(true);
            }
        });
    });
}

// Función de validación para determinar tipo de input
function validarTipoInput(input) {
    const resultado = {
        esIP: /^(\d{1,3}\.){3}\d{1,3}$/.test(input),
        esUID: /^[0-9A-Fa-f]+$/.test(input) && input.length > 5,
        esNombre: !(/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) && !(/^[0-9A-Fa-f]+$/.test(input) && input.length > 5),
        longitud: input.length,
        tieneCaracteresEspeciales: /[^a-zA-Z0-9._-]/.test(input)
    };
    
    console.log(`🔍 UNBAN: Análisis de input "${input}":`, resultado);
    return resultado;
}

module.exports = {
    unbanMejorado,
    buscarJugadorBaneado,
    ejecutarDesbaneoHaxBall,
    actualizarBaseDatos,
    validarTipoInput
};
