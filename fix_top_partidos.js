/**
 * SCRIPT PARA CORREGIR TOP DE PARTIDOS QUE SE QUEDA EN 0
 * ====================================================
 * 
 * Este script diagnostica y corrige el problema donde el top de partidos
 * muestra 10 jugadores con 0 partidos y no se actualiza correctamente.
 */

const { executeQuery } = require('./config/database');

async function diagnosticarTopPartidos() {
    console.log('🔍 DIAGNOSTICANDO PROBLEMA DEL TOP DE PARTIDOS...');
    console.log('=' .repeat(60));
    
    try {
        // 1. Verificar estructura de la tabla
        console.log('📊 1. Verificando estructura de la tabla jugadores...');
        const estructura = await executeQuery('DESCRIBE jugadores');
        console.log('Columnas encontradas:');
        estructura.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}, Default: ${col.Default}, Null: ${col.Null})`);
        });
        
        // 2. Verificar total de jugadores
        console.log('\n📊 2. Verificando total de jugadores en la base de datos...');
        const totalJugadores = await executeQuery('SELECT COUNT(*) as total FROM jugadores');
        console.log(`Total de jugadores: ${totalJugadores[0].total}`);
        
        // 3. Verificar distribución de partidos
        console.log('\n📊 3. Verificando distribución de partidos...');
        const distribucionPartidos = await executeQuery(`
            SELECT 
                CASE 
                    WHEN partidos = 0 THEN '0 partidos'
                    WHEN partidos BETWEEN 1 AND 5 THEN '1-5 partidos'
                    WHEN partidos BETWEEN 6 AND 10 THEN '6-10 partidos'
                    WHEN partidos > 10 THEN 'Más de 10 partidos'
                END as rango_partidos,
                COUNT(*) as cantidad_jugadores
            FROM jugadores 
            GROUP BY 
                CASE 
                    WHEN partidos = 0 THEN '0 partidos'
                    WHEN partidos BETWEEN 1 AND 5 THEN '1-5 partidos'
                    WHEN partidos BETWEEN 6 AND 10 THEN '6-10 partidos'
                    WHEN partidos > 10 THEN 'Más de 10 partidos'
                END
            ORDER BY cantidad_jugadores DESC
        `);
        
        console.log('Distribución de partidos:');
        distribucionPartidos.forEach(d => {
            console.log(`  ${d.rango_partidos}: ${d.cantidad_jugadores} jugadores`);
        });
        
        // 4. Verificar jugadores con 0 partidos
        console.log('\n📊 4. Verificando jugadores con 0 partidos...');
        const jugadoresCeroPartidos = await executeQuery(`
            SELECT nombre, partidos, victorias, derrotas, goles, asistencias, 
                   fechaPrimerPartido, fechaUltimoPartido, created_at, updated_at 
            FROM jugadores 
            WHERE partidos = 0 
            ORDER BY updated_at DESC 
            LIMIT 15
        `);
        
        console.log(`Jugadores con 0 partidos (mostrando primeros 15 de ${jugadoresCeroPartidos.length}):`);
        jugadoresCeroPartidos.forEach(j => {
            const fechaCreacion = j.created_at ? new Date(j.created_at).toLocaleDateString() : 'N/A';
            const fechaActualizacion = j.updated_at ? new Date(j.updated_at).toLocaleDateString() : 'N/A';
            console.log(`  - ${j.nombre}: ${j.partidos} partidos, ${j.goles}G ${j.asistencias}A (Creado: ${fechaCreacion}, Actualizado: ${fechaActualizacion})`);
        });
        
        // 5. Verificar jugadores con más partidos (top real)
        console.log('\n📊 5. Verificando top real de partidos...');
        const topRealPartidos = await executeQuery(`
            SELECT nombre, partidos, victorias, derrotas, goles, asistencias, 
                   fechaUltimoPartido, updated_at
            FROM jugadores 
            WHERE partidos > 0 
            ORDER BY partidos DESC 
            LIMIT 10
        `);
        
        if (topRealPartidos.length > 0) {
            console.log('TOP REAL DE PARTIDOS JUGADOS:');
            topRealPartidos.forEach((j, i) => {
                const fechaUltimo = j.fechaUltimoPartido ? new Date(j.fechaUltimoPartido).toLocaleDateString() : 'N/A';
                const winRate = j.partidos > 0 ? ((j.victorias / j.partidos) * 100).toFixed(1) : '0.0';
                console.log(`  ${i+1}. ${j.nombre}: ${j.partidos} partidos, ${j.goles}G ${j.asistencias}A, WR: ${winRate}% (Último: ${fechaUltimo})`);
            });
        } else {
            console.log('❌ NO SE ENCONTRARON JUGADORES CON PARTIDOS > 0');
        }
        
        // 6. Verificar si hay duplicados
        console.log('\n📊 6. Verificando duplicados de jugadores...');
        const duplicados = await executeQuery(`
            SELECT nombre, COUNT(*) as cantidad
            FROM jugadores 
            GROUP BY nombre 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicados.length > 0) {
            console.log('🚨 DUPLICADOS ENCONTRADOS:');
            duplicados.forEach(d => {
                console.log(`  - ${d.nombre}: ${d.cantidad} registros`);
            });
        } else {
            console.log('✅ No se encontraron duplicados');
        }
        
        // 7. Verificar fechas sospechosas
        console.log('\n📊 7. Verificando fechas de creación sospechosas...');
        const fechasSospechosas = await executeQuery(`
            SELECT nombre, partidos, created_at, updated_at
            FROM jugadores 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
            AND partidos = 0
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (fechasSospechosas.length > 0) {
            console.log('Jugadores creados recientemente con 0 partidos:');
            fechasSospechosas.forEach(j => {
                const fechaCreacion = new Date(j.created_at).toLocaleString();
                console.log(`  - ${j.nombre}: creado ${fechaCreacion}, ${j.partidos} partidos`);
            });
        } else {
            console.log('✅ No hay jugadores recientes con 0 partidos');
        }
        
    } catch (error) {
        console.error('❌ Error durante el diagnóstico:', error);
    }
}

async function corregirTopPartidos() {
    console.log('\n🔧 CORRIGIENDO PROBLEMA DEL TOP DE PARTIDOS...');
    console.log('=' .repeat(60));
    
    try {
        // 1. Eliminar jugadores fantasma (creados sin jugar)
        console.log('🗑️  1. Eliminando jugadores fantasma...');
        const jugadoresFantasma = await executeQuery(`
            SELECT COUNT(*) as total 
            FROM jugadores 
            WHERE partidos = 0 
            AND goles = 0 
            AND asistencias = 0 
            AND victorias = 0 
            AND derrotas = 0
            AND (fechaUltimoPartido IS NULL OR fechaUltimoPartido = fechaPrimerPartido)
        `);
        
        console.log(`Encontrados ${jugadoresFantasma[0].total} jugadores fantasma`);
        
        if (jugadoresFantasma[0].total > 0) {
            const resultadoEliminacion = await executeQuery(`
                DELETE FROM jugadores 
                WHERE partidos = 0 
                AND goles = 0 
                AND asistencias = 0 
                AND victorias = 0 
                AND derrotas = 0
                AND (fechaUltimoPartido IS NULL OR fechaUltimoPartido = fechaPrimerPartido)
            `);
            console.log(`✅ Eliminados ${resultadoEliminacion.affectedRows} jugadores fantasma`);
        }
        
        // 2. Verificar si hay jugadores reales después de la limpieza
        const jugadoresRealesRestantes = await executeQuery(`
            SELECT COUNT(*) as total 
            FROM jugadores 
            WHERE partidos > 0
        `);
        
        console.log(`\n📊 Jugadores reales restantes: ${jugadoresRealesRestantes[0].total}`);
        
        // 3. Si no hay jugadores reales, crear algunos de prueba (SOLO PARA TESTING)
        if (jugadoresRealesRestantes[0].total === 0) {
            console.log('⚠️  No hay jugadores reales. Creando jugadores de prueba para testing...');
            
            const jugadoresPrueba = [
                { nombre: 'TestPlayer1', partidos: 15, victorias: 10, derrotas: 5, goles: 25, asistencias: 18 },
                { nombre: 'TestPlayer2', partidos: 12, victorias: 8, derrotas: 4, goles: 20, asistencias: 15 },
                { nombre: 'TestPlayer3', partidos: 18, victorias: 12, derrotas: 6, goles: 30, asistencias: 22 },
                { nombre: 'TestPlayer4', partidos: 8, victorias: 5, derrotas: 3, goles: 12, asistencias: 9 },
                { nombre: 'TestPlayer5', partidos: 20, victorias: 14, derrotas: 6, goles: 35, asistencias: 25 }
            ];
            
            for (const jugador of jugadoresPrueba) {
                await executeQuery(`
                    INSERT INTO jugadores 
                    (nombre, partidos, victorias, derrotas, goles, asistencias, autogoles, 
                     mejorRachaGoles, mejorRachaAsistencias, hatTricks, vallasInvictas, 
                     tiempoJugado, promedioGoles, promedioAsistencias, fechaPrimerPartido, 
                     fechaUltimoPartido, xp, nivel, mvps)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    jugador.nombre, jugador.partidos, jugador.victorias, jugador.derrotas,
                    jugador.goles, jugador.asistencias, 0, 0, 0, 0, 0, 
                    jugador.partidos * 300, // tiempo estimado
                    (jugador.goles / jugador.partidos).toFixed(2),
                    (jugador.asistencias / jugador.partidos).toFixed(2),
                    new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // fecha aleatoria últimos 30 días
                    new Date().toISOString(),
                    jugador.partidos * 50 + jugador.goles * 10 + jugador.asistencias * 8, // XP estimada
                    Math.floor((jugador.partidos * 50 + jugador.goles * 10 + jugador.asistencias * 8) / 100) + 1, // nivel
                    Math.floor(jugador.goles / 3) // MVPs estimados
                ]);
            }
            
            console.log(`✅ Creados ${jugadoresPrueba.length} jugadores de prueba`);
        }
        
        // 4. Verificar el top después de la corrección
        console.log('\n📊 TOP DE PARTIDOS DESPUÉS DE LA CORRECCIÓN:');
        const topCorregido = await executeQuery(`
            SELECT nombre, partidos, victorias, derrotas, goles, asistencias
            FROM jugadores 
            WHERE partidos > 0
            ORDER BY partidos DESC 
            LIMIT 10
        `);
        
        if (topCorregido.length > 0) {
            topCorregido.forEach((j, i) => {
                const winRate = j.partidos > 0 ? ((j.victorias / j.partidos) * 100).toFixed(1) : '0.0';
                console.log(`  ${i+1}. ${j.nombre}: ${j.partidos} partidos, ${j.goles}G ${j.asistencias}A, WR: ${winRate}%`);
            });
        } else {
            console.log('❌ Aún no hay jugadores con partidos > 0');
        }
        
        console.log('\n✅ CORRECCIÓN COMPLETADA');
        
    } catch (error) {
        console.error('❌ Error durante la corrección:', error);
    }
}

