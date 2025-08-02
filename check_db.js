const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'lnb_estadisticas.db');

console.log('Verificando base de datos...');
console.log('Ruta:', dbPath);
console.log('¿Existe el archivo?', fs.existsSync(dbPath));

if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('Tamaño del archivo:', stats.size, 'bytes');
    console.log('Última modificación:', stats.mtime.toLocaleString());
}

const db = new sqlite3.Database(dbPath);

// Verificar estructura de tablas
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
        console.error('Error obteniendo tablas:', err.message);
        db.close();
        return;
    }
    
    console.log('Tablas encontradas:', tables.map(t => t.name));
    
    let completed = 0;
    const total = 3;
    
    const checkDone = () => {
        completed++;
        if (completed === total) {
            // También verificar algunos registros recientes si existen
            db.all("SELECT * FROM jugadores ORDER BY updated_at DESC LIMIT 5", [], (err, rows) => {
                if (err) {
                    console.log('Error obteniendo jugadores recientes:', err.message);
                } else if (rows.length > 0) {
                    console.log('\nJugadores recientes:');
                    rows.forEach(jugador => {
                        console.log(`- ${jugador.nombre}: ${jugador.partidos} partidos, ${jugador.goles} goles, última actualización: ${jugador.updated_at}`);
                    });
                } else {
                    console.log('\nNo hay jugadores recientes');
                }
                
                // Verificar partidos recientes
                db.all("SELECT * FROM partidos ORDER BY created_at DESC LIMIT 3", [], (err, rows) => {
                    if (err) {
                        console.log('Error obteniendo partidos recientes:', err.message);
                    } else if (rows.length > 0) {
                        console.log('\nPartidos recientes:');
                        rows.forEach(partido => {
                            console.log(`- ${partido.fecha}: ${partido.golesRed}-${partido.golesBlue}, duración: ${partido.duracion}s`);
                        });
                    } else {
                        console.log('\nNo hay partidos recientes');
                    }
                    
                    db.close();
                });
            });
        }
    };
    
    // Verificar jugadores
    db.get('SELECT COUNT(*) as count FROM jugadores', [], (err, row) => {
        if (err) {
            console.log('Error en tabla jugadores:', err.message);
        } else {
            console.log('Registros en jugadores:', row.count);
        }
        checkDone();
    });
    
    // Verificar partidos
    db.get('SELECT COUNT(*) as count FROM partidos', [], (err, row) => {
        if (err) {
            console.log('Error en tabla partidos:', err.message);
        } else {
            console.log('Registros en partidos:', row.count);
        }
        checkDone();
    });
    
    // Verificar records
    db.get('SELECT COUNT(*) as count FROM records', [], (err, row) => {
        if (err) {
            console.log('Error en tabla records:', err.message);
        } else {
            console.log('Registros en records:', row.count);
        }
        checkDone();
    });
});
