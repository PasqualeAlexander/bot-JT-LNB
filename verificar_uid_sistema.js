const { executeQuery, testConnection, closePool } = require('./config/database');

// Cargar variables de entorno si existe archivo .env
if (require('fs').existsSync('.env')) {
    require('dotenv').config();
}

async function verificarSistemaUID() {
    console.log('🔍 Verificando sistema de UID en la base de datos MySQL...\n');
    
    try {
        // Verificar conexión primero
        const isConnected = await testConnection();
        if (!isConnected) {
            console.error('❌ No se pudo conectar a la base de datos MySQL');
            return;
        }
        
        // Verificar qué tablas existen
        console.log('📊 TABLAS EXISTENTES:');
        console.log('========================');
        
        const tables = await executeQuery("SHOW TABLES");
        const tableNames = tables.map(row => Object.values(row)[0]);
        
        tableNames.forEach(table => {
            console.log(`  • ${table}`);
        });
        console.log('');
        
        // Verificar estructura de tabla jugadores
        if (tableNames.includes('jugadores')) {
            const columns = await executeQuery("DESCRIBE jugadores");
            
            console.log('📋 ESTRUCTURA DE TABLA "jugadores":');
            console.log('=====================================');
            let hasUID = false;
            
            columns.forEach(col => {
                console.log(`  • ${col.Field} (${col.Type}) ${col.Key === 'PRI' ? '- PRIMARY KEY' : ''} ${col.Null === 'NO' ? '- NOT NULL' : ''}`);
                if (col.Field === 'uid') {
                    hasUID = true;
                }
            });
            
            if (hasUID) {
                console.log('\n✅ La tabla "jugadores" tiene columna UID');
            } else {
                console.log('\n❌ La tabla "jugadores" NO tiene columna UID');
            }
        } else {
            console.log('❌ La tabla "jugadores" no existe');
        }
        
        // Verificar si existe tabla uids_persistentes
        if (tableNames.includes('uids_persistentes')) {
            console.log('\n✅ Tabla "uids_persistentes" encontrada');
            
            // Mostrar estructura de tabla uids_persistentes
            const uidColumns = await executeQuery("DESCRIBE uids_persistentes");
            
            console.log('\n📋 ESTRUCTURA DE TABLA "uids_persistentes":');
            console.log('============================================');
            
            uidColumns.forEach(col => {
                console.log(`  • ${col.Field} (${col.Type}) ${col.Key === 'PRI' ? '- PRIMARY KEY' : ''} ${col.Null === 'NO' ? '- NOT NULL' : ''}`);
            });
            
            // Contar registros en uids_persistentes
            const countResult = await executeQuery("SELECT COUNT(*) as count FROM uids_persistentes");
            const count = countResult[0].count;
            
            console.log(`\n📊 Registros en uids_persistentes: ${count}`);
            
            // Mostrar algunos ejemplos si existen
            if (count > 0) {
                const samples = await executeQuery("SELECT * FROM uids_persistentes LIMIT 5");
                
                console.log('\n📋 EJEMPLOS DE REGISTROS UID (primeros 5):');
                console.log('==========================================');
                
                samples.forEach((sample, index) => {
                    console.log(`${index + 1}. UID: ${sample.uid}`);
                    console.log(`   Nombre: ${sample.nombre || 'N/A'}`);
                    console.log(`   IP: ${sample.ip || 'N/A'}`);
                    console.log(`   Auth: ${sample.auth_haxball || 'N/A'}`);
                    console.log(`   Conn: ${sample.conn_haxball || 'N/A'}`);
                    console.log(`   Primera conexión: ${sample.primera_conexion}`);
                    console.log(`   Última conexión: ${sample.ultima_conexion}`);
                    console.log(`   Veces conectado: ${sample.veces_conectado || 0}`);
                    console.log(`   Activo: ${sample.activo ? '✅' : '❌'}`);
                    console.log('   ────────────────────────────────────');
                });
            } else {
                console.log('\n📝 No hay registros UID en la base de datos');
            }
        } else {
            console.log('\n❌ Tabla "uids_persistentes" NO encontrada');
        }
        
    } catch (error) {
        console.error('❌ Error verificando sistema UID:', error.message);
    } finally {
        cerrarDB();
    }
}

verificarSistemaUID();

function cerrarDB() {
    console.log('\n' + '='.repeat(60));
    console.log('🏁 RESUMEN VERIFICACIÓN SISTEMA UID:');
    console.log('='.repeat(60));
    
    closePool().then(() => {
        console.log('✅ Pool de conexiones MySQL cerrado correctamente');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Error cerrando pool MySQL:', err.message);
        process.exit(1);
    });
}
