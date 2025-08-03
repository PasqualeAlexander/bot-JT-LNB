const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración de la base de datos
const dbPath = path.join(process.cwd(), 'lnb_estadisticas.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Iniciando migración: Agregando columna UID a la tabla jugadores...');
console.log('📂 Base de datos:', dbPath);

// Verificar si la columna ya existe
db.all('PRAGMA table_info(jugadores)', [], (err, columns) => {
    if (err) {
        console.error('❌ Error obteniendo información de la tabla:', err.message);
        db.close();
        return;
    }
    
    // Verificar si la columna uid ya existe
    const hasUidColumn = columns.some(col => col.name === 'uid');
    
    if (hasUidColumn) {
        console.log('✅ La columna uid ya existe en la tabla jugadores');
        db.close();
        return;
    }
    
    console.log('📊 Columnas actuales en jugadores:');
    columns.forEach(col => {
        console.log(`   - ${col.name}: ${col.type}`);
    });
    
    // Agregar la columna uid (sin UNIQUE por limitaciones de SQLite)
    console.log('\n🔧 Agregando columna uid...');
    db.run('ALTER TABLE jugadores ADD COLUMN uid TEXT', (err) => {
        if (err) {
            console.error('❌ Error agregando columna uid:', err.message);
        } else {
            console.log('✅ Columna uid agregada exitosamente');
            
            // Verificar que se agregó correctamente
            db.all('PRAGMA table_info(jugadores)', [], (err, newColumns) => {
                if (err) {
                    console.error('❌ Error verificando columnas:', err.message);
                } else {
                    console.log('\n📊 Columnas actualizadas en jugadores:');
                    newColumns.forEach(col => {
                        if (col.name === 'uid') {
                            console.log(`   ✨ ${col.name}: ${col.type} (NUEVA)`);
                        } else {
                            console.log(`   - ${col.name}: ${col.type}`);
                        }
                    });
                    
                    // Verificar cuántos jugadores hay
                    db.get('SELECT COUNT(*) as count FROM jugadores', [], (err, row) => {
                        if (err) {
                            console.error('❌ Error contando jugadores:', err.message);
                        } else {
                            console.log(`\n📈 Total de jugadores en la base de datos: ${row.count}`);
                            console.log('💡 Nota: Los UIDs se asignarán automáticamente cuando los jugadores se conecten');
                            console.log('✅ Migración completada exitosamente');
                        }
                        
                        db.close();
                    });
                }
            });
        }
    });
});
