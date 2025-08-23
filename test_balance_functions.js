// TEST PARA FUNCIONES DE BALANCE DE EQUIPOS
// Este archivo simula diferentes escenarios para probar la lógica

// Mock de room para testing
const mockRoom = {
    players: [],
    setPlayerTeam: function(playerId, team) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.team = team;
            console.log(`✅ MOCK: Movido ${player.name} al equipo ${team}`);
        }
    },
    getPlayerList: function() {
        return this.players;
    }
};

// Mock de variables globales necesarias
const jugadoresAFK = new Set();
const movimientoIniciadorPorBot = new Set();

// Mock de función esBot
function esBot(jugador) {
    return jugador.name.includes('Bot') || jugador.name.includes('BOT');
}

// Mock de función anunciarGeneral
function anunciarGeneral(mensaje, color, estilo) {
    console.log(`📢 ${mensaje}`);
}

// COPIA DE LAS FUNCIONES A TESTEAR
function obtenerCantidadJugadoresPorEquipo() {
    if (typeof mockRoom === 'undefined' || !mockRoom || !mockRoom.getPlayerList) {
        console.warn('⚠️ Room no disponible para obtener jugadores');
        return { rojo: 0, azul: 0, espectadores: 0, total: 0 };
    }
    
    const jugadores = mockRoom.getPlayerList();
    const jugadoresRojo = jugadores.filter(j => j.team === 1);
    const jugadoresAzul = jugadores.filter(j => j.team === 2);
    const espectadores = jugadores.filter(j => j.team === 0);
    
    return {
        rojo: jugadoresRojo.length,
        azul: jugadoresAzul.length,
        espectadores: espectadores.length,
        total: jugadores.length,
        jugadoresRojo: jugadoresRojo,
        jugadoresAzul: jugadoresAzul,
        diferencia: Math.abs(jugadoresRojo.length - jugadoresAzul.length)
    };
}

function balanceAutomaticoContinuo() {
    if (typeof mockRoom === 'undefined' || !mockRoom || !mockRoom.getPlayerList) {
        return;
    }
    
    const equipos = obtenerCantidadJugadoresPorEquipo();
    const { rojo, azul, diferencia, jugadoresRojo, jugadoresAzul } = equipos;
    
    console.log(`🔄 DEBUG balanceAutomaticoContinuo: Rojo=${rojo}, Azul=${azul}, Diferencia=${diferencia}`);
    
    // Si no hay jugadores en equipos, no hacer nada
    if (rojo === 0 && azul === 0) {
        console.log(`❌ DEBUG: No hay jugadores en equipos para balancear`);
        return;
    }
    
    // CONDICIÓN PRINCIPAL: Balancear siempre que la diferencia sea mayor a 1 jugador
    if (diferencia > 1) {
        console.log(`⚖️ DEBUG: Balance necesario - diferencia de ${diferencia} jugadores`);
        
        // Determinar equipo con más jugadores y equipo con menos jugadores
        const equipoConMas = rojo > azul ? jugadoresRojo : jugadoresAzul;
        const equipoConMenos = rojo > azul ? 2 : 1; // 1=rojo, 2=azul
        const equipoConMasNombre = rojo > azul ? 'ROJO' : 'AZUL';
        const equipoConMenosNombre = rojo > azul ? 'AZUL' : 'ROJO';
        
        // Filtrar candidatos válidos (excluir bots y jugadores AFK)
        const candidatos = equipoConMas.filter(jugador => {
            if (esBot(jugador)) {
                console.log(`🚫 DEBUG: Excluyendo bot ${jugador.name} del balance`);
                return false;
            }
            if (jugadoresAFK.has(jugador.id)) {
                console.log(`🚫 DEBUG: Excluyendo ${jugador.name} del balance (marcado como AFK)`);
                return false;
            }
            return true;
        });
        
        if (candidatos.length === 0) {
            console.log(`⚠️ DEBUG: No hay candidatos válidos para balance automático continuo`);
            return;
        }
        
        // Calcular cuántos jugadores mover para equilibrar
        const jugadoresAMover = Math.floor(diferencia / 2);
        
        console.log(`⚖️ DEBUG: Moviendo ${jugadoresAMover} jugador(es) del equipo ${equipoConMasNombre} al ${equipoConMenosNombre}`);
        
        // Mover jugadores aleatoriamente para mantener fairness
        for (let i = 0; i < jugadoresAMover && i < candidatos.length; i++) {
            const jugadorAleatorio = candidatos[Math.floor(Math.random() * candidatos.length)];
            
            // Remover el jugador seleccionado de candidatos para evitar moverlo dos veces
            const index = candidatos.indexOf(jugadorAleatorio);
            if (index > -1) {
                candidatos.splice(index, 1);
            }
            
            // Marcar movimiento como iniciado por el bot
            movimientoIniciadorPorBot.add(jugadorAleatorio.id);
            
            // Mover el jugador
            mockRoom.setPlayerTeam(jugadorAleatorio.id, equipoConMenos);
            
            // Anunciar el movimiento
            const equipoDestinoEmoji = equipoConMenos === 1 ? '🔴' : '🔵';
            anunciarGeneral(`⚖️ Balance: ${jugadorAleatorio.name} → ${equipoDestinoEmoji} ${equipoConMenosNombre}`, "87CEEB", "bold");
            
            console.log(`✅ DEBUG: Movido ${jugadorAleatorio.name} al equipo ${equipoConMenosNombre}`);
        }
        
        // Verificar el resultado después del balance
        setTimeout(() => {
            const equiposPostBalance = obtenerCantidadJugadoresPorEquipo();
            console.log(`📊 DEBUG Post-balance: Rojo=${equiposPostBalance.rojo}, Azul=${equiposPostBalance.azul}, Diferencia=${equiposPostBalance.diferencia}`);
        }, 100);
    } else {
        console.log(`✅ DEBUG: Equipos balanceados (diferencia ${diferencia} ≤ 1)`);
    }
}

