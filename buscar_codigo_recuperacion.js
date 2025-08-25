/**
 * BUSCAR CÓDIGO DE RECUPERACIÓN POR AUTH
 * ====================================
 * 
 * Script para encontrar el código de recuperación de un jugador
 * usando su auth de HaxBall
 */

const { executeQuery } = require('./config/database');

async function buscarCodigoPorAuth(auth) {
    try {
        console.log(`🔍 Buscando código de recuperación para auth: ${auth}`);
        
        // Buscar en la tabla de conexiones activas primero
        const queryConexiones = `
            SELECT ca.nombre_jugador, j.codigoRecuperacion, j.partidos, j.goles, j.asistencias 
            FROM conexiones_activas ca 
            LEFT JOIN jugadores j ON ca.nombre_jugador = j.nombre 
            WHERE ca.auth_jugador = ? AND ca.activa = 1
        `;
        
        let resultados = await executeQuery(queryConexiones, [auth]);
        
        if (resultados.length > 0) {
            console.log('✅ Encontrado en conexiones activas:');
            resultados.forEach(r => {
                console.log(`📊 Jugador: ${r.nombre_jugador}`);
                console.log(`🔐 Código: ${r.codigoRecuperacion || 'No generado aún'}`);
                console.log(`🎮 Stats: ${r.partidos || 0} partidos, ${r.goles || 0} goles, ${r.asistencias || 0} asistencias`);
            });
        } else {
            console.log('🔄 No encontrado en conexiones activas, buscando en todas las conexiones...');
            
            // Buscar en todas las conexiones (incluso inactivas)
            const queryTodasConexiones = `
                SELECT ca.nombre_jugador, j.codigoRecuperacion, j.partidos, j.goles, j.asistencias, 
                       ca.fecha_conexion, ca.activa
                FROM conexiones_activas ca 
                LEFT JOIN jugadores j ON ca.nombre_jugador = j.nombre 
                WHERE ca.auth_jugador = ?
                ORDER BY ca.fecha_conexion DESC
                LIMIT 5
            `;
            
            resultados = await executeQuery(queryTodasConexiones, [auth]);
            
            if (resultados.length > 0) {
                console.log('✅ Encontrado en historial de conexiones:');
                resultados.forEach((r, i) => {
                    console.log(`\n--- Conexión ${i + 1} ---`);
                    console.log(`📊 Jugador: ${r.nombre_jugador}`);
                    console.log(`🔐 Código: ${r.codigoRecuperacion || 'No generado aún'}`);
                    console.log(`🎮 Stats: ${r.partidos || 0} partidos, ${r.goles || 0} goles, ${r.asistencias || 0} asistencias`);
                    console.log(`📅 Fecha: ${r.fecha_conexion}`);
                    console.log(`🔗 Estado: ${r.activa ? 'Activa' : 'Inactiva'}`);
                });
            } else {
                console.log('❌ No se encontraron registros para este auth');
                console.log('💡 Posibles razones:');
                console.log('   - El auth no se ha usado recientemente');
                console.log('   - Las conexiones fueron limpiadas');
                console.log('   - El auth es incorrecto');
            }
        }
        
        return resultados;
        
    } catch (error) {
        console.error('❌ Error buscando código:', error);
        throw error;
    }
}

// Ejecutar la búsqueda
const authBuscar = 'dQrCF4tFKgw62vs_SYc3-F_HWhqB14OkfxjVuHxObFI';

buscarCodigoPorAuth(authBuscar)
    .then(resultados => {
        if (resultados.length === 0) {
            console.log('\n🔍 Intentando búsqueda adicional...');
            
            // Búsqueda alternativa: todos los jugadores con códigos
            return executeQuery(`
                SELECT nombre, codigoRecuperacion, partidos, goles, asistencias, 
                       fechaUltimoPartido, uid
                FROM jugadores 
                WHERE codigoRecuperacion IS NOT NULL 
                ORDER BY fechaUltimoPartido DESC 
                LIMIT 20
            `);
        }
        return null;
    })
    .then(resultadosAlternativos => {
        if (resultadosAlternativos) {
            console.log('\n📋 Todos los jugadores con códigos (últimos 20):');
            console.log('💡 Revisa si alguno es tu nombre:');
            console.log('─'.repeat(80));
            
            resultadosAlternativos.forEach((j, i) => {
                console.log(`${i + 1}. ${j.nombre} | 🔐 ${j.codigoRecuperacion} | 🎮 ${j.partidos}PJ ${j.goles}G ${j.asistencias}A | 📅 ${j.fechaUltimoPartido?.substring(0, 10)}`);
            });
            
            console.log('\n💡 Si encuentras tu nombre en la lista, ese es tu código de recuperación');
        }
        
        console.log('\n🔚 Búsqueda completada');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Error en la ejecución:', error.message);
        process.exit(1);
    });
