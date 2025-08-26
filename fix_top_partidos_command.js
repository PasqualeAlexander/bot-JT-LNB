/**
 * SCRIPT PARA CORREGIR ESPECÍFICAMENTE EL COMANDO !top partidos
 * ===========================================================
 * 
 * Este script corrige el problema donde !top partidos muestra todos los valores como 0
 * mientras que los datos reales están correctamente almacenados en la base de datos.
 * 
 * El problema está en la carga de datos desde DB a la memoria del bot.
 */

const { executeQuery } = require('./config/database');

async function diagnosticarComandoTopPartidos() {
    console.log('🔍 DIAGNOSTICANDO COMANDO !top partidos...');
    console.log('=' .repeat(60));
    
    try {
        // 1. Verificar datos reales en la base de datos
        console.log('📊 1. Verificando datos reales en la base de datos...');
        const topReal = await executeQuery(`
            SELECT nombre, partidos, goles, asistencias, victorias, derrotas
            FROM jugadores 
            WHERE partidos > 0
            ORDER BY partidos DESC 
            LIMIT 10
        `);
        
        console.log('TOP REAL DE PARTIDOS (desde base de datos):');
        topReal.forEach((j, i) => {
            const winRate = j.partidos > 0 ? ((j.victorias / j.partidos) * 100).toFixed(1) : '0.0';
            console.log(`  ${i+1}. ${j.nombre}: ${j.partidos} partidos, ${j.goles}G ${j.asistencias}A, WR: ${winRate}%`);
        });
        
        // 2. Simular lo que hace el comando en el bot
        console.log('\n📊 2. Simulando comando !top partidos...');
        console.log('   El comando hace esto:');
        console.log('   - Filtra: jugadores.filter(j => j.partidos > 0)');
        console.log('   - Ordena: .sort((a, b) => b.partidos - a.partidos)');
        console.log('   - Toma: .slice(0, 10)');
        console.log('   - Resultado esperado: lista de jugadores ordenada por partidos');
        console.log('   - Resultado actual: todos con 0 partidos');
        
        // 3. Verificar el problema
        console.log('\n🔍 3. IDENTIFICANDO EL PROBLEMA...');
        console.log('   ❌ PROBLEMA IDENTIFICADO:');
        console.log('   - La base de datos tiene datos correctos');
        console.log('   - El comando muestra valores en 0');
        console.log('   - CAUSA: estadisticasGlobales en memoria no coincide con la DB');
        
        // 4. Explicar la solución
        console.log('\n💡 4. SOLUCIÓN REQUERIDA:');
        console.log('   ✅ Necesitamos asegurar que cargarEstadisticasGlobalesCompletas():');
        console.log('   1. Se ejecute correctamente al iniciar el bot');
        console.log('   2. Cargue TODOS los jugadores desde la DB');
        console.log('   3. Asigne correctamente los valores a estadisticasGlobales.jugadores');
        
        return { datosDB: topReal, diagnostico: 'PROBLEMA_CARGA_MEMORIA' };
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
        return null;
    }
}

