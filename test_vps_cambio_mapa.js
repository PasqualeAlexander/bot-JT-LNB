/**
 * 🖥️ SCRIPT DE TESTING PARA VPS/NODE.JS
 * 
 * Este script permite probar y debuggear el cambio de mapa
 * directamente en Node.js sin necesidad del navegador
 */

const fs = require('fs');
const path = require('path');

console.log('🖥️ INICIANDO TEST DE CAMBIO DE MAPA EN VPS...\n');

// Simular variables globales del bot
let room = null;
let mapaActual = "biggerx5"; // Simular que está en x4
let cambioMapaEnProceso = false;
let partidoEnCurso = false;
let estadisticasPartido = null;

// Simular mapas
const mapas = {
    biggerx5: { 
        nombre: "LNB Bigger x4", 
        minJugadores: 5, 
        maxJugadores: 10, 
        hbs: "real_x5_hbs_data",
        timeLimit: 5,
        scoreLimit: 4
    },
    biggerx7: { 
        nombre: "LNB Bigger x7", 
        minJugadores: 10, 
        maxJugadores: 14, 
        hbs: "real_x7_hbs_data",
        timeLimit: 5,
        scoreLimit: 5
    }
};

// Mock del room de HaxBall
function createMockRoom(numJugadores = 12) {
    const players = [];
    
    // Crear jugadores distribuidos en equipos
    for (let i = 1; i <= numJugadores; i++) {
        const team = (i % 2 === 1) ? 1 : 2;
        players.push({ 
            id: i, 
            name: `TestPlayer${i}`, 
            team: team 
        });
    }
    
    // Añadir algunos espectadores
    for (let i = numJugadores + 1; i <= numJugadores + 2; i++) {
        players.push({ 
            id: i, 
            name: `Spec${i}`, 
            team: 0 
        });
    }

    return {
        getPlayerList: () => players,
        setCustomStadium: (hbs) => {
            console.log(`🗺️ Mock: setCustomStadium("${hbs}")`);
            return true;
        },
        setTimeLimit: (limit) => {
            console.log(`⏰ Mock: setTimeLimit(${limit})`);
            return true;
        },
        setScoreLimit: (limit) => {
            console.log(`⚽ Mock: setScoreLimit(${limit})`);
            return true;
        },
        stopGame: () => {
            console.log(`⏹️ Mock: stopGame()`);
            partidoEnCurso = false;
        },
        sendAnnouncement: (msg, playerId, color, style, sound) => {
            console.log(`📢 Mock: Anuncio - "${msg}"`);
        }
    };
}

// Función cambiarMapa simulada (basada en el código real)
function cambiarMapa(codigoMapa) {
    console.log(`\n🔧 EJECUTANDO cambiarMapa("${codigoMapa}")...`);
    
    if (!mapas[codigoMapa]) {
        console.log(`❌ Error: Mapa '${codigoMapa}' no encontrado`);
        return false;
    }

    const mapa = mapas[codigoMapa];
    
    try {
        console.log(`📋 Cambiando a: ${mapa.nombre}`);
        
        // Simular cambios en room
        room.setCustomStadium(mapa.hbs);
        room.setTimeLimit(mapa.timeLimit);
        room.setScoreLimit(mapa.scoreLimit);
        
        // Actualizar variable global
        const mapaAnterior = mapaActual;
        mapaActual = codigoMapa;
        
        console.log(`✅ Mapa cambiado exitosamente: ${mapaAnterior} → ${codigoMapa}`);
        console.log(`📊 Configuración aplicada: ${mapa.timeLimit}min, ${mapa.scoreLimit} goles`);
        
        return true;
    } catch (error) {
        console.log(`❌ Error al cambiar mapa:`, error.message);
        return false;
    }
}

