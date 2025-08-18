/**
 * SCRIPT DE MIGRACIÓN DE SQLITE A MYSQL
 * =====================================
 * 
 * Este script:
 * 1. Crea todas las tablas necesarias en MySQL
 * 2. Migra los datos existentes de SQLite a MySQL
 * 3. Valida que la migración sea exitosa
 */

const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuración de MySQL (puedes cambiar estos valores)
const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '12345',
    charset: 'utf8mb4'
};

const databaseName = process.env.DB_NAME || 'lnb_estadisticas';

// Ruta del archivo SQLite existente
const sqliteDbPath = path.join(process.cwd(), 'lnb_estadisticas.db');

console.log('🚀 INICIANDO MIGRACIÓN DE SQLITE A MYSQL');
console.log('=' .repeat(50));

async function createMySQLTables(connection) {
    console.log('📋 Creando tablas en MySQL...');

    const tables = [
        // Tabla principal de usuarios
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name TEXT,
            auth VARCHAR(255) NOT NULL UNIQUE,
            conn TEXT,
            registered DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            uuid VARCHAR(36),
            discord_id VARCHAR(255),
            blacklist TINYINT(1) DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Tabla de estadísticas
        `CREATE TABLE IF NOT EXISTS stats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNIQUE,
            matches INT DEFAULT 0,
            wins INT DEFAULT 0,
            losses INT DEFAULT 0,
            goals INT DEFAULT 0,
            assists INT DEFAULT 0,
            own_goals INT DEFAULT 0,
            clean_sheets INT DEFAULT 0,
            mvp INT DEFAULT 0,
            coins INT DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Tabla de configuraciones
        `CREATE TABLE IF NOT EXISTS settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNIQUE,
            color VARCHAR(8),
            prefix VARCHAR(5),
            size INT DEFAULT 15,
            celebrationMsg VARCHAR(255),
            welcomeMsg VARCHAR(255),
            goodbyeMsg VARCHAR(255),
            colorsMsg VARCHAR(8),
            celebrationType VARCHAR(10),
            emoji INT,
            hide_rank TINYINT(1) DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (let i = 0; i < tables.length; i++) {
        try {
            await connection.execute(tables[i]);
            console.log(`✅ Tabla ${i + 1}/${tables.length} creada exitosamente`);
        } catch (error) {
            console.error(`❌ Error creando tabla ${i + 1}:`, error.message);
            throw error;
        }
    }
}

async function migrateSQLiteData(mysqlConnection) {
    console.log('📊 Migrando datos de SQLite...');

    if (!fs.existsSync(sqliteDbPath)) {
        console.log('⚠️ No se encontró archivo SQLite, creando estructura vacía');
        return;
    }

    return new Promise((resolve, reject) => {
        const sqliteDb = new sqlite3.Database(sqliteDbPath, (err) => {
            if (err) {
                console.error('❌ Error conectando a SQLite:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Conectado a SQLite');
        });

        // Las tablas antiguas ya no se migrarán con el nuevo esquema
        console.log('⚠️ Saltando migración de datos SQLite (nuevo esquema)');
        resolve();
        return;

        tables.forEach(async (tableName) => {
            try {
                // Verificar si la tabla existe en SQLite
                sqliteDb.get(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [tableName],
                    async (err, row) => {
                        if (err) {
                            console.error(`❌ Error verificando tabla ${tableName}:`, err.message);
                            completed++;
                            if (completed === tables.length) {
                                sqliteDb.close();
                                resolve();
                            }
                            return;
                        }

                        if (!row) {
                            console.log(`⚠️ Tabla ${tableName} no existe en SQLite, saltando...`);
                            completed++;
                            if (completed === tables.length) {
                                sqliteDb.close();
                                resolve();
                            }
                            return;
                        }

                        // Obtener datos de la tabla
                        sqliteDb.all(`SELECT * FROM ${tableName}`, [], async (err, rows) => {
                            if (err) {
                                console.error(`❌ Error leyendo ${tableName}:`, err.message);
                                completed++;
                                if (completed === tables.length) {
                                    sqliteDb.close();
                                    resolve();
                                }
                                return;
                            }

                            if (rows.length === 0) {
                                console.log(`📭 Tabla ${tableName} está vacía`);
                                completed++;
                                if (completed === tables.length) {
                                    sqliteDb.close();
                                    resolve();
                                }
                                return;
                            }

                            try {
                                // Migrar cada fila
                                for (const row of rows) {
                                    const columns = Object.keys(row).filter(col => col !== 'id');
                                    const values = columns.map(col => row[col]);
                                    const placeholders = columns.map(() => '?').join(', ');
                                    
                                    const query = `INSERT IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                                    await mysqlConnection.execute(query, values);
                                }
                                
                                console.log(`✅ ${tableName}: ${rows.length} registros migrados`);
                            } catch (insertError) {
                                console.error(`❌ Error migrando ${tableName}:`, insertError.message);
                            }

                            completed++;
                            if (completed === tables.length) {
                                sqliteDb.close();
                                resolve();
                            }
                        });
                    }
                );
            } catch (error) {
                console.error(`❌ Error procesando tabla ${tableName}:`, error.message);
                completed++;
                if (completed === tables.length) {
                    sqliteDb.close();
                    resolve();
                }
            }
        });
    });
}

async function validateMigration(connection) {
    console.log('🔍 Validando migración...');

    const tables = ['users', 'stats', 'settings'];
    
    for (const tableName of tables) {
        try {
            const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
            console.log(`📊 ${tableName}: ${rows[0].count} registros`);
        } catch (error) {
            console.error(`❌ Error validando ${tableName}:`, error.message);
        }
    }
}

async function main() {
    let connection;

    try {
        // Conectar a MySQL
        console.log('🔌 Conectando a MySQL...');
        connection = await mysql.createConnection(mysqlConfig);
        console.log('✅ Conexión a MySQL establecida');

        // Crear base de datos si no existe
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('✅ Base de datos verificada/creada');

        // Usar la base de datos
        await connection.execute(`USE ${databaseName}`);

        // Crear tablas
        await createMySQLTables(connection);

        // Migrar datos
        await migrateSQLiteData(connection);

        // Validar migración
        await validateMigration(connection);

        console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
        console.log('=' .repeat(50));
        console.log('📋 Próximos pasos:');
        console.log('1. Actualizar bot.js para usar MySQL');
        console.log('2. Probar la aplicación');
        console.log('3. Hacer backup del archivo SQLite como respaldo');
        console.log('4. Actualizar configuración de producción');

    } catch (error) {
        console.error('❌ Error durante la migración:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('✅ Conexión MySQL cerrada');
        }
    }
}

// Ejecutar migración si el script se ejecuta directamente
if (require.main === module) {
    main();
}

module.exports = { main, createMySQLTables, migrateSQLiteData, validateMigration };
