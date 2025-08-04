const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración del archivo de base de datos
const dbPath = path.join(process.cwd(), 'lnb_estadisticas.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Iniciando migración del sistema de UID...\n');

// Paso 1: Crear tabla uids_persistentes
function crearTablaUIDs() {
    return new Promise((resolve, reject) => {
        const createTableQuery = `CREATE TABLE IF NOT EXISTS uids_persistentes (
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
        )`;
        
        db.run(createTableQuery, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('✅ Tabla uids_persistentes creada exitosamente');
                resolve();
            }
        });
    });
}

// Paso 2: Migrar UIDs existentes de la tabla jugadores
function migrarUIDsExistentes() {
    return new Promise((resolve, reject) => {
        // Obtener jugadores que tienen UID en la tabla jugadores
        db.all('SELECT nombre, uid FROM jugadores WHERE uid IS NOT NULL AND uid != ""', [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (rows.length === 0) {
                console.log('📝 No hay UIDs existentes para migrar');
                resolve();
                return;
            }
            
            console.log(`🔄 Migrando ${rows.length} UIDs existentes...`);
            
            let migrados = 0;
            let errores = 0;
            
            rows.forEach((jugador, index) => {
                const insertQuery = `INSERT OR IGNORE INTO uids_persistentes 
                    (uid, nombre, primera_conexion, ultima_conexion, veces_conectado, activo) 
                    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 1)`;
                
                db.run(insertQuery, [jugador.uid, jugador.nombre], function(err) {
                    if (err) {
                        console.error(`❌ Error migrando ${jugador.nombre}: ${err.message}`);
                        errores++;
                    } else if (this.changes > 0) {
                        console.log(`✅ Migrado: ${jugador.nombre} -> ${jugador.uid}`);
                        migrados++;
                    } else {
                        console.log(`⚠️  Ya existe: ${jugador.nombre} -> ${jugador.uid}`);
                    }
                    
                    // Verificar si es el último
                    if (index === rows.length - 1) {
                        console.log(`\n📊 Migración completada: ${migrados} migrados, ${errores} errores`);
                        resolve();
                    }
                });
            });
        });
    });
}

// Paso 3: Verificar integridad de los datos
function verificarIntegridad() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM uids_persistentes', [], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            console.log(`\n📈 Total de registros en uids_persistentes: ${row.count}`);
            
            // Mostrar algunos ejemplos
            db.all('SELECT * FROM uids_persistentes LIMIT 3', [], (err, samples) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (samples.length > 0) {
                    console.log('\n📋 Ejemplos de registros migrados:');
                    samples.forEach((sample, index) => {
                        console.log(`${index + 1}. ${sample.nombre} -> ${sample.uid}`);
                    });
                }
                
                resolve();
            });
        });
    });
}

// Ejecutar migración
async function ejecutarMigracion() {
    try {
        await crearTablaUIDs();
        await migrarUIDsExistentes();
        await verificarIntegridad();
        
        console.log('\n🎉 ¡Migración del sistema de UID completada exitosamente!');
        console.log('✅ La tabla uids_persistentes está lista para usar');
        
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ Error cerrando la base de datos:', err);
            } else {
                console.log('✅ Base de datos cerrada correctamente');
            }
        });
    }
}

// Iniciar migración
ejecutarMigracion();
