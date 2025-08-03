const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./lnb_estadisticas.db');

console.log('Verificando estructura de la tabla jugadores...');

db.all('PRAGMA table_info(jugadores)', [], (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log('Columnas en jugadores:');
        rows.forEach(row => {
            console.log(`- ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
        });
    }
    db.close();
});
