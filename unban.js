// unban.js - Sistema mejorado de desbaneo

const sqlite3 = require("sqlite3").verbose();

function isIP(str) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(str);
}

function isUID(str) {
  // Mejorar detección de UID - puede ser hexadecimal o numérico
  return /^[0-9A-Fa-f]+$/.test(str) && str.length > 5;
}

// Función para decodificar UID hexadecimal
function convertirUIDParaDB(uid) {
    try {
        if (typeof uid === 'string' && /^[0-9A-F]+$/i.test(uid)) {
            let decoded = '';
            for (let i = 0; i < uid.length; i += 2) {
                const hex = uid.substr(i, 2);
                const char = String.fromCharCode(parseInt(hex, 16));
                decoded += char;
            }
            console.log(`🔄 UID decodificado: ${uid} -> ${decoded}`);
            return decoded;
        }
        return uid;
    } catch (error) {
        console.error(`❌ Error decodificando UID ${uid}:`, error);
        return uid;
    }
}

// Función para buscar UID en múltiples formatos
function buscarUIDEnBaseDatos(db, uid) {
    return new Promise((resolve, reject) => {
        const uidOriginal = uid;
        const uidDecodificado = convertirUIDParaDB(uid);
        
        console.log(`🔍 Buscando UID: original='${uidOriginal}', decodificado='${uidDecodificado}'`);
        
        // Buscar en tabla jugadores primero (sistema viejo)
        const query1 = 'SELECT * FROM jugadores WHERE uid = ? AND baneado = 1';
        
        db.get(query1, [uidOriginal], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row) {
                console.log(`✅ Jugador encontrado en tabla jugadores con UID original: ${row.nombre}`);
                resolve({ tipo: 'jugadores', data: row });
                return;
            }
            
            // Buscar con UID decodificado
            db.get(query1, [uidDecodificado], (err2, row2) => {
                if (err2) {
                    reject(err2);
                    return;
                }
                
                if (row2) {
                    console.log(`✅ Jugador encontrado en tabla jugadores con UID decodificado: ${row2.nombre}`);
                    resolve({ tipo: 'jugadores', data: row2 });
                    return;
                }
                
                // Buscar en tabla baneos (sistema nuevo)
                const query2 = 'SELECT * FROM baneos WHERE auth_id = ? AND activo = 1';
                
                db.get(query2, [uidOriginal], (err3, row3) => {
                    if (err3) {
                        reject(err3);
                        return;
                    }
                    
                    if (row3) {
                        console.log(`✅ Jugador encontrado en tabla baneos: ${row3.nombre}`);
                        resolve({ tipo: 'baneos', data: row3 });
                        return;
                    }
                    
                    // Búsqueda por patrón como último recurso
                    const query3 = 'SELECT * FROM jugadores WHERE (uid LIKE ? OR uid LIKE ?) AND baneado = 1';
                    db.get(query3, [`%${uidOriginal}%`, `%${uidDecodificado}%`], (err4, row4) => {
                        if (err4) {
                            console.warn(`⚠️ Error en búsqueda LIKE:`, err4);
                        }
                        
                        if (row4) {
                            console.log(`✅ Jugador encontrado con búsqueda LIKE: ${row4.nombre}`);
                            resolve({ tipo: 'jugadores', data: row4 });
                        } else {
                            console.log(`❌ No se encontró jugador baneado con UID: ${uidOriginal}`);
                            resolve(null);
                        }
                    });
                });
            });
        });
    });
}

