const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'lnb_estadisticas.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Iniciando migración del sistema de baneos...');

// Crear nueva tabla baneos
const crearTablaBaneos = () => {
    return new Promise((resolve, reject) => {
        const query = `
            CREATE TABLE IF NOT EXISTS baneos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                auth_id TEXT NOT NULL,
                nombre TEXT,
                razon TEXT,
                admin TEXT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                duracion INTEGER NOT NULL DEFAULT 0,
                activo INTEGER DEFAULT 1
            )
        `;
        
        db.run(query, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('✅ Tabla baneos creada exitosamente');
                resolve();
            }
        });
    });
};

// Crear índices para optimización
const crearIndices = () => {
    return new Promise((resolve, reject) => {
        const indices = [
            'CREATE INDEX IF NOT EXISTS idx_baneos_auth_id ON baneos(auth_id)',
            'CREATE INDEX IF NOT EXISTS idx_baneos_fecha ON baneos(fecha)',
            'CREATE INDEX IF NOT EXISTS idx_baneos_activo ON baneos(activo)'
        ];
        
        let completados = 0;
        
        indices.forEach((indiceQuery, index) => {
            db.run(indiceQuery, (err) => {
                if (err) {
                    console.warn(`⚠️ Advertencia creando índice ${index + 1}:`, err.message);
                } else {
                    console.log(`✅ Índice ${index + 1} creado`);
                }
                
                completados++;
                if (completados === indices.length) {
                    resolve();
                }
            });
        });
    });
};

// Migrar baneos existentes desde la tabla jugadores
const migrarBaneosExistentes = () => {
    return new Promise((resolve, reject) => {
        // Buscar jugadores baneados en la tabla actual
        const query = `
            SELECT nombre, baneado, fecha_ban, razon_ban, admin_ban 
            FROM jugadores 
            WHERE baneado = 1
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (rows.length === 0) {
                console.log('📋 No se encontraron baneos existentes para migrar');
                resolve(0);
                return;
            }
            
            console.log(`📋 Encontrados ${rows.length} baneos para migrar`);
            
            let migrados = 0;
            let errores = 0;
            
            rows.forEach((jugador, index) => {
                const insertQuery = `
                    INSERT INTO baneos (auth_id, nombre, razon, admin, fecha, duracion, activo)
                    VALUES (?, ?, ?, ?, ?, 0, 1)
                `;
                
                // Usar el nombre como auth_id temporal ya que no tenemos uid
                const authId = `legacy_${jugador.nombre}_${Date.now()}_${index}`;
                const fecha = jugador.fecha_ban || new Date().toISOString();
                const razon = jugador.razon_ban || 'Baneo migrado del sistema anterior';
                const admin = jugador.admin_ban || 'Sistema';
                
                db.run(insertQuery, [authId, jugador.nombre, razon, admin, fecha], function(err) {
                    if (err) {
                        console.error(`❌ Error migrando ${jugador.nombre}:`, err.message);
                        errores++;
                    } else {
                        console.log(`✅ Migrado: ${jugador.nombre} (ID: ${this.lastID})`);
                        migrados++;
                    }
                    
                    // Verificar si terminamos
                    if (migrados + errores === rows.length) {
                        console.log(`📊 Migración completada: ${migrados} exitosos, ${errores} errores`);
                        resolve(migrados);
                    }
                });
            });
        });
    });
};

// Verificar la migración
const verificarMigracion = () => {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM baneos WHERE activo = 1', [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                console.log(`✅ Verificación: ${row.count} baneos activos en la nueva tabla`);
                resolve(row.count);
            }
        });
    });
};

// Ejecutar migración
const ejecutarMigracion = async () => {
    try {
        await crearTablaBaneos();
        await crearIndices();
        const migrados = await migrarBaneosExistentes();
        await verificarMigracion();
        
        console.log('🎉 ¡Migración completada exitosamente!');
        console.log(`📊 Total de baneos migrados: ${migrados}`);
        console.log('');
        console.log('📋 Próximos pasos:');
        console.log('   1. El sistema de baneos ahora usa la nueva tabla "baneos"');
        console.log('   2. Los baneos antiguos en la tabla "jugadores" siguen ahí para respaldo');
        console.log('   3. El bot usará automáticamente el nuevo sistema');
        
    } catch (error) {
        console.error('❌ Error en la migración:', error);
    } finally {
        db.close();
    }
};

ejecutarMigracion();
