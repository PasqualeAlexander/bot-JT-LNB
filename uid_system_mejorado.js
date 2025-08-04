/**
 * SISTEMA HÍBRIDO DE UID MEJORADO
 * Combina la persistencia de BD con la robustez del sistema actual
 */

const crypto = require('crypto');

class UIDSystemMejorado {
    constructor(db) {
        this.db = db;
        this.uidCache = new Map(); // Cache en memoria para rendimiento
        this.initDB();
    }

    // Inicializar tabla de UIDs persistente
    initDB() {
        this.db.run(`CREATE TABLE IF NOT EXISTS uids_persistentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT UNIQUE NOT NULL,
            nombre TEXT,
            ip TEXT,
            auth_haxball TEXT,
            conn_haxball TEXT,
            primera_conexion TEXT DEFAULT CURRENT_TIMESTAMP,
            ultima_conexion TEXT DEFAULT CURRENT_TIMESTAMP,
            veces_conectado INTEGER DEFAULT 1,
            activo INTEGER DEFAULT 1
        )`);
    }

    // Función principal: obtener UID persistente
    async obtenerUID(jugador) {
        try {
            console.log(`🔍 Obteniendo UID para ${jugador.name}...`);

            // 1. PRIORIDAD MÁXIMA: auth nativo de Haxball (más confiable)
            if (jugador.auth && jugador.auth.length > 8) {
                const uidExistente = await this.buscarPorAuth(jugador.auth);
                if (uidExistente) {
                    await this.actualizarUltimaConexion(uidExistente.uid, jugador);
                    console.log(`✅ UID encontrado por auth: ${uidExistente.uid}`);
                    return uidExistente.uid;
                } else {
                    // Crear nuevo registro con auth
                    const nuevoUID = await this.crearNuevoUID(jugador, 'auth');
                    console.log(`✅ Nuevo UID creado con auth: ${nuevoUID}`);
                    return nuevoUID;
                }
            }

            // 2. PRIORIDAD ALTA: conn de Haxball 
            if (jugador.conn && jugador.conn.length > 8) {
                const uidExistente = await this.buscarPorConn(jugador.conn);
                if (uidExistente) {
                    await this.actualizarUltimaConexion(uidExistente.uid, jugador);
                    console.log(`✅ UID encontrado por conn: ${uidExistente.uid}`);
                    return uidExistente.uid;
                } else {
                    const nuevoUID = await this.crearNuevoUID(jugador, 'conn');
                    console.log(`✅ Nuevo UID creado con conn: ${nuevoUID}`);
                    return nuevoUID;
                }
            }

            // 3. PRIORIDAD MEDIA: Buscar por IP + nombre (jugadores regulares)
            const ip = this.obtenerIP(jugador);
            if (ip) {
                const uidExistente = await this.buscarPorIPYNombre(ip, jugador.name);
                if (uidExistente) {
                    await this.actualizarUltimaConexion(uidExistente.uid, jugador);
                    console.log(`✅ UID encontrado por IP+nombre: ${uidExistente.uid}`);
                    return uidExistente.uid;
                }

                // Buscar solo por IP (mismo jugador, nombre diferente)
                const uidPorIP = await this.buscarPorIP(ip);
                if (uidPorIP) {
                    // Actualizar nombre si es diferente
                    await this.actualizarNombre(uidPorIP.uid, jugador.name);
                    await this.actualizarUltimaConexion(uidPorIP.uid, jugador);
                    console.log(`✅ UID encontrado por IP (nombre actualizado): ${uidPorIP.uid}`);
                    return uidPorIP.uid;
                }
            }

            // 4. ÚLTIMO RECURSO: Crear UID completamente nuevo
            const nuevoUID = await this.crearNuevoUID(jugador, 'generado');
            console.log(`✅ Nuevo UID generado: ${nuevoUID}`);
            return nuevoUID;

        } catch (error) {
            console.error('❌ Error obteniendo UID:', error);
            // Fallback de emergencia
            return this.generarUIDEmergencia(jugador);
        }
    }