// Función verificarCambioMapaPostPartido (copiada del código real)
function verificarCambioMapaPostPartido() {
    console.log(`\n🏁 EJECUTANDO verificarCambioMapaPostPartido()...`);
    
    // Contar jugadores activos (en equipos 1 y 2, no espectadores)
    const jugadoresActivos = room.getPlayerList().filter(j => j.team === 1 || j.team === 2).length;
    
    console.log(`📊 Verificando cambio con ${jugadoresActivos} jugadores activos`);
    console.log(`🗺️ Mapa actual: ${mapaActual}`);
    
    // CAMBIO ESPECÍFICO: De biggerx5 (x4) a biggerx7 si hay 12 o más jugadores
    if (mapaActual === "biggerx5" && jugadoresActivos >= 12) {
        console.log(`📈 ¡CONDICIONES CUMPLIDAS! Cambiando de x5 a x7 (${jugadoresActivos} >= 12 jugadores)`);
        
        cambioMapaEnProceso = true;
        
        if (cambiarMapa("biggerx7")) {
            console.log(`🎯 ¡Cambio automático exitoso! ${jugadoresActivos} jugadores - x4 → x7`);
            console.log(`⚡ Bot detectó suficientes jugadores para experiencia x7`);
            
            // Simular timeout
            setTimeout(() => {
                cambioMapaEnProceso = false;
                console.log(`🔓 cambioMapaEnProceso = false`);
            }, 1000);
            
            return { success: true, changed: true, from: "biggerx5", to: "biggerx7", players: jugadoresActivos };
        } else {
            console.log(`❌ Error al cambiar de x5 a x7 con ${jugadoresActivos} jugadores`);
            cambioMapaEnProceso = false;
            return { success: false, error: "Falló cambio de mapa", players: jugadoresActivos };
        }
    }
    
    // Otros cambios...
    console.log(`ℹ️ No se necesita cambio de mapa (${jugadoresActivos} jugadores en ${mapaActual})`);
    return { success: true, changed: false, reason: "No cumple condiciones", currentMap: mapaActual, players: jugadoresActivos };
}

// Simular onGameStop
function simularOnGameStop() {
    console.log(`\n🎮 SIMULANDO onGameStop()...`);
    
    partidoEnCurso = false;
    console.log(`📊 partidoEnCurso = false`);
    
    // Verificar si hay estadísticas iniciadas
    if (estadisticasPartido && estadisticasPartido.iniciado) {
        console.log(`✅ estadisticasPartido.iniciado = true - Ejecutando verificación de cambio`);
        
        // Simular el timeout de 1000ms del código real
        setTimeout(() => {
            console.log(`⏰ Ejecutando verificarCambioMapaPostPartido() después de 1000ms...`);
            const resultado = verificarCambioMapaPostPartido();
            
            console.log(`\n📋 RESULTADO:`, resultado);
            
            if (resultado.success && resultado.changed) {
                console.log(`\n🎉 ¡ÉXITO! El cambio se ejecutó correctamente`);
            } else if (!resultado.success) {
                console.log(`\n❌ ¡FALLO! El cambio no se pudo completar`);
            } else {
                console.log(`\n⚠️ No se necesitó cambio en esta ocasión`);
            }
        }, 1000);
    } else {
        console.log(`❌ estadisticasPartido no iniciado - NO se ejecutará verificación`);
        console.log(`💡 PROBLEMA IDENTIFICADO: Las estadísticas de partido no están inicializadas`);
    }
}

// Función de testing principal
function ejecutarTest(numeroJugadores = 12, iniciarEstadisticas = true) {
    console.log(`${'='.repeat(80)}`);
    console.log(`🧪 TEST: Cambio x4 → x7 con ${numeroJugadores} jugadores`);
    console.log(`📊 Estadísticas iniciadas: ${iniciarEstadisticas}`);
    console.log(`${'='.repeat(80)}`);
    
    // Setup inicial
    room = createMockRoom(numeroJugadores);
    mapaActual = "biggerx5"; // Reset a x4
    cambioMapaEnProceso = false;
    partidoEnCurso = true;
    
    // Configurar estadísticas según parámetro
    if (iniciarEstadisticas) {
        estadisticasPartido = { 
            iniciado: true, 
            duracion: 0, 
            jugadores: {},
            tiempoEsperaSaque: 0
        };
    } else {
        estadisticasPartido = null;
    }
    
    console.log(`\n📋 SETUP INICIAL:`);
    console.log(`   Room: Creado con ${numeroJugadores} jugadores`);
    console.log(`   Mapa actual: ${mapaActual}`);
    console.log(`   Partido en curso: ${partidoEnCurso}`);
    console.log(`   Estadísticas iniciadas: ${estadisticasPartido ? estadisticasPartido.iniciado : false}`);
    
    // Mostrar jugadores
    const jugadores = room.getPlayerList();
    const activos = jugadores.filter(j => j.team === 1 || j.team === 2);
    console.log(`   Jugadores activos: ${activos.length}`);
    
    // Simular fin de partido
    console.log(`\n🏁 SIMULANDO FIN DE PARTIDO...`);
    simularOnGameStop();
    
    // Verificar resultado después de 2 segundos
    setTimeout(() => {
        console.log(`\n🔍 VERIFICACIÓN FINAL:`);
        console.log(`   Mapa final: ${mapaActual}`);
        console.log(`   Cambio exitoso: ${mapaActual === "biggerx7" ? "✅ SÍ" : "❌ NO"}`);
        
        if (mapaActual === "biggerx7") {
            console.log(`\n🎉 ¡TEST EXITOSO! El bot cambió correctamente a x7`);
        } else {
            console.log(`\n❌ ¡TEST FALLIDO! El bot no cambió a x7`);
            console.log(`💡 Posible causa: ${!estadisticasPartido || !estadisticasPartido.iniciado ? 'Estadísticas no inicializadas' : 'Otra causa'}`);
        }
        
        console.log(`\n${'='.repeat(80)}\n`);
    }, 2500);
}