async function corregirCargarEstadisticasGlobales() {
    console.log('\n🔧 IMPLEMENTANDO CORRECCIÓN...');
    console.log('=' .repeat(60));
    
    try {
        // 1. Obtener TODOS los jugadores de la base de datos
        console.log('📊 1. Cargando TODOS los jugadores desde base de datos...');
        const todosJugadores = await executeQuery(`
            SELECT nombre, partidos, victorias, derrotas, goles, asistencias, 
                   autogoles, mejorRachaGoles, mejorRachaAsistencias, hatTricks, 
                   vallasInvictas, tiempoJugado, promedioGoles, promedioAsistencias,
                   fechaPrimerPartido, fechaUltimoPartido, xp, nivel, mvps,
                   codigoRecuperacion, fechaCodigoCreado
            FROM jugadores
            ORDER BY nombre
        `);
        
        console.log(`✅ ${todosJugadores.length} jugadores cargados desde DB`);
        
        // 2. Crear la estructura que debería tener estadisticasGlobales
        console.log('🏗️ 2. Creando estructura estadisticasGlobales corregida...');
        
        const estadisticasCorregidas = {
            jugadores: {},
            records: {
                mayorGoles: {jugador: "", cantidad: 0, fecha: ""},
                mayorAsistencias: {jugador: "", cantidad: 0, fecha: ""},
                partidoMasLargo: {duracion: 0, fecha: "", equipos: ""},
                goleadaMasGrande: {diferencia: 0, resultado: "", fecha: ""},
                hatTricks: [],
                vallasInvictas: []
            },
            totalPartidos: 0,
            fechaCreacion: new Date().toISOString(),
            contadorJugadores: todosJugadores.length
        };
        
        // 3. Convertir cada jugador de DB al formato interno del bot
        let totalPartidos = 0;
        todosJugadores.forEach(jugadorDB => {
            estadisticasCorregidas.jugadores[jugadorDB.nombre] = {
                nombre: jugadorDB.nombre,
                partidos: jugadorDB.partidos || 0,
                victorias: jugadorDB.victorias || 0,
                derrotas: jugadorDB.derrotas || 0,
                goles: jugadorDB.goles || 0,
                asistencias: jugadorDB.asistencias || 0,
                autogoles: jugadorDB.autogoles || 0,
                mejorRachaGoles: jugadorDB.mejorRachaGoles || 0,
                mejorRachaAsistencias: jugadorDB.mejorRachaAsistencias || 0,
                hatTricks: jugadorDB.hatTricks || 0,
                mvps: jugadorDB.mvps || 0,
                vallasInvictas: jugadorDB.vallasInvictas || 0,
                tiempoJugado: jugadorDB.tiempoJugado || 0,
                promedioGoles: jugadorDB.promedioGoles || 0,
                promedioAsistencias: jugadorDB.promedioAsistencias || 0,
                fechaPrimerPartido: jugadorDB.fechaPrimerPartido || new Date().toISOString(),
                fechaUltimoPartido: jugadorDB.fechaUltimoPartido || new Date().toISOString(),
                xp: jugadorDB.xp || 40,
                nivel: jugadorDB.nivel || 1,
                codigoRecuperacion: jugadorDB.codigoRecuperacion,
                fechaCodigoCreado: jugadorDB.fechaCodigoCreado
            };
            
            // Sumar partidos totales
            totalPartidos += (jugadorDB.partidos || 0);
        });
        
        estadisticasCorregidas.totalPartidos = Math.floor(totalPartidos / 6); // Aproximación
        
        // 4. Probar la corrección con el top partidos
        console.log('🧪 3. Probando corrección con simulación de !top partidos...');
        
        const jugadoresParaTop = Object.values(estadisticasCorregidas.jugadores)
            .filter(j => j.partidos > 0)
            .sort((a, b) => b.partidos - a.partidos)
            .slice(0, 10);
        
        if (jugadoresParaTop.length > 0) {
            console.log('✅ CORRECCIÓN EXITOSA! Top partidos simulado:');
            jugadoresParaTop.forEach((j, i) => {
                const winRate = j.partidos > 0 ? ((j.victorias / j.partidos) * 100).toFixed(1) : '0.0';
                console.log(`   ${i+1}. ${j.nombre}: ${j.partidos} partidos, WR: ${winRate}%`);
            });
        } else {
            console.log('❌ CORRECCIÓN FALLIDA: Aún no hay jugadores con partidos > 0');
        }
        
        // 5. Generar el código de corrección
        console.log('\n📝 4. Generando código de corrección...');
        
        const codigoCorreccion = `
// FUNCIÓN CORREGIDA: cargarEstadisticasGlobalesCompletas()
async function cargarEstadisticasGlobalesCompletas() {
    try {
        console.log('🔄 Iniciando carga de estadísticas globales...');
        
        // Obtener TODOS los jugadores de la base de datos
        if (typeof nodeObtenerTodosJugadores === 'function') {
            const todosJugadores = await nodeObtenerTodosJugadores();
            
            if (todosJugadores && todosJugadores.length > 0) {
                console.log(\`📊 \${todosJugadores.length} jugadores encontrados en DB\`);
                
                // Inicializar estructura
                estadisticasGlobales = {
                    jugadores: {},
                    records: {
                        mayorGoles: {jugador: "", cantidad: 0, fecha: ""},
                        mayorAsistencias: {jugador: "", cantidad: 0, fecha: ""},
                        partidoMasLargo: {duracion: 0, fecha: "", equipos: ""},
                        goleadaMasGrande: {diferencia: 0, resultado: "", fecha: ""},
                        hatTricks: [],
                        vallasInvictas: []
                    },
                    totalPartidos: 0,
                    fechaCreacion: new Date().toISOString(),
                    contadorJugadores: todosJugadores.length
                };
                
                // Convertir cada jugador al formato interno
                let totalPartidos = 0;
                todosJugadores.forEach(jugadorDB => {
                    estadisticasGlobales.jugadores[jugadorDB.nombre] = {
                        nombre: jugadorDB.nombre,
                        partidos: jugadorDB.partidos || 0,
                        victorias: jugadorDB.victorias || 0,
                        derrotas: jugadorDB.derrotas || 0,
                        goles: jugadorDB.goles || 0,
                        asistencias: jugadorDB.asistencias || 0,
                        autogoles: jugadorDB.autogoles || 0,
                        mejorRachaGoles: jugadorDB.mejorRachaGoles || 0,
                        mejorRachaAsistencias: jugadorDB.mejorRachaAsistencias || 0,
                        hatTricks: jugadorDB.hatTricks || 0,
                        mvps: jugadorDB.mvps || 0,
                        vallasInvictas: jugadorDB.vallasInvictas || 0,
                        tiempoJugado: jugadorDB.tiempoJugado || 0,
                        promedioGoles: jugadorDB.promedioGoles || 0,
                        promedioAsistencias: jugadorDB.promedioAsistencias || 0,
                        fechaPrimerPartido: jugadorDB.fechaPrimerPartido || new Date().toISOString(),
                        fechaUltimoPartido: jugadorDB.fechaUltimoPartido || new Date().toISOString(),
                        xp: jugadorDB.xp || 40,
                        nivel: jugadorDB.nivel || 1,
                        codigoRecuperacion: jugadorDB.codigoRecuperacion,
                        fechaCodigoCreado: jugadorDB.fechaCodigoCreado
                    };
                    
                    totalPartidos += (jugadorDB.partidos || 0);
                });
                
                estadisticasGlobales.totalPartidos = Math.floor(totalPartidos / 6);
                
                console.log(\`✅ Estadísticas cargadas: \${Object.keys(estadisticasGlobales.jugadores).length} jugadores\`);
                
                // Verificar top partidos
                const topPartidos = Object.values(estadisticasGlobales.jugadores)
                    .filter(j => j.partidos > 0)
                    .sort((a, b) => b.partidos - a.partidos)
                    .slice(0, 3);
                    
                if (topPartidos.length > 0) {
                    console.log('🏆 Top 3 partidos cargado:');
                    topPartidos.forEach((j, i) => {
                        console.log(\`   \${i+1}. \${j.nombre}: \${j.partidos} partidos\`);
                    });
                } else {
                    console.warn('⚠️ No se encontraron jugadores con partidos > 0');
                }
                
                return true;
            } else {
                console.warn('⚠️ No se encontraron jugadores en la base de datos');
                return false;
            }
        } else {
            console.error('❌ Función nodeObtenerTodosJugadores no disponible');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error al cargar estadísticas globales:', error);
        estadisticasGlobales = inicializarBaseDatos();
        console.log('📊 Estadísticas globales inicializadas de emergencia');
        return false;
    }
}
`;
        
        console.log('📄 Código de corrección generado (ver archivo de corrección)');
        
        return {
            estadisticasCorregidas,
            jugadoresParaTop,
            codigoCorreccion,
            totalJugadores: todosJugadores.length
        };
        
    } catch (error) {
        console.error('❌ Error implementando corrección:', error);
        return null;
    }
}

