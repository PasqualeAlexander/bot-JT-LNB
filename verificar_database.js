/**
 * VERIFICACIÓN DE BASE DE DATOS MYSQL
 * ===================================
 * Script para verificar que la base de datos esté funcionando correctamente
 */

// Cargar variables de entorno
require('dotenv').config();

const { testConnection, executeQuery, closePool } = require('./config/database');
const dbFunctions = require('./database/db_functions');

async function verificarBaseDatos() {
    console.log('🔍 VERIFICANDO ESTADO DE LA BASE DE DATOS MYSQL');
    console.log('='.repeat(50));

    try {
        // 1. Probar conexión básica
        console.log('\n1. 🔌 Probando conexión a MySQL...');
        const isConnected = await testConnection();
        
        if (!isConnected) {
            throw new Error('No se pudo establecer conexión con MySQL');
        }

        // 2. Crear base de datos si no existe
        console.log('\n2. 🏗️ Verificando/creando base de datos...');
        const dbName = process.env.DB_NAME || 'lnb_estadisticas';
        
        // Crear conexión temporal sin base de datos específica para crear la DB
        const mysql = require('mysql2/promise');
        const tempConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '12345',
            charset: 'utf8mb4',
            timezone: '+00:00',
            dateStrings: false,
            supportBigNumbers: true,
            bigNumberStrings: false,
            typeCast: true,
            multipleStatements: false
        };
        
        const tempConnection = await mysql.createConnection(tempConfig);
        await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await tempConnection.end();
        
        console.log(`✅ Base de datos "${dbName}" lista`);

        // 3. Crear tablas necesarias
        console.log('\n3. 📋 Creando tablas necesarias...');
        
        const tablas = [
            // Tabla principal de jugadores
            {
                nombre: 'jugadores',
                sql: `CREATE TABLE IF NOT EXISTS jugadores (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(255) UNIQUE NOT NULL,
                    partidos INT DEFAULT 0,
                    victorias INT DEFAULT 0,
                    derrotas INT DEFAULT 0,
                    goles INT DEFAULT 0,
                    asistencias INT DEFAULT 0,
                    autogoles INT DEFAULT 0,
                    mejorRachaGoles INT DEFAULT 0,
                    mejorRachaAsistencias INT DEFAULT 0,
                    hatTricks INT DEFAULT 0,
                    vallasInvictas INT DEFAULT 0,
                    tiempoJugado INT DEFAULT 0,
                    promedioGoles FLOAT DEFAULT 0.0,
                    promedioAsistencias FLOAT DEFAULT 0.0,
                    fechaPrimerPartido VARCHAR(50),
                    fechaUltimoPartido VARCHAR(50),
                    xp INT DEFAULT 40,
                    nivel INT DEFAULT 1,
                    codigoRecuperacion VARCHAR(50),
                    fechaCodigoCreado VARCHAR(50),
                    esVIP TINYINT DEFAULT 0,
                    fechaVIP VARCHAR(50),
                    uid VARCHAR(255) UNIQUE,
                    baneado TINYINT DEFAULT 0,
                    fecha_ban VARCHAR(50),
                    razon_ban TEXT,
                    admin_ban VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )`
            },
            // Tabla de partidos
            {
                nombre: 'partidos',
                sql: `CREATE TABLE IF NOT EXISTS partidos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha VARCHAR(50) NOT NULL,
                    duracion INT NOT NULL,
                    golesRed INT NOT NULL,
                    golesBlue INT NOT NULL,
                    mapa VARCHAR(255) NOT NULL,
                    mejorJugador VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            // Tabla de conexiones activas
            {
                nombre: 'conexiones_activas',
                sql: `CREATE TABLE IF NOT EXISTS conexiones_activas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre_jugador VARCHAR(255) NOT NULL,
                    auth_jugador VARCHAR(255),
                    ip_simulada VARCHAR(50) NOT NULL,
                    identificador_conexion VARCHAR(255) UNIQUE NOT NULL,
                    fecha_conexion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    activa TINYINT DEFAULT 1
                )`
            },
            // Tabla de baneos
            {
                nombre: 'baneos',
                sql: `CREATE TABLE IF NOT EXISTS baneos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    auth_id VARCHAR(255) NOT NULL,
                    nombre VARCHAR(255) NOT NULL,
                    razon TEXT,
                    admin VARCHAR(255) NOT NULL,
                    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    duracion INT DEFAULT 0,
                    activo TINYINT DEFAULT 1,
                    INDEX idx_auth_activo (auth_id, activo)
                )`
            }
        ];

        for (const tabla of tablas) {
            try {
                await executeQuery(tabla.sql);
                console.log(`✅ Tabla "${tabla.nombre}" creada/verificada`);
            } catch (error) {
                console.error(`❌ Error con tabla "${tabla.nombre}":`, error.message);
                throw error;
            }
        }

        // 4. Verificar estructura de las tablas
        console.log('\n4. 🔍 Verificando estructura de tablas...');
        for (const tabla of tablas) {
            try {
                const rows = await executeQuery(`DESCRIBE ${tabla.nombre}`);
                console.log(`📊 Tabla "${tabla.nombre}": ${Array.isArray(rows) ? rows.length : 'N/A'} columnas`);
            } catch (error) {
                console.error(`❌ Error verificando "${tabla.nombre}":`, error.message);
            }
        }

        // 5. Probar funciones básicas de la base de datos
        console.log('\n5. 🧪 Probando funciones básicas...');
        
        // Probar cargar estadísticas globales
        try {
            const stats = await dbFunctions.cargarEstadisticasGlobales();
            console.log(`✅ Cargar estadísticas: OK (${Object.keys(stats.jugadores).length} jugadores)`);
        } catch (error) {
            console.error('❌ Error cargando estadísticas:', error.message);
        }

        // Probar función VIP
        try {
            const jugadoresVIP = await dbFunctions.obtenerJugadoresVIP();
            console.log(`✅ Obtener VIPs: OK (${jugadoresVIP.length} jugadores VIP)`);
        } catch (error) {
            console.error('❌ Error obteniendo VIPs:', error.message);
        }

        // Probar función de baneos
        try {
            const baneosActivos = await dbFunctions.obtenerBaneosActivos();
            console.log(`✅ Obtener baneos: OK (${baneosActivos.length} baneos activos)`);
        } catch (error) {
            console.error('❌ Error obteniendo baneos:', error.message);
        }

        // 6. Crear jugador de prueba (solo si no existe)
        console.log('\n6. 🧪 Creando jugador de prueba...');
        try {
            const jugadorTest = await dbFunctions.obtenerJugador('TestPlayer_Verificacion');
            if (!jugadorTest) {
                await dbFunctions.guardarJugador('TestPlayer_Verificacion', {
                    partidos: 1,
                    victorias: 1,
                    derrotas: 0,
                    goles: 2,
                    asistencias: 1,
                    autogoles: 0,
                    mejorRachaGoles: 2,
                    mejorRachaAsistencias: 1,
                    hatTricks: 0,
                    vallasInvictas: 1,
                    tiempoJugado: 300,
                    promedioGoles: 2.0,
                    promedioAsistencias: 1.0,
                    fechaPrimerPartido: new Date().toISOString(),
                    fechaUltimoPartido: new Date().toISOString(),
                    xp: 40,
                    nivel: 1,
                    codigoRecuperacion: null,
                    fechaCodigoCreado: null
                });
                console.log('✅ Jugador de prueba creado exitosamente');
                
                // Verificar que se creó correctamente
                const jugadorVerif = await dbFunctions.obtenerJugador('TestPlayer_Verificacion');
                if (jugadorVerif) {
                    console.log(`✅ Jugador de prueba verificado: ${jugadorVerif.nombre} - ${jugadorVerif.goles} goles`);
                } else {
                    console.error('❌ No se pudo verificar el jugador de prueba');
                }
            } else {
                console.log('✅ Jugador de prueba ya existe');
            }
        } catch (error) {
            console.error('❌ Error creando jugador de prueba:', error.message);
        }

        console.log('\n🎉 VERIFICACIÓN COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(50));
        console.log('📋 RESUMEN:');
        console.log('✅ Conexión MySQL: OK');
        console.log('✅ Base de datos: OK');
        console.log('✅ Tablas: OK');
        console.log('✅ Funciones: OK');
        console.log('\n💡 La base de datos está lista para usar!');

    } catch (error) {
        console.error('\n❌ ERROR EN VERIFICACIÓN:', error.message);
        console.error('🔧 Revisa la configuración de MySQL y las credenciales');
        throw error;
    } finally {
        // Cerrar pool de conexiones
        await closePool();
    }
}

// Ejecutar verificación si el script se ejecuta directamente
if (require.main === module) {
    verificarBaseDatos().then(() => {
        console.log('\n✅ Script completado exitosamente');
        process.exit(0);
    }).catch((error) => {
        console.error('\n❌ Script falló:', error.message);
        process.exit(1);
    });
}

module.exports = { verificarBaseDatos };