    // Buscar por auth de Haxball
    buscarPorAuth(auth) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM uids_persistentes WHERE auth_haxball = ? AND activo = 1", 
                [auth], 
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Buscar por conn de Haxball
    buscarPorConn(conn) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM uids_persistentes WHERE conn_haxball = ? AND activo = 1", 
                [conn], 
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Buscar por IP y nombre
    buscarPorIPYNombre(ip, nombre) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM uids_persistentes WHERE ip = ? AND nombre = ? AND activo = 1", 
                [ip, nombre], 
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Buscar solo por IP
    buscarPorIP(ip) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM uids_persistentes WHERE ip = ? AND activo = 1 ORDER BY ultima_conexion DESC LIMIT 1", 
                [ip], 
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Crear nuevo UID
    async crearNuevoUID(jugador, metodo) {
        const uid = this.generarUIDSeguro();
        const ip = this.obtenerIP(jugador);
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO uids_persistentes 
                (uid, nombre, ip, auth_haxball, conn_haxball, primera_conexion, ultima_conexion) 
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [uid, jugador.name, ip, jugador.auth || null, jugador.conn || null],
                function(err) {
                    if (err) {
                        console.error('❌ Error creando UID:', err);
                        // Si hay error de duplicado, generar otro UID
                        if (err.message.includes('UNIQUE')) {
                            const nuevoUID = this.generarUIDSeguro();
                            resolve(nuevoUID);
                        } else {
                            reject(err);
                        }
                    } else {
                        console.log(`✅ UID creado exitosamente por ${metodo}: ${uid}`);
                        resolve(uid);
                    }
                }
            );
        });
    }

    // Actualizar última conexión
    actualizarUltimaConexion(uid, jugador) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE uids_persistentes 
                SET ultima_conexion = CURRENT_TIMESTAMP, 
                    veces_conectado = veces_conectado + 1,
                    auth_haxball = COALESCE(?, auth_haxball),
                    conn_haxball = COALESCE(?, conn_haxball)
                WHERE uid = ?`,
                [jugador.auth, jugador.conn, uid],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Actualizar nombre
    actualizarNombre(uid, nuevoNombre) {
        return new Promise((resolve, reject) => {
            this.db.run(
                "UPDATE uids_persistentes SET nombre = ? WHERE uid = ?",
                [nuevoNombre, uid],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Generar UID seguro
    generarUIDSeguro() {
        // Usar crypto para mayor seguridad
        const buffer = crypto.randomBytes(8);
        return buffer.toString('hex');
    }

    // Obtener IP del jugador (función auxiliar)
    obtenerIP(jugador) {
        // Esta función debe adaptarse según cómo obtienes la IP en tu bot
        return jugador.ip || jugador.conn || null;
    }

    // UID de emergencia (fallback final)
    generarUIDEmergencia(jugador) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `emergency_${jugador.id}_${timestamp}_${random}`;
    }

    // Obtener estadísticas del sistema UID
    async obtenerEstadisticas() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    COUNT(*) as total_uids,
                    COUNT(CASE WHEN auth_haxball IS NOT NULL THEN 1 END) as con_auth,
                    COUNT(CASE WHEN conn_haxball IS NOT NULL THEN 1 END) as con_conn,
                    COUNT(CASE WHEN ip IS NOT NULL THEN 1 END) as con_ip,
                    AVG(veces_conectado) as promedio_conexiones
                FROM uids_persistentes 
                WHERE activo = 1
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row[0]);
            });
        });
    }

    // Limpiar UIDs inactivos (ejecutar periódicamente)
    async limpiarUIDsInactivos(diasInactividad = 30) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE uids_persistentes 
                SET activo = 0 
                WHERE datetime(ultima_conexion) < datetime('now', '-${diasInactividad} days')`,
                [],
                function(err) {
                    if (err) reject(err);
                    else {
                        console.log(`🧹 UIDs inactivos limpiados: ${this.changes}`);
                        resolve(this.changes);
                    }
                }
            );
        });
    }
}

module.exports = UIDSystemMejorado;