// FUNCIONES DE PRUEBA
function crearJugador(id, name, team) {
    return { id, name, team };
}

function resetearSala() {
    mockRoom.players = [];
    jugadoresAFK.clear();
    movimientoIniciadorPorBot.clear();
    console.log('\n🔄 SALA RESETEADA\n');
}

function mostrarEstadoSala() {
    const equipos = obtenerCantidadJugadoresPorEquipo();
    console.log(`📊 ESTADO ACTUAL: Rojo=${equipos.rojo}, Azul=${equipos.azul}, Espectadores=${equipos.espectadores}, Total=${equipos.total}, Diferencia=${equipos.diferencia}`);
    console.log('Jugadores Rojo:', equipos.jugadoresRojo.map(j => j.name).join(', '));
    console.log('Jugadores Azul:', equipos.jugadoresAzul.map(j => j.name).join(', '));
}

// TESTS ESPECÍFICOS
function testEscenario4v2() {
    console.log('🧪 TEST: Escenario 4v2 → 3v3');
    resetearSala();
    
    // Crear jugadores: 4 en rojo, 2 en azul
    mockRoom.players = [
        crearJugador(1, 'Player1', 1),
        crearJugador(2, 'Player2', 1),
        crearJugador(3, 'Player3', 1),
        crearJugador(4, 'Player4', 1),
        crearJugador(5, 'Player5', 2),
        crearJugador(6, 'Player6', 2)
    ];
    
    console.log('ANTES del balance:');
    mostrarEstadoSala();
    
    balanceAutomaticoContinuo();
    
    setTimeout(() => {
        console.log('DESPUÉS del balance:');
        mostrarEstadoSala();
        console.log('---\n');
    }, 200);
}

function testEscenario5v1() {
    console.log('🧪 TEST: Escenario 5v1 → 3v3');
    resetearSala();
    
    // Crear jugadores: 5 en rojo, 1 en azul
    mockRoom.players = [
        crearJugador(1, 'Player1', 1),
        crearJugador(2, 'Player2', 1),
        crearJugador(3, 'Player3', 1),
        crearJugador(4, 'Player4', 1),
        crearJugador(5, 'Player5', 1),
        crearJugador(6, 'Player6', 2)
    ];
    
    console.log('ANTES del balance:');
    mostrarEstadoSala();
    
    balanceAutomaticoContinuo();
    
    setTimeout(() => {
        console.log('DESPUÉS del balance:');
        mostrarEstadoSala();
        console.log('---\n');
    }, 200);
}

function testConBots() {
    console.log('🧪 TEST: Con Bots (no deberían moverse)');
    resetearSala();
    
    // Crear jugadores: 4 en rojo (2 bots), 2 en azul
    mockRoom.players = [
        crearJugador(1, 'Player1', 1),
        crearJugador(2, 'Bot1', 1),
        crearJugador(3, 'Player3', 1),
        crearJugador(4, 'Bot2', 1),
        crearJugador(5, 'Player5', 2),
        crearJugador(6, 'Player6', 2)
    ];
    
    console.log('ANTES del balance:');
    mostrarEstadoSala();
    
    balanceAutomaticoContinuo();
    
    setTimeout(() => {
        console.log('DESPUÉS del balance:');
        mostrarEstadoSala();
        console.log('---\n');
    }, 200);
}

function testConAFK() {
    console.log('🧪 TEST: Con jugadores AFK (no deberían moverse)');
    resetearSala();
    
    // Crear jugadores: 4 en rojo, 2 en azul
    mockRoom.players = [
        crearJugador(1, 'Player1', 1),
        crearJugador(2, 'Player2', 1),
        crearJugador(3, 'Player3', 1),
        crearJugador(4, 'Player4', 1),
        crearJugador(5, 'Player5', 2),
        crearJugador(6, 'Player6', 2)
    ];
    
    // Marcar Player2 y Player3 como AFK
    jugadoresAFK.add(2);
    jugadoresAFK.add(3);
    
    console.log('ANTES del balance (Player2 y Player3 marcados como AFK):');
    mostrarEstadoSala();
    
    balanceAutomaticoContinuo();
    
    setTimeout(() => {
        console.log('DESPUÉS del balance:');
        mostrarEstadoSala();
        console.log('---\n');
    }, 200);
}

function testEquilibrado() {
    console.log('🧪 TEST: Equipos ya equilibrados (3v3)');
    resetearSala();
    
    // Crear jugadores: 3 en rojo, 3 en azul
    mockRoom.players = [
        crearJugador(1, 'Player1', 1),
        crearJugador(2, 'Player2', 1),
        crearJugador(3, 'Player3', 1),
        crearJugador(4, 'Player4', 2),
        crearJugador(5, 'Player5', 2),
        crearJugador(6, 'Player6', 2)
    ];
    
    console.log('ANTES del balance:');
    mostrarEstadoSala();
    
    balanceAutomaticoContinuo();
    
    setTimeout(() => {
        console.log('DESPUÉS del balance:');
        mostrarEstadoSala();
        console.log('---\n');
    }, 200);
}

// EJECUTAR TODOS LOS TESTS
console.log('🚀 INICIANDO TESTS DE BALANCE AUTOMÁTICO\n');

testEscenario4v2();
setTimeout(() => testEscenario5v1(), 500);
setTimeout(() => testConBots(), 1000);
setTimeout(() => testConAFK(), 1500);
setTimeout(() => testEquilibrado(), 2000);

setTimeout(() => {
    console.log('✅ TESTS COMPLETADOS');
}, 2500);
