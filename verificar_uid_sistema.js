const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración del archivo de base de datos
const dbPath = path.join(process.cwd(), 'lnb_estadisticas.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verificando sistema de UID en la base de datos...\n');

// Verificar qué tablas existen
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
        console.error('❌ Error obteniendo tablas:', err);
        return;
    }
    
    console.log('📊 TABLAS EXISTENTES:');
    console.log('========================');
    tables.forEach(table => {
        console.log(`  • ${table.name}`);
    });
    console.log('');
    
    // Verificar estructura de tabla jugadores
    db.all("PRAGMA table_info(jugadores)", [], (err, columns) => {
        if (err) {
            console.error('❌ Error obteniendo columnas de jugadores:', err);
            return;
        }
        
        console.log('📋 ESTRUCTURA DE TABLA "jugadores":');
        console.log('=====================================');
        let hasUID = false;
        columns.forEach(col => {
            console.log(`  • ${col.name} (${col.type}) ${col.pk ? '- PRIMARY KEY' : ''} ${col.notnull ? '- NOT NULL' : ''}`);
            if (col.name === 'uid') {
                hasUID = true;
            }
        });
        
        if (hasUID) {
            console.log('\n✅ La tabla "jugadores" tiene columna UID');
        } else {
            console.log('\n❌ La tabla "jugadores" NO tiene columna UID');
        }
        
        // Verificar si existe tabla uids_persistentes
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='uids_persistentes'", [], (err, uidTable) => {
            if (err) {
                console.error('❌ Error buscando tabla uids_persistentes:', err);
                return;
            }
            
            if (uidTable.length > 0) {
                console.log('\n✅ Tabla "uids_persistentes" encontrada');
                
                // Mostrar estructura de tabla uids_persistentes
                db.all("PRAGMA table_info(uids_persistentes)", [], (err, uidColumns) => {
                    if (err) {
                        console.error('❌ Error obteniendo estructura de uids_persistentes:', err);
                        return;
                    }
                    
                    console.log('\n📋 ESTRUCTURA DE TABLA "uids_persistentes":');
                    console.log('============================================');
                    uidColumns.forEach(col => {
                        console.log(`  • ${col.name} (${col.type}) ${col.pk ? '- PRIMARY KEY' : ''} ${col.notnull ? '- NOT NULL' : ''}`);
                    });
                    
                    // Contar registros en uids_persistentes
                    db.get("SELECT COUNT(*) as count FROM uids_persistentes", [], (err, count) => {
                        if (err) {
                            console.error('❌ Error contando registros en uids_persistentes:', err);
                        } else {
                            console.log(`\n📊 Registros en uids_persistentes: ${count.count}`);
                        }
                        
                        // Mostrar algunos ejemplos si existen
                        if (count.count > 0) {
                            db.all("SELECT * FROM uids_persistentes LIMIT 5", [], (err, samples) => {
                                if (err) {
                                    console.error('❌ Error obteniendo ejemplos:', err);
                                } else {
                                    console.log('\n📋 EJEMPLOS DE REGISTROS UID (primeros 5):');
                                    console.log('==========================================');
                                    samples.forEach((sample, index) => {
                                        console.log(`${index + 1}. UID: ${sample.uid}`);
                                        console.log(`   Nombre: ${sample.nombre}`);
                                        console.log(`   IP: ${sample.ip}`);
                                        console.log(`   Auth: ${sample.auth_haxball || 'N/A'}`);
                                        console.log(`   Conn: ${sample.conn_haxball || 'N/A'}`);
                                        console.log(`   Primera conexión: ${sample.primera_conexion}`);
                                        console.log(`   Última conexión: ${sample.ultima_conexion}`);
                                        console.log(`   Veces conectado: ${sample.veces_conectado}`);
                                        console.log(`   Activo: ${sample.activo ? '✅' : '❌'}`);
                                        console.log('   ────────────────────────────────────');
                                    });
                                }
                                
                                cerrarDB();
                            });
                        } else {
                            console.log('\n📝 No hay registros UID en la base de datos');
                            cerrarDB();
                        }
                    });
                });
            } else {
                console.log('\n❌ Tabla "uids_persistentes" NO encontrada');
                cerrarDB();
            }
        });
    });
});

function cerrarDB() {
    console.log('\n' + '='.repeat(60));
    console.log('🏁 RESUMEN VERIFICACIÓN SISTEMA UID:');
    console.log('='.repeat(60));
    
    db.close((err) => {
        if (err) {
            console.error('❌ Error cerrando base de datos:', err);
        } else {
            console.log('✅ Base de datos cerrada correctamente');
        }
    });
}