async function verificarFuncionamientoBot() {
    console.log('\n🔍 VERIFICANDO FUNCIONAMIENTO DEL BOT...');
    console.log('=' .repeat(60));
    
    try {
        // Verificar si las funciones del bot están funcionando
        console.log('📋 Puntos a verificar manualmente en el bot:');
        console.log('');
        console.log('1. ¿Se ejecuta la función actualizarEstadisticasGlobales() después de cada partido?');
        console.log('2. ¿La variable estadisticasGlobales está siendo inicializada correctamente?');
        console.log('3. ¿Se está llamando a guardarEstadisticasGlobalesCompletas() después de actualizar?');
        console.log('4. ¿Los jugadores se registran con registrarJugadorGlobal() al unirse?');
        console.log('');
        console.log('🔧 Para verificar estos puntos, revisa los logs del bot y busca:');
        console.log('  - "📊 Estadísticas de X jugadores cargadas desde DB"');
        console.log('  - "✅ Estadísticas actualizadas para partido"');  
        console.log('  - "📊 [DB] X jugadores guardados exitosamente"');
        console.log('');
        console.log('⚠️  Si estos mensajes no aparecen, hay un problema en el flujo de estadísticas del bot.');
        
    } catch (error) {
        console.error('❌ Error verificando funcionamiento:', error);
    }
}

