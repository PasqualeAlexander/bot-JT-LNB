/* 
* ██████╗  ██████╗ ████████╗   ██╗     ███╗   ██╗██████╗         ██╗████████╗
* ██╔══██╗██╔═══██╗╚══██╔══╝   ██║     ████╗  ██║██╔══██╗        ██║╚══██╔══╝
* ██████╔╝██║   ██║   ██║      ██║     ██╔██╗ ██║██████╔╝        ██║   ██║   
* ██╔══██╗██║   ██║   ██║      ██║     ██║╚██╗██║██╔══██╗   ██   ██║   ██║   
* ██████╔╝╚██████╔╝   ██║      ███████╗██║ ╚████║██████╔╝   ╚█████╔╝   ██║   
* ╚═════╝  ╚═════╝    ╚═╝      ╚══════╝╚═╝  ╚═══╝╚═════╝     ╚════╝    ╚═╝    

BOT LIGA NACIONAL DE BIGGER LNB - VERSIÓN PUPPETEER CON NODE.JS + SQLITE
   Compatible con Puppeteer y base de datos SQLite
   ============================== */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const FormData = require('form-data');

// Configuración del archivo de base de datos
const dbPath = path.join(process.cwd(), 'lnb_estadisticas.db');
const db = new sqlite3.Database(dbPath);

// Crear tablas de base de datos
const crearTablas = () => {
    // Tabla principal de jugadores
    db.run(`CREATE TABLE IF NOT EXISTS jugadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL,
        partidos INTEGER DEFAULT 0,
        victorias INTEGER DEFAULT 0,
        derrotas INTEGER DEFAULT 0,
        goles INTEGER DEFAULT 0,
        asistencias INTEGER DEFAULT 0,
        autogoles INTEGER DEFAULT 0,
        mejorRachaGoles INTEGER DEFAULT 0,
        mejorRachaAsistencias INTEGER DEFAULT 0,
        hatTricks INTEGER DEFAULT 0,
        vallasInvictas INTEGER DEFAULT 0,
        tiempoJugado INTEGER DEFAULT 0,
        promedioGoles REAL DEFAULT 0.0,
        promedioAsistencias REAL DEFAULT 0.0,
        fechaPrimerPartido TEXT,
        fechaUltimoPartido TEXT,
        xp INTEGER DEFAULT 40,
        nivel INTEGER DEFAULT 1,
        codigoRecuperacion TEXT,
        fechaCodigoCreado TEXT,
        esVIP INTEGER DEFAULT 0,
        fechaVIP TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);
    
    // Agregar columnas VIP a tablas existentes si no existen
    db.run(`ALTER TABLE jugadores ADD COLUMN esVIP INTEGER DEFAULT 0`, (err) => {
        // Error esperado si la columna ya existe - ignorar
    });
    db.run(`ALTER TABLE jugadores ADD COLUMN fechaVIP TEXT`, (err) => {
        // Error esperado si la columna ya existe - ignorar
    });
    
    // Tabla de records históricos
    db.run(`CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        jugador TEXT NOT NULL,
        valor INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        detalles TEXT
    );`);
    
    // Tabla de partidos
    db.run(`CREATE TABLE IF NOT EXISTS partidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        duracion INTEGER NOT NULL,
        golesRed INTEGER NOT NULL,
        golesBlue INTEGER NOT NULL,
        mapa TEXT NOT NULL,
        mejorJugador TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);
    
    // Tabla de conexiones activas para control de múltiples pestañas
    db.run(`CREATE TABLE IF NOT EXISTS conexiones_activas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_jugador TEXT NOT NULL,
        auth_jugador TEXT,
        ip_simulada TEXT NOT NULL,
        identificador_conexion TEXT UNIQUE NOT NULL,
        fecha_conexion DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_actividad DATETIME DEFAULT CURRENT_TIMESTAMP,
        activa INTEGER DEFAULT 1
    );`);
    
    console.log('✅ Tablas de base de datos creadas/verificadas');
};