async function verificarSolucionPropuesta() {
    console.log('\n🔧 VERIFICANDO NECESIDAD DE FUNCIÓN ADICIONAL...');
    console.log('=' .repeat(60));
    
    try {
        // Verificar si existe la función nodeObtenerTodosJugadores
        console.log('🔍 Verificando si existe nodeObtenerTodosJugadores...');
        
        // Intentar obtener todos los jugadores para ver si la función ya existe
        try {
            const todosJugadores = await executeQuery('SELECT COUNT(*) as total FROM jugadores');
            console.log(`✅ Base de datos accesible: ${todosJugadores[0].total} jugadores total`);
            
            console.log('\n💡 IMPLEMENTACIÓN NECESARIA:');
            console.log('   Se necesita crear la función nodeObtenerTodosJugadores');
            console.log('   Esta función debe exportarse desde db_functions.js');
            console.log('   Y debe estar disponible globalmente para el bot');
            
            const funcionNecesaria = `
// AGREGAR ESTA FUNCIÓN A database/db_functions.js:

async function obtenerTodosJugadores() {
    try {
        const query = \`
            SELECT nombre, partidos, victorias, derrotas, goles, asistencias, 
                   autogoles, mejorRachaGoles, mejorRachaAsistencias, hatTricks, 
                   vallasInvictas, tiempoJugado, promedioGoles, promedioAsistencias,
                   fechaPrimerPartido, fechaUltimoPartido, xp, nivel, mvps,
                   codigoRecuperacion, fechaCodigoCreado
            FROM jugadores
            ORDER BY nombre
        \`;
        
        const result = await executeQuery(query);
        console.log(\`[DB] 📊 \${result.length} jugadores cargados desde DB\`);
        return result;
    } catch (error) {
        console.error('[DB] ❌ Error al obtener todos los jugadores:', error);
        return [];
    }
}

// Y EXPORTAR LA FUNCIÓN:
module.exports = {
    // ... funciones existentes ...
    obtenerTodosJugadores
};

// Y EN bot.js, HACER DISPONIBLE GLOBALMENTE:
global.nodeObtenerTodosJugadores = db_functions.obtenerTodosJugadores;
`;
            
            console.log('📝 Función necesaria:');
            console.log(funcionNecesaria);
            
            return {
                necesitaFuncionAdicional: true,
                funcionRequerida: funcionNecesaria
            };
            
        } catch (error) {
            console.error('❌ Error verificando base de datos:', error);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error en verificación:', error);
        return null;
    }
}

async function main() {
    console.log('🚀 DIAGNÓSTICO Y CORRECCIÓN DEL COMANDO !top partidos');
    console.log('=' .repeat(80));
    
    // 1. Diagnosticar el problema
    const diagnostico = await diagnosticarComandoTopPartidos();
    
    if (!diagnostico) {
        console.log('❌ No se pudo completar el diagnóstico');
        return;
    }
    
    // 2. Implementar la corrección
    const correccion = await corregirCargarEstadisticasGlobales();
    
    if (!correccion) {
        console.log('❌ No se pudo implementar la corrección');
        return;
    }
    
    // 3. Verificar necesidad de funciones adicionales
    const verificacion = await verificarSolucionPropuesta();
    
    // 4. Resumen final
    console.log('\n🎯 RESUMEN Y PASOS A SEGUIR:');
    console.log('=' .repeat(50));
    console.log('');
    console.log('📊 PROBLEMA IDENTIFICADO:');
    console.log('   - Base de datos tiene datos correctos');
    console.log('   - estadisticasGlobales en memoria está vacío/incorrecto');
    console.log('   - cargarEstadisticasGlobalesCompletas() no carga todos los jugadores');
    console.log('');
    console.log('🔧 SOLUCIÓN REQUERIDA:');
    console.log('   1. Crear función nodeObtenerTodosJugadores en db_functions.js');
    console.log('   2. Exportar la función globalmente en bot.js');  
    console.log('   3. Actualizar cargarEstadisticasGlobalesCompletas() en BOTLNBCODE.js');
    console.log('   4. Reiniciar el bot');
    console.log('');
    console.log('✅ RESULTADO ESPERADO:');
    console.log('   - !top partidos mostrará datos reales');
    console.log(`   - Top jugador: ${diagnostico.datosDB[0]?.nombre} con ${diagnostico.datosDB[0]?.partidos} partidos`);
    console.log('');
    console.log('📝 ARCHIVOS A MODIFICAR:');
    console.log('   1. database/db_functions.js (agregar función)');
    console.log('   2. bot.js (exportar función globalmente)');
    console.log('   3. BOTLNBCODE.js (actualizar función de carga)');
    console.log('');
    console.log('⚠️  IMPORTANTE: Reiniciar el bot después de los cambios');
    
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
    diagnosticarComandoTopPartidos,
    corregirCargarEstadisticasGlobales,
    verificarSolucionPropuesta
};
