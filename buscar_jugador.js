const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./lnb_estadisticas.db', (err) => {
    if(err) {
        console.error('❌ Error conectando a la base de datos:', err);
        return;
    }
    console.log('✅ Conectado a la base de datos');
});

console.log('🔍 Buscando jugador ИФT...\n');

// Buscar por nombre exacto
db.get('SELECT * FROM jugadores WHERE nombre = ?', ['ИФT (𝟙𝟘)'], (err, row) => {
    console.log('📊 Búsqueda por nombre exacto "ИФT (𝟙𝟘)":');
    if (err) {
        console.error('❌ Error:', err);
    } else if (row) {
        console.log('✅ Jugador encontrado:');
        console.log(`   - ID: ${row.id}`);
        console.log(`   - Nombre: ${row.nombre}`);
        console.log(`   - UID: ${row.uid || 'SIN UID'}`);
        console.log(`   - Baneado: ${row.baneado ? 'SÍ' : 'NO'}`);
        console.log(`   - Partidos: ${row.partidos}`);
        console.log(`   - Último partido: ${row.fechaUltimoPartido}`);
    } else {
        console.log('❌ No encontrado con nombre exacto');
    }
    
    // Buscar por patrón
    db.all('SELECT * FROM jugadores WHERE nombre LIKE ? ORDER BY id DESC LIMIT 5', ['%ИФT%'], (err2, rows) => {
        console.log('\n📊 Búsqueda por patrón "%ИФT%":');
        if (err2) {
            console.error('❌ Error:', err2);
        } else if (rows && rows.length > 0) {
            console.log(`✅ Encontrados ${rows.length} jugadores:`);
            rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ${row.nombre} (ID: ${row.id}, UID: ${row.uid || 'SIN UID'})`);
            });
        } else {
            console.log('❌ No encontrado con patrón');
        }
        
        // Mostrar últimos 10 jugadores para referencia
        db.all('SELECT * FROM jugadores ORDER BY id DESC LIMIT 10', (err3, allRows) => {
            console.log('\n📋 Últimos 10 jugadores registrados:');
            if (err3) {
                console.error('❌ Error:', err3);
            } else if (allRows) {
                allRows.forEach((row, index) => {
                    console.log(`   ${index + 1}. ${row.nombre} (ID: ${row.id}, UID: ${row.uid || 'SIN UID'})`);
                });
            }
            
            db.close(() => {
                console.log('\n🔚 Conexión cerrada');
            });
        });
    });
});