// Funciones de base de datos
const dbFunctions = {
    // Guardar/actualizar jugador
    guardarJugador: (nombre, stats) => {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO jugadores 
                          (nombre, partidos, victorias, derrotas, goles, asistencias, autogoles, 
                           mejorRachaGoles, mejorRachaAsistencias, hatTricks, vallasInvictas, 
                           tiempoJugado, promedioGoles, promedioAsistencias, fechaPrimerPartido, 
                           fechaUltimoPartido, xp, nivel, updated_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
            
            db.run(query, [
                nombre, stats.partidos, stats.victorias, stats.derrotas, stats.goles, 
                stats.asistencias, stats.autogoles, stats.mejorRachaGoles, stats.mejorRachaAsistencias, 
                stats.hatTricks, stats.vallasInvictas, stats.tiempoJugado, stats.promedioGoles, 
                stats.promedioAsistencias, stats.fechaPrimerPartido, stats.fechaUltimoPartido, 
                stats.xp, stats.nivel
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    },
    
    // Obtener jugador
    obtenerJugador: (nombre) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM jugadores WHERE nombre = ?', [nombre], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Sistemas de carga y guardado consistentes
    cargarEstadisticasGlobales: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM jugadores', [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Formatear datos para coincidir con la estructura esperada
                const estadisticasFormateadas = {
                    jugadores: {},
                    records: {
                        mayorGoles: {jugador: "", cantidad: 0, fecha: ""},
                        mayorAsistencias: {jugador: "", cantidad: 0, fecha: ""},
                        partidoMasLargo: {duracion: 0, fecha: "", equipos: ""},
                        goleadaMasGrande: {diferencia: 0, resultado: "", fecha: ""},
                        hatTricks: [],
                        vallasInvictas: []
                    },
                    totalPartidos: 0,
                    fechaCreacion: new Date().toISOString(),
                    contadorJugadores: rows ? rows.length : 0
                };
                
                // Convertir filas de la base de datos a la estructura esperada
                if (rows && rows.length > 0) {
                    rows.forEach(row => {
                        estadisticasFormateadas.jugadores[row.nombre] = {
                            nombre: row.nombre,
                            partidos: row.partidos || 0,
                            victorias: row.victorias || 0,
                            derrotas: row.derrotas || 0,
                            goles: row.goles || 0,
                            asistencias: row.asistencias || 0,
                            autogoles: row.autogoles || 0,
                            mejorRachaGoles: row.mejorRachaGoles || 0,
                            mejorRachaAsistencias: row.mejorRachaAsistencias || 0,
                            hatTricks: row.hatTricks || 0,
                            vallasInvictas: row.vallasInvictas || 0,
                            tiempoJugado: row.tiempoJugado || 0,
                            promedioGoles: row.promedioGoles || 0.0,
                            promedioAsistencias: row.promedioAsistencias || 0.0,
                            fechaPrimerPartido: row.fechaPrimerPartido || new Date().toISOString(),
                            fechaUltimoPartido: row.fechaUltimoPartido || new Date().toISOString(),
                            xp: row.xp || 40,
                            nivel: row.nivel || 1
                        };
                    });
                    
                    // Calcular records básicos
                    let maxGoles = 0, maxAsistencias = 0;
                    Object.values(estadisticasFormateadas.jugadores).forEach(jugador => {
                        if (jugador.goles > maxGoles) {
                            maxGoles = jugador.goles;
                            estadisticasFormateadas.records.mayorGoles = {
                                jugador: jugador.nombre,
                                cantidad: jugador.goles,
                                fecha: jugador.fechaUltimoPartido
                            };
                        }
                        if (jugador.asistencias > maxAsistencias) {
                            maxAsistencias = jugador.asistencias;
                            estadisticasFormateadas.records.mayorAsistencias = {
                                jugador: jugador.nombre,
                                cantidad: jugador.asistencias,
                                fecha: jugador.fechaUltimoPartido
                            };
                        }
                        estadisticasFormateadas.totalPartidos += jugador.partidos;
                    });
                }
                
                console.log(`📊 [DB] Cargadas estadísticas de ${Object.keys(estadisticasFormateadas.jugadores).length} jugadores`);
                resolve(estadisticasFormateadas);
            });
        });
    },

    guardarEstadisticasGlobales: (datos) => {
        return new Promise(async (resolve, reject) => {
            try {
                if (!datos || !datos.jugadores) {
                    console.error('❌ [DB] Datos inválidos para guardar estadísticas globales');
                    resolve(false);
                    return;
                }
                
                console.log(`💾 [DB] Guardando estadísticas de ${Object.keys(datos.jugadores).length} jugadores...`);
                
                // Guardar cada jugador individualmente
                const jugadoresGuardados = [];
                for (const [nombre, stats] of Object.entries(datos.jugadores)) {
                    try {
                        await dbFunctions.guardarJugador(nombre, stats);
                        jugadoresGuardados.push(nombre);
                    } catch (error) {
                        console.error(`❌ [DB] Error guardando jugador ${nombre}:`, error);
                    }
                }
                
                console.log(`✅ [DB] ${jugadoresGuardados.length} jugadores guardados exitosamente`);
                
                // TODO: Implementar guardado de records y otras estadísticas globales
                
                resolve(true);
            } catch (error) {
                console.error('❌ [DB] Error en guardarEstadisticasGlobales:', error);
                reject(error);
            }
        });
    },
    
    // Obtener top jugadores
    obtenerTopJugadores: (campo, limite = 10) => {
        return new Promise((resolve, reject) => {
            const validCampos = ['goles', 'asistencias', 'partidos', 'victorias', 'hatTricks', 'vallasInvictas'];
            if (!validCampos.includes(campo)) {
                reject(new Error('Campo inválido'));
                return;
            }
            
            db.all(`SELECT * FROM jugadores WHERE partidos > 0 ORDER BY ${campo} DESC LIMIT ?`, [limite], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    // Guardar partido
    guardarPartido: (partidoData) => {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO partidos (fecha, duracion, golesRed, golesBlue, mapa, mejorJugador)
                          VALUES (?, ?, ?, ?, ?, ?)`;
            
            db.run(query, [
                partidoData.fecha, partidoData.duracion, partidoData.golesRed, 
                partidoData.golesBlue, partidoData.mapa, partidoData.mejorJugador
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    },
    
    // Eliminar cuentas inactivas por 90 días
    eliminarCuentasInactivas: () => {
        return new Promise((resolve, reject) => {
            // Primero contar cuántas cuentas serán eliminadas
            const countQuery = `SELECT COUNT(*) as count FROM jugadores 
                               WHERE DATE('now') > DATE(fechaUltimoPartido, '+90 day')`;
            
            db.get(countQuery, [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const cuentasAEliminar = row.count;
                console.log(`🧹 Se encontraron ${cuentasAEliminar} cuentas inactivas por más de 90 días`);
                
                if (cuentasAEliminar === 0) {
                    resolve({ eliminadas: 0, mensaje: 'No hay cuentas inactivas para eliminar' });
                    return;
                }
                
                // Obtener nombres de las cuentas que serán eliminadas (para log)
                const selectQuery = `SELECT nombre, fechaUltimoPartido FROM jugadores 
                                    WHERE DATE('now') > DATE(fechaUltimoPartido, '+90 day')`;
                
                db.all(selectQuery, [], (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Log de las cuentas que serán eliminadas
                    console.log('📋 Cuentas que serán eliminadas:');
                    rows.forEach(jugador => {
                        const diasInactivo = Math.floor((new Date() - new Date(jugador.fechaUltimoPartido)) / (1000 * 60 * 60 * 24));
                        console.log(`  - ${jugador.nombre} (${diasInactivo} días inactivo)`);
                    });
                    
                    // Proceder con la eliminación
                    const deleteQuery = `DELETE FROM jugadores 
                                        WHERE DATE('now') > DATE(fechaUltimoPartido, '+90 day')`;
                    
                    db.run(deleteQuery, [], function(err) {
                        if (err) {
                            console.error('❌ Error al eliminar cuentas inactivas:', err);
                            reject(err);
                        } else {
                            console.log(`✅ ${this.changes} cuentas inactivas eliminadas exitosamente`);
                            resolve({ 
                                eliminadas: this.changes, 
                                mensaje: `Se eliminaron ${this.changes} cuentas inactivas por más de 90 días`,
                                cuentas: rows.map(r => ({ nombre: r.nombre, fechaUltimoPartido: r.fechaUltimoPartido }))
                            });
                        }
                    });
                });
            });
        });
    },
    
    // ====================== FUNCIONES PARA SISTEMA VIP ======================
    
    // Activar VIP para un jugador
    activarVIP: (nombreJugador) => {
        return new Promise((resolve, reject) => {
            const fechaVIP = new Date().toISOString();
            const query = `UPDATE jugadores SET esVIP = 1, fechaVIP = ? WHERE nombre = ?`;
            
            db.run(query, [fechaVIP, nombreJugador], function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error('Jugador no encontrado'));
                } else {
                    console.log(`✅ VIP activado para ${nombreJugador} en ${fechaVIP}`);
                    resolve({ nombreJugador, fechaVIP, cambios: this.changes });
                }
            });
        });
    },
    
    // Desactivar VIP para un jugador
    desactivarVIP: (nombreJugador) => {
        return new Promise((resolve, reject) => {
            const query = `UPDATE jugadores SET esVIP = 0, fechaVIP = NULL WHERE nombre = ?`;
            
            db.run(query, [nombreJugador], function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error('Jugador no encontrado'));
                } else {
                    console.log(`❌ VIP desactivado para ${nombreJugador}`);
                    resolve({ nombreJugador, cambios: this.changes });
                }
            });
        });
    },
    
    // Verificar si un jugador es VIP
    esJugadorVIP: (nombreJugador) => {
        return new Promise((resolve, reject) => {
            const query = `SELECT esVIP, fechaVIP FROM jugadores WHERE nombre = ?`;
            
            db.get(query, [nombreJugador], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve({ esVIP: false, fechaVIP: null });
                } else {
                    const esVIP = row.esVIP === 1;
                    const fechaVIP = row.fechaVIP;
                    
                    // Si es VIP, verificar que no haya expirado (30 días)
                    if (esVIP && fechaVIP) {
                        const fechaOtorgamiento = new Date(fechaVIP);
                        const fechaExpiracion = new Date(fechaOtorgamiento.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 días
                        const ahora = new Date();
                        
                        if (ahora > fechaExpiracion) {
                            // VIP expirado - desactivar automáticamente
                            dbFunctions.desactivarVIP(nombreJugador).then(() => {
                                resolve({ esVIP: false, fechaVIP: null, expirado: true });
                            }).catch((error) => {
                                console.error(`Error al desactivar VIP expirado para ${nombreJugador}:`, error);
                                resolve({ esVIP: false, fechaVIP: null, expirado: true });
                            });
                        } else {
                            resolve({ esVIP: true, fechaVIP: fechaVIP, diasRestantes: Math.ceil((fechaExpiracion - ahora) / (24 * 60 * 60 * 1000)) });
                        }
                    } else {
                        resolve({ esVIP: false, fechaVIP: null });
                    }
                }
            });
        });
    },
    
    // Obtener lista de jugadores VIP activos
    obtenerJugadoresVIP: () => {
        return new Promise((resolve, reject) => {
            const query = `SELECT nombre, fechaVIP FROM jugadores WHERE esVIP = 1 ORDER BY fechaVIP DESC`;
            
            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const jugadoresVIP = rows.map(row => {
                        const fechaOtorgamiento = new Date(row.fechaVIP);
                        const fechaExpiracion = new Date(fechaOtorgamiento.getTime() + (30 * 24 * 60 * 60 * 1000));
                        const ahora = new Date();
                        const diasRestantes = Math.ceil((fechaExpiracion - ahora) / (24 * 60 * 60 * 1000));
                        
                        return {
                            nombre: row.nombre,
                            fechaVIP: row.fechaVIP,
                            diasRestantes: diasRestantes,
                            expirado: diasRestantes <= 0
                        };
                    });
                    
                    resolve(jugadoresVIP);
                }
            });
        });
    },
    
    // Limpiar VIPs expirados automáticamente
    limpiarVIPsExpirados: () => {
        return new Promise((resolve, reject) => {
            // Primero obtener los VIPs que van a expirar
            const selectQuery = `SELECT nombre, fechaVIP FROM jugadores 
                                WHERE esVIP = 1 
                                AND DATE('now') > DATE(fechaVIP, '+30 day')`;
            
            db.all(selectQuery, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (rows.length === 0) {
                    resolve({ vipsExpirados: 0, jugadores: [] });
                    return;
                }
                
                // Desactivar VIPs expirados
                const updateQuery = `UPDATE jugadores 
                                    SET esVIP = 0, fechaVIP = NULL 
                                    WHERE esVIP = 1 
                                    AND DATE('now') > DATE(fechaVIP, '+30 day')`;
                
                db.run(updateQuery, [], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`🧹 ${this.changes} VIPs expirados limpiados automáticamente`);
                        resolve({ 
                            vipsExpirados: this.changes, 
                            jugadores: rows.map(r => ({
                                nombre: r.nombre,
                                fechaVIP: r.fechaVIP,
                                diasVencido: Math.floor((new Date() - new Date(r.fechaVIP)) / (1000 * 60 * 60 * 24)) - 30
                            }))
                        });
                    }
                });
            });
        });
    },
    
    // ====================== FUNCIONES PARA CONTROL DE CONEXIONES MÚLTIPLES ======================
    
    // Registrar nueva conexión
    registrarConexion: (nombreJugador, authJugador, ipSimulada, identificadorConexion) => {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO conexiones_activas 
                          (nombre_jugador, auth_jugador, ip_simulada, identificador_conexion)
                          VALUES (?, ?, ?, ?)`;
            
            db.run(query, [nombreJugador, authJugador, ipSimulada, identificadorConexion], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🔗 Nueva conexión registrada: ${nombreJugador} (${ipSimulada})`);
                    resolve(this.lastID);
                }
            });
        });
    },
    
    // Verificar si un jugador ya tiene conexiones activas
    verificarConexionesExistentes: (nombreJugador, authJugador = null) => {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM conexiones_activas 
                        WHERE activa = 1 AND (nombre_jugador = ?`;
            let params = [nombreJugador];
            
            // Si tenemos auth, también verificar por auth
            if (authJugador) {
                query += ` OR auth_jugador = ?`;
                params.push(authJugador);
            }
            
            query += `)`;
            
            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const conexionesActivas = rows.length;
                    const tieneConexionesMultiples = conexionesActivas > 0;
                    
                    console.log(`🔍 Verificación de conexiones para ${nombreJugador}: ${conexionesActivas} activas`);
                    
                    resolve({
                        tieneConexionesMultiples,
                        conexionesActivas,
                        detalles: rows
                    });
                }
            });
        });
    },
    
    // Desactivar conexión específica
    desactivarConexion: (identificadorConexion) => {
        return new Promise((resolve, reject) => {
            const query = `UPDATE conexiones_activas 
                          SET activa = 0, ultima_actividad = CURRENT_TIMESTAMP 
                          WHERE identificador_conexion = ?`;
            
            db.run(query, [identificadorConexion], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`❌ Conexión desactivada: ${identificadorConexion}`);
                    resolve(this.changes);
                }
            });
        });
    },
    
    // Desactivar todas las conexiones de un jugador
    desactivarConexionesJugador: (nombreJugador, authJugador = null) => {
        return new Promise((resolve, reject) => {
            let query = `UPDATE conexiones_activas 
                        SET activa = 0, ultima_actividad = CURRENT_TIMESTAMP 
                        WHERE activa = 1 AND (nombre_jugador = ?`;
            let params = [nombreJugador];
            
            if (authJugador) {
                query += ` OR auth_jugador = ?`;
                params.push(authJugador);
            }
            
            query += `)`;
            
            db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🚫 ${this.changes} conexiones desactivadas para ${nombreJugador}`);
                    resolve(this.changes);
                }
            });
        });
    },
    
    // Actualizar última actividad de una conexión
    actualizarActividadConexion: (identificadorConexion) => {
        return new Promise((resolve, reject) => {
            const query = `UPDATE conexiones_activas 
                          SET ultima_actividad = CURRENT_TIMESTAMP 
                          WHERE identificador_conexion = ? AND activa = 1`;
            
            db.run(query, [identificadorConexion], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },
    
    // Limpiar conexiones inactivas (más de 10 minutos sin actividad)
    limpiarConexionesInactivas: () => {
        return new Promise((resolve, reject) => {
            const query = `UPDATE conexiones_activas 
                          SET activa = 0 
                          WHERE activa = 1 
                          AND datetime('now') > datetime(ultima_actividad, '+10 minutes')`;
            
            db.run(query, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        console.log(`🧹 ${this.changes} conexiones inactivas limpiadas`);
                    }
                    resolve(this.changes);
                }
            });
        });
    },
    
    // Obtener estadísticas de conexiones
    obtenerEstadisticasConexiones: () => {
        return new Promise((resolve, reject) => {
            const queries = {
                totalActivas: 'SELECT COUNT(*) as count FROM conexiones_activas WHERE activa = 1',
                totalHistoricas: 'SELECT COUNT(*) as count FROM conexiones_activas',
                jugadoresConMultiples: `SELECT nombre_jugador, COUNT(*) as conexiones 
                                       FROM conexiones_activas 
                                       WHERE activa = 1 
                                       GROUP BY nombre_jugador 
                                       HAVING COUNT(*) > 1`,
                topIPs: `SELECT ip_simulada, COUNT(*) as conexiones 
                        FROM conexiones_activas 
                        WHERE activa = 1 
                        GROUP BY ip_simulada 
                        ORDER BY COUNT(*) DESC 
                        LIMIT 10`
            };
            
            const resultados = {};
            let completadas = 0;
            const totalQueries = Object.keys(queries).length;
            
            Object.entries(queries).forEach(([key, query]) => {
                if (key === 'jugadoresConMultiples' || key === 'topIPs') {
                    db.all(query, [], (err, rows) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resultados[key] = rows;
                        completadas++;
                        if (completadas === totalQueries) {
                            resolve(resultados);
                        }
                    });
                } else {
                    db.get(query, [], (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resultados[key] = row.count;
                        completadas++;
                        if (completadas === totalQueries) {
                            resolve(resultados);
                        }
                    });
                }
            });
        });
    },
    
    // Obtener estadísticas de cuentas inactivas (para monitoreo)
    obtenerEstadisticasInactividad: () => {
        return new Promise((resolve, reject) => {
            const queries = {
                total: 'SELECT COUNT(*) as count FROM jugadores',
                inactivas30: `SELECT COUNT(*) as count FROM jugadores WHERE DATE('now') > DATE(fechaUltimoPartido, '+30 day')`,
                inactivas60: `SELECT COUNT(*) as count FROM jugadores WHERE DATE('now') > DATE(fechaUltimoPartido, '+60 day')`,
                inactivas90: `SELECT COUNT(*) as count FROM jugadores WHERE DATE('now') > DATE(fechaUltimoPartido, '+90 day')`,
                proximasEliminar: `SELECT nombre, fechaUltimoPartido FROM jugadores 
                                  WHERE DATE('now') > DATE(fechaUltimoPartido, '+80 day') 
                                  AND DATE('now') <= DATE(fechaUltimoPartido, '+90 day')
                                  ORDER BY fechaUltimoPartido ASC`
            };
            
            const resultados = {};
            let completadas = 0;
            const totalQueries = Object.keys(queries).length;
            
            Object.entries(queries).forEach(([key, query]) => {
                if (key === 'proximasEliminar') {
                    db.all(query, [], (err, rows) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resultados[key] = rows;
                        completadas++;
                        if (completadas === totalQueries) {
                            resolve(resultados);
                        }
                    });
                } else {
                    db.get(query, [], (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resultados[key] = row.count;
                        completadas++;
                        if (completadas === totalQueries) {
                            resolve(resultados);
                        }
                    });
                }
            });
        });
    }
};

// Configuración del bot (igual que el original)
const roomConfig = {
    roomName: "⚡🔵 LNB JUEGAN TODOS X7 🔵⚡",
    playerName: "",
    password: null,
    maxPlayers: 23,
    public: true,  // Cambiar a true para que la sala sea pública
    token: "thr1.AAAAAGiOc74dyGgONYNKRg.jpkAUqRrfFw",
    geo: { code: 'AR', lat: -34.6118, lon: -58.3960 },
    noPlayer: true
};

// Webhooks (mantener los originales)
const webhooks = {
    discord: "https://discord.com/api/webhooks/1389450191396143265/JxHRCmfNCFooAr3YjynXPmihlVSjnGw-FLql4VUHNUx15Yl8d8BipjaRd51uXpcXfiXv",
    banKick: "https://discord.com/api/webhooks/1392211274888122529/c8c1N6c4pWCIL9WyO3GLOPafo_lcbl3ae1E6CoZc-hzVc54_za4yqdNg3wRLGFuTyDPm",
    llamarAdmin: "https://discord.com/api/webhooks/1389648292987666662/0fn4qY2ITwfTzKvPt19fC3MPUjXuxGZvJUZHLSVZ9l3lFQe2s2vt-crhx7DOT6ogx8aF",
    reportesSala: "https://discord.com/api/webhooks/1390368471577133187/-QKunqo71mOgK_op4dZxP4lK3HVA7Utqs9bFP5dRyyexKUdOUCSV573sz1eZvirS8JUA"
};

// Función principal
(async () => {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('🚀 INICIANDO BOT LNB - VERSIÓN PUPPETEER');
        console.log('📅 Fecha/Hora:', new Date().toLocaleString());
        console.log('📂 Directorio de trabajo:', process.cwd());
        console.log('='.repeat(80) + '\n');
        
        // Crear tablas de base de datos
        crearTablas();
        
        // Lanzar Puppeteer
        const browser = await puppeteer.launch({ 
            headless: 'new', 
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        
        const page = await browser.newPage();
        
        // Configurar página
        await page.setViewport({ width: 1280, height: 720 });
        
        // Exponer funciones de Node.js al contexto del navegador
        await page.exposeFunction('nodeGuardarJugador', dbFunctions.guardarJugador);
        await page.exposeFunction('nodeObtenerJugador', dbFunctions.obtenerJugador);
        await page.exposeFunction('nodeObtenerTopJugadores', dbFunctions.obtenerTopJugadores);
        await page.exposeFunction('nodeGuardarPartido', dbFunctions.guardarPartido);
        
        // Exponer funciones de limpieza de cuentas inactivas
        await page.exposeFunction('nodeEliminarCuentasInactivas', dbFunctions.eliminarCuentasInactivas);
        await page.exposeFunction('nodeObtenerEstadisticasInactividad', dbFunctions.obtenerEstadisticasInactividad);
        
        // Exponer funciones VIP
        await page.exposeFunction('nodeActivarVIP', dbFunctions.activarVIP);
        await page.exposeFunction('nodeDesactivarVIP', dbFunctions.desactivarVIP);
        await page.exposeFunction('nodeEsJugadorVIP', dbFunctions.esJugadorVIP);
        await page.exposeFunction('nodeObtenerJugadoresVIP', dbFunctions.obtenerJugadoresVIP);
        await page.exposeFunction('nodeLimpiarVIPsExpirados', dbFunctions.limpiarVIPsExpirados);
        
        // Exponer funciones de control de conexiones múltiples
        await page.exposeFunction('nodeRegistrarConexion', dbFunctions.registrarConexion);
        await page.exposeFunction('nodeVerificarConexionesExistentes', dbFunctions.verificarConexionesExistentes);
        await page.exposeFunction('nodeDesactivarConexion', dbFunctions.desactivarConexion);
        await page.exposeFunction('nodeDesactivarConexionesJugador', dbFunctions.desactivarConexionesJugador);
        await page.exposeFunction('nodeActualizarActividadConexion', dbFunctions.actualizarActividadConexion);
        await page.exposeFunction('nodeLimpiarConexionesInactivas', dbFunctions.limpiarConexionesInactivas);
        await page.exposeFunction('nodeObtenerEstadisticasConexiones', dbFunctions.obtenerEstadisticasConexiones);

        // Integrar sistemas compartidos
        await page.exposeFunction('cargarEstadisticasGlobales', dbFunctions.cargarEstadisticasGlobales);
        await page.exposeFunction('guardarEstadisticasGlobales', dbFunctions.guardarEstadisticasGlobales);

        await page.exposeFunction('nodeEnviarWebhook', async (webhookUrl, payload) => {
            try {
                console.log('📤 DEBUG: Enviando webhook a:', webhookUrl);
                console.log('📦 DEBUG: Payload:', JSON.stringify(payload, null, 2));
                
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                console.log('📡 DEBUG: Respuesta status:', response.status);
                console.log('📡 DEBUG: Respuesta headers:', Object.fromEntries(response.headers.entries()));
                
                if (response.ok) {
                    const responseText = await response.text();
                    console.log('📋 DEBUG: Respuesta texto:', responseText);
                    
                    // Verificar si la respuesta está vacía o no es JSON válido
                    if (!responseText || responseText.trim() === '') {
                        console.log('✅ DEBUG: Webhook enviado exitosamente (respuesta vacía)');
                        return {
                            success: true,
                            messageId: null,
                            data: null
                        };
                    }
                    
                    try {
                        const data = JSON.parse(responseText);
                        console.log('✅ DEBUG: Webhook enviado exitosamente con datos:', data);
                        return {
                            success: true,
                            messageId: data.id || null,
                            data: data
                        };
                    } catch (jsonError) {
                        console.error('❌ DEBUG: Error parseando JSON:', jsonError);
                        console.log('📋 DEBUG: Respuesta que causó error:', responseText);
                        // Aún consideramos exitoso si el status es OK
                        return {
                            success: true,
                            messageId: null,
                            data: null
                        };
                    }
                } else {
                    const errorText = await response.text();
                    console.error('❌ DEBUG: Error en webhook - Status:', response.status, 'Body:', errorText);
                    return { success: false, status: response.status, error: errorText };
                }
            } catch (error) {
                console.error('❌ Error enviando webhook:', error);
                return { success: false, error: error.message };
            }
        });
        
        // Nueva función para editar mensajes de Discord
        await page.exposeFunction('nodeEditarMensajeDiscord', async (webhookUrl, messageId, payload) => {
            try {
                const editUrl = `${webhookUrl}/messages/${messageId}`;
                const response = await fetch(editUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        messageId: data.id,
                        data: data
                    };
                }
                return { success: false, status: response.status };
            } catch (error) {
                console.error('Error editando mensaje Discord:', error);
                return { success: false, error: error.message };
            }
        });
        
        // Navegar a Haxball headless
        await page.goto('https://www.haxball.com/headless', { waitUntil: 'networkidle0' });
        
        // Esperar a que HBInit esté disponible
        await page.waitForFunction('typeof HBInit !== "undefined"', { timeout: 30000 });
        
        // IMPORTANTE: Configurar capturador de logs ANTES de inyectar el código
        // Capturar TODOS los mensajes de consola del navegador
        page.on('console', async (msg) => {
            const text = msg.text();
            const type = msg.type();
            
            // Mostrar TODOS los console.log del navegador
            if (type === 'log') {
                console.log(`[BROWSER LOG] ${text}`);
            }
            
            // Capturar mensajes de advertencia también
            if (type === 'warning') {
                console.warn(`[BROWSER WARN] ${text}`);
            }
            
            // Capturar mensajes de error también
            if (type === 'error') {
                console.error(`[BROWSER ERROR] ${text}`);
            }
            
            // Capturar mensajes de info también
            if (type === 'info') {
                console.info(`[BROWSER INFO] ${text}`);
            }
            
            // Capturar específicamente el enlace de la sala con más patrones
            if (text.includes('🔗') || 
                text.includes('ENLACE DE LA SALA') || 
                text.includes('https://www.haxball.com/play?c=') ||
                text.includes('enlaceRealSala') ||
                text.match(/https:\/\/www\.haxball\.com\/play\?c=[a-zA-Z0-9]+/)) {
                
                console.log(`🔗 [ENLACE DETECTADO] ${text}`);
                
                // Extraer el enlace si está en el texto
                const linkMatch = text.match(/https:\/\/www\.haxball\.com\/play\?c=[a-zA-Z0-9]+/);
                if (linkMatch) {
                    console.log(`🎯 [ENLACE EXTRAÍDO] ${linkMatch[0]}`);
                }
            }
        });
        
        // Leer el código completo del bot desde el archivo separado
        const botCompleto = fs.readFileSync(path.join(__dirname, 'message (4).js'), 'utf8');
        
        
        // Inyectar el código completo del bot con manejo de errores
        try {
            await page.evaluate((codigo) => {
                console.log('🔧 DEBUG: Iniciando evaluación del código del bot...');
                
                try {
                    // Declarar variables globales antes de evaluar el código
                    window.estadisticasGlobales = {};
                    window.enlaceRealSala = "https://www.haxball.com/play?c=abcd1234";
                    window.enlaceRealConfirmado = false;
                    
                    // Evaluar el código
                    eval(codigo);
                    
                    console.log('✅ DEBUG: Código evaluado correctamente');
                    
                    // Verificar disponibilidad de HBInit
                    if (typeof HBInit === 'undefined') {
                        console.error('❌ CRITICAL: HBInit no está disponible en el contexto del navegador');
                        return;
                    }
                    
                    console.log('✅ DEBUG: HBInit está disponible');
                    
                    // El bot se inicializa automáticamente en message (4).js
                    // No necesitamos llamar manualmente a inicializar() para evitar doble inicialización
                    console.log('🔧 DEBUG: Inicialización automática en progreso...');
                    
                    // Esperar a que el bot se inicialice automáticamente
                    setTimeout(() => {
                        if (typeof room !== 'undefined' && room) {
                            console.log('✅ DEBUG: Bot inicializado automáticamente');
                        } else {
                            console.log('⚠️ DEBUG: Bot no inicializado después del timeout');
                        }
                    }, 2000);
                    
                    // Verificar que las funciones principales del bot estén disponibles
                    if (typeof room !== 'undefined' && room) {
                        console.log('✅ DEBUG: Objeto room creado correctamente');
                        
                        // Configurar onRoomLink manualmente si no está definido
                        if (typeof room.onRoomLink === 'undefined') {
                            console.log('🔧 DEBUG: Configurando onRoomLink manualmente...');
                            room.onRoomLink = function(url) {
                                console.log('🔗 ¡¡¡Enlace de la sala recibido: ' + url);
                                if (typeof enlaceRealSala !== 'undefined') {
                                    enlaceRealSala = url;
                                    window.enlaceRealSala = url;
                                }
                            };
                        }
                        
                        // Verificar si el room tiene método para obtener enlace
                        if (typeof room.getLink === 'function') {
                            try {
                                const linkActual = room.getLink();
                                if (linkActual && linkActual !== 'https://www.haxball.com/play?c=abcd1234') {
                                    console.log('🔗 DEBUG: Enlace obtenido con getLink():', linkActual);
                                    enlaceRealSala = linkActual;
                                    window.enlaceRealSala = linkActual;
                                }
                            } catch (e) {
                                console.log('⚠️ No se pudo obtener enlace con getLink():', e.message);
                            }
                        }
                    } else {
                        console.error('❌ DEBUG: Objeto room no fue creado correctamente');
                    }
                    
                    // Verificar variables del bot
                    if (typeof enlaceRealSala !== 'undefined') {
                        console.log('✅ DEBUG: enlaceRealSala disponible:', enlaceRealSala);
                    }
                    
                    console.log('🎯 DEBUG: Inicialización completada');
                    
                } catch (evalError) {
                    console.error('❌ DEBUG: Error al evaluar código del bot:', evalError.message);
                    console.error('📍 DEBUG: Stack trace:', evalError.stack);
                    throw evalError;
                }
            }, botCompleto);
        } catch (error) {
            console.error('❌ ERROR AL EJECUTAR CÓDIGO DEL BOT:', error);
            throw error;
        }
        
        // Función adicional para obtener el enlace directamente después de unos segundos
        setTimeout(async () => {
            try {
                
                // Ejecutar código en el navegador para obtener el enlace
                const enlace = await page.evaluate(() => {
                    // Intentar obtener el enlace desde las variables globales del bot
                    if (typeof enlaceRealSala !== 'undefined' && enlaceRealSala && enlaceRealSala !== 'https://www.haxball.com/play?c=abcd1234') {
                        return enlaceRealSala;
                    }
                    
                    // Intentar obtener desde room si está disponible
                    if (typeof room !== 'undefined' && room && room.getPlayerList) {
                        try {
                            // El enlace debería estar disponible en este punto
                            console.log('👥 DEBUG: Jugadores en sala:', jugadores.length);
                            return 'SALA_ACTIVA_SIN_ENLACE_DISPONIBLE';
                        } catch (e) {
                            console.log('❌ DEBUG: Error al verificar sala:', e.message);
                            return 'ERROR_VERIFICANDO_SALA';
                        }
                    }
                    
                    return null;
                });
                
                if (enlace && enlace.startsWith('https://www.haxball.com/play?c=')) {
                } else if (enlace === 'SALA_ACTIVA_SIN_ENLACE_DISPONIBLE') {
                } else {
                }
                
            } catch (error) {
                console.error('❌ Error al intentar obtener el enlace:', error.message);
            }
        }, 10000); // Esperar 10 segundos
        
        // Capturar eventos adicionales para debugging
        page.on('response', response => {
            if (!response.ok()) {
                console.warn(`⚠️ [HTTP] Respuesta no exitosa: ${response.status()} ${response.url()}`);
            }
        });
        
        page.on('requestfailed', request => {
            console.error(`❌ [REQUEST FAILED] ${request.url()}: ${request.failure().errorText}`);
        });
        
        // Manejo de errores de página
        page.on('error', (error) => {
            console.error('❌ Error en la página:', error);
        });
        
        page.on('pageerror', (error) => {
            console.error('❌ Error de JavaScript en la página:', error);
        });
        
        // Capturar logs de WebSocket/Network (para debugging)
        page.on('framenavigated', frame => {
            if (frame === page.mainFrame()) {
            }
        });
        
        // Log adicional para confirmar que el listener está funcionando
        
        // ====================== SISTEMA DE LIMPIEZA AUTOMÁTICA ======================
        // Función para ejecutar la limpieza de cuentas inactivas
        const ejecutarLimpiezaAutomatica = async () => {
            try {
                console.log('🧹 Iniciando limpieza automática de cuentas inactivas...');
                
                // Obtener estadísticas antes de la limpieza
                const estadisticas = await dbFunctions.obtenerEstadisticasInactividad();
                console.log(`📊 Estadísticas de inactividad:`);
                console.log(`   - Total de jugadores: ${estadisticas.total}`);
                console.log(`   - Inactivos +30 días: ${estadisticas.inactivas30}`);
                console.log(`   - Inactivos +60 días: ${estadisticas.inactivas60}`);
                console.log(`   - Inactivos +90 días: ${estadisticas.inactivas90}`);
                console.log(`   - Próximos a eliminar (80-90 días): ${estadisticas.proximasEliminar.length}`);
                
                // Ejecutar la limpieza
                const resultado = await dbFunctions.eliminarCuentasInactivas();
                
                // Enviar notificación a Discord si se eliminaron cuentas
                if (resultado.eliminadas > 0) {
                    const payload = {
                        content: `🧹 **Limpieza Automática de Cuentas Inactivas**\n\n` +
                                `✅ Se eliminaron **${resultado.eliminadas}** cuentas inactivas por más de 90 días.\n\n` +
                                `📋 **Cuentas eliminadas:**\n` +
                                resultado.cuentas.map(c => {
                                    const diasInactivo = Math.floor((new Date() - new Date(c.fechaUltimoPartido)) / (1000 * 60 * 60 * 24));
                                    return `• ${c.nombre} (${diasInactivo} días inactivo)`;
                                }).join('\n') +
                                `\n\n📊 **Estadísticas actuales:**\n` +
                                `• Total de jugadores restantes: ${estadisticas.total - resultado.eliminadas}\n` +
                                `• Próximos a eliminar: ${estadisticas.proximasEliminar.length}`,
                        username: "LNB Bot - Sistema de Limpieza",
                        avatar_url: "https://cdn.discordapp.com/emojis/🧹.png"
                    };
                    
                    try {
                        const response = await fetch(webhooks.discord, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        if (response.ok) {
                            console.log('✅ Notificación de limpieza enviada a Discord');
                        } else {
                            console.warn('⚠️ Error al enviar notificación a Discord:', response.status);
                        }
                    } catch (discordError) {
                        console.error('❌ Error enviando notificación a Discord:', discordError);
                    }
                } else {
                    console.log('ℹ️ No se encontraron cuentas inactivas para eliminar');
                }
                
            } catch (error) {
                console.error('❌ Error en limpieza automática:', error);
            }
        };
        
        // Ejecutar limpieza inicial después de 5 minutos de iniciado el bot
        setTimeout(() => {
            console.log('🔄 Ejecutando limpieza inicial...');
            ejecutarLimpiezaAutomatica();
        }, 5 * 60 * 1000); // 5 minutos
        
        // Programar limpieza automática cada 24 horas
        setInterval(() => {
            console.log('🔄 Ejecutando limpieza automática programada...');
            ejecutarLimpiezaAutomatica();
        }, 24 * 60 * 60 * 1000); // 24 horas
        
        // Exponer función de limpieza manual al contexto del navegador
        await page.exposeFunction('nodeLimpiezaManual', ejecutarLimpiezaAutomatica);
        
        // ====================== SISTEMA DE LIMPIEZA DE CONEXIONES ======================
        // Función para ejecutar la limpieza de conexiones inactivas
        const ejecutarLimpiezaConexiones = async () => {
            try {
                // Limpiar conexiones inactivas (más de 10 minutos sin actividad)
                const conexionesLimpiadas = await dbFunctions.limpiarConexionesInactivas();
                
                if (conexionesLimpiadas > 0) {
                    console.log(`🧹 ${conexionesLimpiadas} conexiones inactivas limpiadas automáticamente`);
                }
            } catch (error) {
                console.error('❌ Error en limpieza automática de conexiones:', error);
            }
        };
        
        // Programar limpieza de conexiones cada 5 minutos
        setInterval(() => {
            ejecutarLimpiezaConexiones();
        }, 5 * 60 * 1000); // 5 minutos
        
        console.log('✅ Sistema de limpieza automática configurado');
        console.log('   - Limpieza inicial: 5 minutos después del inicio');
        console.log('   - Limpieza automática: cada 24 horas');
        console.log('   - Limpieza de conexiones: cada 5 minutos');
        console.log('   - Comando manual disponible en el bot');
        
        // Mantener el proceso vivo
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('🛑 Cerrando bot y base de datos...');
            await browser.close();
            db.close();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error iniciando el bot:', error);
        process.exit(1);
    }
})();