// Función para testing múltiple
function ejecutarTestsCompletos() {
    console.log(`🚀 EJECUTANDO BATERÍA DE TESTS COMPLETA...\n`);
    
    const tests = [
        { jugadores: 11, stats: true, descripcion: "11 jugadores con stats - NO debe cambiar" },
        { jugadores: 12, stats: false, descripcion: "12 jugadores SIN stats - NO debe cambiar" },
        { jugadores: 12, stats: true, descripcion: "12 jugadores CON stats - SÍ debe cambiar" },
        { jugadores: 16, stats: true, descripcion: "16 jugadores CON stats - SÍ debe cambiar" }
    ];
    
    let testIndex = 0;
    
    function ejecutarSiguienteTest() {
        if (testIndex >= tests.length) {
            console.log(`🏁 TODOS LOS TESTS COMPLETADOS`);
            return;
        }
        
        const test = tests[testIndex];
        console.log(`\n🧪 TEST ${testIndex + 1}/${tests.length}: ${test.descripcion}`);
        
        ejecutarTest(test.jugadores, test.stats);
        testIndex++;
        
        // Ejecutar siguiente test después de 4 segundos
        setTimeout(ejecutarSiguienteTest, 4000);
    }
    
    ejecutarSiguienteTest();
}

// Función para debugging en vivo (si el bot ya está corriendo)
function debugBotEnVivo() {
    console.log(`🔍 MODO DEBUG EN VIVO - Verificando estado actual del bot...`);
    
    // Intentar acceder a las variables globales reales si existen
    try {
        if (typeof global !== 'undefined' && global.room) {
            console.log(`✅ Bot detectado - usando variables reales`);
            room = global.room;
            mapaActual = global.mapaActual || mapaActual;
            estadisticasPartido = global.estadisticasPartido || estadisticasPartido;
        } else {
            console.log(`⚠️ Bot no detectado - usando simulación`);
        }
        
        if (room && room.getPlayerList) {
            const jugadores = room.getPlayerList();
            const activos = jugadores.filter(j => j.team === 1 || j.team === 2);
            
            console.log(`📊 ESTADO ACTUAL DEL BOT:`);
            console.log(`   Mapa: ${mapaActual}`);
            console.log(`   Jugadores activos: ${activos.length}`);
            console.log(`   Estadísticas iniciadas: ${estadisticasPartido ? estadisticasPartido.iniciado : 'N/A'}`);
            
            if (mapaActual === "biggerx5" && activos.length >= 12) {
                console.log(`\n🎯 ¡CONDICIONES PARA CAMBIO CUMPLIDAS!`);
                console.log(`💡 Para forzar el cambio, ejecuta: verificarCambioMapaPostPartido()`);
            } else {
                console.log(`\nℹ️ Condiciones para cambio no cumplidas`);
            }
        }
    } catch (error) {
        console.log(`❌ Error en debug en vivo:`, error.message);
    }
}

// Exportar funciones para uso externo
module.exports = {
    ejecutarTest,
    ejecutarTestsCompletos,
    debugBotEnVivo,
    verificarCambioMapaPostPartido,
    cambiarMapa
};

// Si se ejecuta directamente
if (require.main === module) {
    console.log(`\n🛠️ OPCIONES DISPONIBLES:`);
    console.log(`1. Test simple: node test_vps_cambio_mapa.js simple`);
    console.log(`2. Tests completos: node test_vps_cambio_mapa.js completo`);
    console.log(`3. Debug en vivo: node test_vps_cambio_mapa.js debug`);
    console.log(`4. Test personalizado: const test = require('./test_vps_cambio_mapa'); test.ejecutarTest(12, true);`);
    
    const modo = process.argv[2] || 'simple';
    
    switch (modo) {
        case 'simple':
            ejecutarTest(12, true);
            break;
        case 'completo':
            ejecutarTestsCompletos();
            break;
        case 'debug':
            debugBotEnVivo();
            break;
        default:
            console.log(`❌ Modo desconocido: ${modo}`);
            process.exit(1);
    }
}