function unbanPlayer(input, room) {
  console.log(`🔧 UNBAN: Iniciando proceso de desbaneo para: ${input}`);
  
  // Validar parámetros de entrada
  if (!input || typeof input !== 'string') {
    console.error(`❌ UNBAN: Input inválido:`, input);
    room.sendChat("❌ Error: parámetro de entrada inválido");
    return;
  }
  
  if (!room || typeof room.clearBan !== 'function') {
    console.error(`❌ UNBAN: Objeto room inválido o clearBan no disponible`);
    room.sendChat("❌ Error: funcionalidad de desbaneo no disponible");
    return;
  }
  
  let db;
  try {
    db = new sqlite3.Database("./lnb_estadisticas.db");
    console.log(`✅ UNBAN: Conexión a BD establecida correctamente`);
  } catch (dbError) {
    console.error(`❌ UNBAN: Error conectando a BD:`, dbError);
    room.sendChat("❌ Error de conexión a la base de datos");
    return;
  }
  
  console.log(`🔧 UNBAN: Procesando solicitud de desbaneo para: ${input}`);
  
  if (isIP(input)) {
    console.log(`🔧 UNBAN: Detectado como IP: ${input}`);
    // Manejar desbaneo por IP
    const query = "SELECT * FROM baneos WHERE ip = ? AND activo = 1";
    
    db.get(query, [input], function (err, row) {
      if (err) {
        console.error(`❌ UNBAN: Error buscando IP ${input}:`, err);
        room.sendChat("❌ Error al buscar el baneo por IP.");
        db.close();
        return;
      }
      
      if (!row) {
        room.sendChat(`⚠️ No se encontró ningún baneo activo para la IP: ${input}`);
        db.close();
        return;
      }
      
      // Desactivar baneo por IP
      db.run("UPDATE baneos SET activo = 0 WHERE ip = ?", [input], function(updateErr) {
        if (updateErr) {
          console.error(`❌ UNBAN: Error desbaneando IP:`, updateErr);
          room.sendChat("❌ Error al desbanear la IP.");
        } else {
          console.log(`✅ UNBAN: IP desbaneada exitosamente: ${input}`);
          room.sendChat(`✅ IP desbaneada correctamente: ${input}`);
        }
        db.close();
      });
    });
    
  } else if (isUID(input)) {
    console.log(`🔧 UNBAN: Detectado como UID: ${input}`);
    
    // Buscar usando la función mejorada
    buscarUIDEnBaseDatos(db, input)
      .then(resultado => {
        if (!resultado) {
          room.sendChat(`⚠️ No se encontró ningún jugador baneado con UID: ${input}`);
          db.close();
          return;
        }
        
        const { tipo, data } = resultado;
        console.log(`✅ UNBAN: Encontrado en tabla ${tipo}: ${data.nombre}`);
        
        if (tipo === 'jugadores') {
          // Desbanear en tabla jugadores (sistema viejo)
          const updateQuery = "UPDATE jugadores SET baneado = 0, fecha_ban = NULL, razon_ban = NULL, admin_ban = NULL WHERE uid = ?";
          
          db.run(updateQuery, [data.uid], function(err) {
            if (err) {
              console.error(`❌ UNBAN: Error desbaneando en tabla jugadores:`, err);
              room.sendChat("❌ Error al desbanear en la base de datos.");
            } else {
              console.log(`✅ UNBAN: Jugador desbaneado en tabla jugadores: ${data.nombre}`);
              
              // Intentar clearBan en HaxBall
              try {
                room.clearBan(data.uid);
                console.log(`✅ UNBAN: room.clearBan(${data.uid}) ejecutado correctamente`);
              } catch (e) {
                console.warn(`⚠️ UNBAN: clearBan falló:`, e.message);
              }
              
              room.sendChat(`✅ ${data.nombre} desbaneado correctamente`);
            }
            db.close();
          });
          
        } else if (tipo === 'baneos') {
          // Desbanear en tabla baneos (sistema nuevo)
          const updateQuery = "UPDATE baneos SET activo = 0 WHERE auth_id = ?";
          
          db.run(updateQuery, [data.auth_id], function(err) {
            if (err) {
              console.error(`❌ UNBAN: Error desbaneando en tabla baneos:`, err);
              room.sendChat("❌ Error al desbanear en la base de datos.");
            } else {
              console.log(`✅ UNBAN: Jugador desbaneado en tabla baneos: ${data.nombre}`);
              
              // Intentar clearBan en HaxBall con el UID correcto
              try {
                // IMPORTANTE: room.clearBan() requiere el UID original, no el auth_id
                const uidParaClearBan = data.auth_id; // En tabla baneos, auth_id ES el UID
                room.clearBan(uidParaClearBan);
                console.log(`✅ UNBAN: room.clearBan(${uidParaClearBan}) ejecutado correctamente`);
              } catch (e) {
                console.warn(`⚠️ UNBAN: clearBan falló:`, e.message);
              }
              
              room.sendChat(`✅ ${data.nombre} desbaneado correctamente`);
            }
            db.close();
          });
        }
      })
      .catch(error => {
        console.error(`❌ UNBAN: Error en búsqueda de UID:`, error);
        room.sendChat("❌ Error al buscar el jugador por UID.");
        db.close();
      });
      
  } else {
    console.log(`🔧 UNBAN: Detectado como nombre: ${input}`);
    
    // Buscar por nombre en ambas tablas
    const query1 = "SELECT * FROM jugadores WHERE nombre = ? AND baneado = 1";
    
    db.get(query1, [input], function (err, row) {
      if (err) {
        console.error(`❌ UNBAN: Error buscando nombre ${input}:`, err);
        room.sendChat("❌ Error al buscar el jugador por nombre.");
        db.close();
        return;
      }
      
      if (row) {
        // Encontrado en tabla jugadores
        const updateQuery = "UPDATE jugadores SET baneado = 0, fecha_ban = NULL, razon_ban = NULL, admin_ban = NULL WHERE nombre = ?";
        
        db.run(updateQuery, [input], function(updateErr) {
          if (updateErr) {
            console.error(`❌ UNBAN: Error desbaneando por nombre:`, updateErr);
            room.sendChat("❌ Error al desbanear en la base de datos.");
          } else {
            console.log(`✅ UNBAN: Jugador desbaneado por nombre: ${input}`);
            
            // Intentar clearBan si tiene UID
            if (row.uid) {
              try {
                room.clearBan(row.uid);
                console.log(`✅ UNBAN: room.clearBan(${row.uid}) ejecutado correctamente`);
              } catch (e) {
                console.warn(`⚠️ UNBAN: clearBan falló:`, e.message);
              }
            }
            
            room.sendChat(`✅ ${input} desbaneado correctamente`);
          }
          db.close();
        });
      } else {
        // Buscar en tabla baneos
        const query2 = "SELECT * FROM baneos WHERE nombre = ? AND activo = 1";
        
        db.get(query2, [input], function (err2, row2) {
          if (err2) {
            console.error(`❌ UNBAN: Error buscando en tabla baneos:`, err2);
            room.sendChat("❌ Error al buscar el jugador.");
            db.close();
            return;
          }
          
          if (row2) {
            // Encontrado en tabla baneos
            const updateQuery = "UPDATE baneos SET activo = 0 WHERE nombre = ?";
            
            db.run(updateQuery, [input], function(updateErr) {
              if (updateErr) {
                console.error(`❌ UNBAN: Error desbaneando en tabla baneos:`, updateErr);
                room.sendChat("❌ Error al desbanear en la base de datos.");
              } else {
                console.log(`✅ UNBAN: Jugador desbaneado en tabla baneos: ${input}`);
                
                // Intentar clearBan
                try {
                  room.clearBan(row2.auth_id);
                  console.log(`✅ UNBAN: room.clearBan(${row2.auth_id}) ejecutado correctamente`);
                } catch (e) {
                  console.warn(`⚠️ UNBAN: clearBan falló:`, e.message);
                }
                
                room.sendChat(`✅ ${input} desbaneado correctamente`);
              }
              db.close();
            });
          } else {
            room.sendChat(`⚠️ No se encontró ningún jugador baneado con nombre: ${input}`);
            db.close();
          }
        });
      }
    });
  }
}

module.exports = unbanPlayer;