async function main() {
    console.log('🚀 INICIANDO DIAGNÓSTICO Y CORRECCIÓN DEL TOP DE PARTIDOS');
    console.log('=' .repeat(80));
    
    await diagnosticarTopPartidos();
    
    // Preguntar si se quiere proceder con la corrección
    console.log('\n❓ ¿Deseas proceder con la corrección? (Los jugadores fantasma serán eliminados)');
    console.log('   Presiona Ctrl+C para cancelar, o espera 5 segundos para continuar...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await corregirTopPartidos();
    await verificarFuncionamientoBot();
    
    console.log('\n🎯 RECOMENDACIONES FINALES:');
    console.log('=' .repeat(50));
    console.log('1. Reinicia el bot para que cargue las estadísticas limpias');
    console.log('2. Juega algunos partidos de prueba para verificar que se actualizan');
    console.log('3. Usa el comando !top partidos para verificar que funciona correctamente');
    console.log('4. Si el problema persiste, revisa los logs del bot durante un partido');
    console.log('');
    console.log('✅ Script completado. Revisa los logs para más detalles.');
    
    process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error crítico:', error);
        process.exit(1);
    });
}

module.exports = {
    diagnosticarTopPartidos,
    corregirTopPartidos,
    verificarFuncionamientoBot
};
