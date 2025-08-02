const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Abrir la base de datos
const dbPath = path.join(process.cwd(), 'lnb_estadisticas.db');
const db = new sqlite3.Database(dbPath);

console.log('📊 CONSULTA DE BASE DE DATOS LNB\n');

// Contar total de jugadores
db.get('SELECT COUNT(*) as total FROM jugadores', (err, row) => {
    if (err) {
        console.error('❌ Error:', err);
        return;
    }
    
    console.log(`👥 Total de jugadores en la base de datos: ${row.total}`);
    
    if (row.total > 0) {
        // Mostrar algunos jugadores de ejemplo
        console.log('\n📋 Últimos jugadores registrados:');
        db.all('SELECT nombre, partidos, goles, asistencias, fechaUltimoPartido FROM jugadores ORDER BY updated_at DESC LIMIT 10', (err, rows) => {
            if (err) {
                console.error('❌ Error:', err);
                return;
            }
            
            if (rows.length > 0) {
                console.log('┌─────────────────────┬─────────┬───────┬─────────────┬───────────────────┐');
                console.log('│ Nombre              │ Partidos│ Goles │ Asistencias │ Último Partido    │');
                console.log('├─────────────────────┼─────────┼───────┼─────────────┼───────────────────┤');
                
                rows.forEach(jugador => {
                    const nombre = jugador.nombre.padEnd(19);
                    const partidos = jugador.partidos.toString().padStart(7);
                    const goles = jugador.goles.toString().padStart(5);
                    const asistencias = jugador.asistencias.toString().padStart(11);
                    const fecha = jugador.fechaUltimoPartido ? 
                        new Date(jugador.fechaUltimoPartido).toLocaleDateString() : 
                        'N/A';
                    const fechaFormat = fecha.padEnd(17);
                    
                    console.log(`│ ${nombre} │${partidos} │${goles} │${asistencias} │ ${fechaFormat} │`);
                });
                
                console.log('└─────────────────────┴─────────┴───────┴─────────────┴───────────────────┘');
            }
            
            // Mostrar top goleadores
            console.log('\n🏆 TOP 5 GOLEADORES:');
            db.all('SELECT nombre, goles, partidos FROM jugadores WHERE goles > 0 ORDER BY goles DESC LIMIT 5', (err, rows) => {
                if (err) {
                    console.error('❌ Error:', err);
                    return;
                }
                
                if (rows.length > 0) {
                    rows.forEach((jugador, index) => {
                        const promedio = jugador.partidos > 0 ? (jugador.goles / jugador.partidos).toFixed(2) : '0.00';
                        console.log(`${index + 1}. ${jugador.nombre} - ${jugador.goles} goles (${promedio} por partido)`);
                    });
                } else {
                    console.log('   No hay goleadores registrados aún');
                }
                
                db.close();
            });
        });
    } else {
        console.log('\n💡 La base de datos está vacía. Los jugadores se agregarán automáticamente when join and play matches.');
        db.close();
    }
});
