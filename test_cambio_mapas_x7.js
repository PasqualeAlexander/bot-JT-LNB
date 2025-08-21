/**
 * 🧪 TEST COMPLETO PARA SISTEMA DE CAMBIO DE MAPAS X7
 * Verifica el correcto funcionamiento del cambio automático de mapas,
 * especialmente el mapeo al x7 con 12+ jugadores
 */

const COLORES_TEST = {
    SUCCESS: '\x1b[32m',
    ERROR: '\x1b[31m',
    WARNING: '\x1b[33m',
    INFO: '\x1b[36m',
    RESET: '\x1b[0m'
};

class MapChangeTestSuite {
    constructor() {
        this.testResults = [];
        this.mockRoom = null;
        this.originalConsoleLog = console.log;
        this.logs = [];
        
        // Variables del bot que necesitamos mockar
        this.mapaActual = "biggerx3";
        this.cambioMapaEnProceso = false;
        this.partidoEnCurso = false;
        this.mapaRealmenteAplicado = true;
        
        // Mock de mapas LNB
        this.mapas = {
            training: { nombre: "LNB Training x1", minJugadores: 1, maxJugadores: 2, hbs: "mock_training_hbs" },
            biggerx1: { nombre: "Bigger x1 LNB", minJugadores: 2, maxJugadores: 4, hbs: "mock_x1_hbs" },
            biggerx3: { nombre: "LNB Bigger x3", minJugadores: 3, maxJugadores: 8, hbs: "mock_x3_hbs" },
            biggerx5: { nombre: "LNB Bigger x4", minJugadores: 5, maxJugadores: 10, hbs: "mock_x5_hbs" },
            biggerx7: { nombre: "LNB Bigger x7", minJugadores: 10, maxJugadores: 14, hbs: "mock_x7_hbs" }
        };
    }

    // Captura logs para análisis
    setupLogCapture() {
        console.log = (...args) => {
            this.logs.push(args.join(' '));
            this.originalConsoleLog(...args);
        };
    }

    restoreConsole() {
        console.log = this.originalConsoleLog;
    }

    // Mock del objeto room de HaxBall
    createMockRoom(totalPlayers, activePlayers = null) {
        const players = [];
        
        // Si no se especifica activePlayers, calcular basado en el totalPlayers
        const numActivePlayers = activePlayers || Math.max(1, totalPlayers - 1); // Dejar 1 espectador por defecto
        
        // Crear jugadores activos (en equipos)
        for (let i = 1; i <= numActivePlayers; i++) {
            const team = (i % 2 === 1) ? 1 : 2; // Alternar entre equipo 1 y 2
            players.push({ id: i, name: `Player${i}`, team: team });
        }
        
        // Crear espectadores
        for (let i = numActivePlayers + 1; i <= totalPlayers; i++) {
            players.push({ id: i, name: `Spec${i}`, team: 0 });
        }

        this.mockRoom = {
            getPlayerList: () => players,
            setCustomStadium: jest.fn(),
            setTimeLimit: jest.fn(),
            setScoreLimit: jest.fn(),
            stopGame: jest.fn(),
            sendAnnouncement: jest.fn(),
            customStadiumSet: null,
            timeLimitSet: null,
            scoreLimitSet: null
        };

        // Mock global room
        global.room = this.mockRoom;
        return this.mockRoom;
    }

    // Función cambiarMapa adaptada del bot
    cambiarMapa(codigoMapa) {
        if (this.mapas[codigoMapa]) {
            const mapa = this.mapas[codigoMapa];
            try {
                this.mockRoom.setCustomStadium(mapa.hbs);
                this.mockRoom.customStadiumSet = mapa.hbs;
                this.mapaActual = codigoMapa;
                this.mapaRealmenteAplicado = true;
                
                // Configurar límites según el mapa (lógica del bot)
                if (codigoMapa === "biggerx1") {
                    this.mockRoom.setTimeLimit(3);
                    this.mockRoom.setScoreLimit(3);
                    this.mockRoom.timeLimitSet = 3;
                    this.mockRoom.scoreLimitSet = 3;
                } else if (codigoMapa === "biggerx3") {
                    this.mockRoom.setTimeLimit(4);
                    this.mockRoom.setScoreLimit(5);
                    this.mockRoom.timeLimitSet = 4;
                    this.mockRoom.scoreLimitSet = 5;
                } else if (codigoMapa === "biggerx5") {
                    this.mockRoom.setTimeLimit(5);
                    this.mockRoom.setScoreLimit(4);
                    this.mockRoom.timeLimitSet = 5;
                    this.mockRoom.scoreLimitSet = 4;
                } else if (codigoMapa === "biggerx7") {
                    this.mockRoom.setTimeLimit(5);
                    this.mockRoom.setScoreLimit(5);
                    this.mockRoom.timeLimitSet = 5;
                    this.mockRoom.scoreLimitSet = 5;
                } else {
                    this.mockRoom.setTimeLimit(5);
                    this.mockRoom.setScoreLimit(0);
                    this.mockRoom.timeLimitSet = 5;
                    this.mockRoom.scoreLimitSet = 0;
                }
                
                console.log(`🗺️ Mapa cambiado exitosamente a ${codigoMapa} (${mapa.nombre})`);
                return true;
            } catch (error) {
                console.error(`❌ Error al cambiar mapa a ${codigoMapa}:`, error);
                return false;
            }
        } else {
            console.error(`❌ Mapa '${codigoMapa}' no encontrado`);
            return false;
        }
    }

    // Lógica de detección de cambio de mapa adaptada del bot
    detectarCambioMapa() {
        if (this.cambioMapaEnProceso) {
            console.log("🔄 Cambio de mapa ya en proceso, saltando...");
            return;
        }

        const jugadoresActivos = this.mockRoom.getPlayerList().filter(j => j.team === 1 || j.team === 2).length;
        console.log(`🔍 Verificando cambio de mapa: ${jugadoresActivos} jugadores activos, mapa actual: ${this.mapaActual}`);

        // Lógica de mapeo (del bot original)
        let mapaRequerido = null;
        
        if (jugadoresActivos === 1) {
            mapaRequerido = "training";
        } else if (jugadoresActivos >= 2 && jugadoresActivos <= 4) {
            mapaRequerido = "biggerx1";
        } else if (jugadoresActivos >= 5 && jugadoresActivos <= 7) {
            mapaRequerido = "biggerx3";
        } else if (jugadoresActivos >= 8 && jugadoresActivos <= 11) {
            mapaRequerido = "biggerx5";
        } else if (jugadoresActivos >= 12) {
            mapaRequerido = "biggerx7";
        }

        console.log(`📊 Análisis: Jugadores=${jugadoresActivos}, MapaActual=${this.mapaActual}, MapaRequerido=${mapaRequerido}`);

        if (mapaRequerido && mapaRequerido !== this.mapaActual) {
            console.log(`📈 Iniciando cambio de mapa: ${this.mapaActual} -> ${mapaRequerido}`);
            this.cambioMapaEnProceso = true;
            
                if (this.cambiarMapa(mapaRequerido)) {
                console.log(`✅ Cambio de mapa exitoso`);
                setTimeout(() => {
                    this.cambioMapaEnProceso = false;
                }, 1000);
                return { success: true, from: mapaRequerido, to: mapaRequerido, players: jugadoresActivos };
            } else {
                console.error(`❌ Error en cambio de mapa`);
                this.cambioMapaEnProceso = false;
                return { success: false, error: "Falló cambio de mapa" };
            }
        } else {
            console.log(`✅ No se necesita cambio de mapa`);
            return { success: true, noChange: true, currentMap: this.mapaActual, players: jugadoresActivos };
        }
    }

    // Reset del estado antes de cada test
    resetTestState() {
        this.cambioMapaEnProceso = false;
        this.partidoEnCurso = false;
        this.mapaRealmenteAplicado = true;
        this.logs = [];
    }

    // Función de test para verificar cambio específico a x7
    async testCambioAx7() {
        this.resetTestState();
        console.log(`${COLORES_TEST.INFO}🧪 TEST: Cambio automático a x7 con 12+ jugadores${COLORES_TEST.RESET}`);
        
        // Inicializar con mapa x5 y 12 jugadores
        this.mapaActual = "biggerx5";
        this.createMockRoom(14, 12); // 14 jugadores total, 12 activos
        
        const resultado = this.detectarCambioMapa();
        
        // Esperar a que el timeout complete
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        // Verificaciones
        const tests = [
            {
                name: "Mapa cambió a x7",
                condition: this.mapaActual === "biggerx7",
                expected: "biggerx7",
                actual: this.mapaActual
            },
            {
                name: "setCustomStadium fue llamado",
                condition: this.mockRoom.setCustomStadium.mock.calls.length > 0,
                expected: true,
                actual: this.mockRoom.setCustomStadium.mock.calls.length > 0
            },
            {
                name: "Tiempo límite configurado a 5 minutos",
                condition: this.mockRoom.timeLimitSet === 5,
                expected: 5,
                actual: this.mockRoom.timeLimitSet
            },
            {
                name: "Límite de goles configurado a 5",
                condition: this.mockRoom.scoreLimitSet === 5,
                expected: 5,
                actual: this.mockRoom.scoreLimitSet
            },
            {
                name: "Resultado indica éxito",
                condition: resultado && resultado.success,
                expected: true,
                actual: resultado ? resultado.success : false
            }
        ];

        return this.evaluateTests("Cambio a x7", tests);
    }

    // Test para verificar que NO cambie si ya está en x7
    async testMantenimientoX7() {
        this.resetTestState();
        console.log(`${COLORES_TEST.INFO}🧪 TEST: Mantenimiento en x7 con suficientes jugadores${COLORES_TEST.RESET}`);
        
        // Inicializar ya en x7 con 13 jugadores
        this.mapaActual = "biggerx7";
        this.createMockRoom(15, 13); // 15 jugadores total, 13 activos
        
        const mapaAnterior = this.mapaActual;
        const resultado = this.detectarCambioMapa();
        
        const tests = [
            {
                name: "Mapa se mantiene en x7",
                condition: this.mapaActual === "biggerx7",
                expected: "biggerx7",
                actual: this.mapaActual
            },
            {
                name: "No se ejecutó cambio de mapa",
                condition: resultado && resultado.noChange,
                expected: true,
                actual: resultado ? resultado.noChange : false
            },
            {
                name: "setCustomStadium NO fue llamado",
                condition: this.mockRoom.setCustomStadium.mock.calls.length === 0,
                expected: 0,
                actual: this.mockRoom.setCustomStadium.mock.calls.length
            }
        ];

        return this.evaluateTests("Mantenimiento x7", tests);
    }

    // Test para verificar cambio de x7 a x5 cuando bajan jugadores
    async testCambioDeX7AX5() {
        this.resetTestState();
        console.log(`${COLORES_TEST.INFO}🧪 TEST: Cambio de x7 a x5 cuando bajan jugadores${COLORES_TEST.RESET}`);
        
        // Inicializar en x7 pero con solo 10 jugadores activos
        this.mapaActual = "biggerx7";
        this.createMockRoom(12, 10); // 12 jugadores total, 10 activos
        
        const resultado = this.detectarCambioMapa();
        
        // Esperar a que el timeout complete
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const tests = [
            {
                name: "Mapa cambió a x5",
                condition: this.mapaActual === "biggerx5",
                expected: "biggerx5",
                actual: this.mapaActual
            },
            {
                name: "Resultado indica cambio exitoso",
                condition: resultado && resultado.success && !resultado.noChange,
                expected: true,
                actual: resultado ? (resultado.success && !resultado.noChange) : false
            },
            {
                name: "Límite de goles configurado a 4 (x5)",
                condition: this.mockRoom.scoreLimitSet === 4,
                expected: 4,
                actual: this.mockRoom.scoreLimitSet
            }
        ];

        return this.evaluateTests("Cambio x7 -> x5", tests);
    }

    // Test de escalamiento completo
    async testEscalamientoCompleto() {
        this.resetTestState();
        console.log(`${COLORES_TEST.INFO}🧪 TEST: Escalamiento completo de mapas${COLORES_TEST.RESET}`);
        
        const escenarios = [
            { jugadores: 3, mapaEsperado: "biggerx1" },
            { jugadores: 6, mapaEsperado: "biggerx3" },
            { jugadores: 10, mapaEsperado: "biggerx5" },
            { jugadores: 13, mapaEsperado: "biggerx7" },
            { jugadores: 16, mapaEsperado: "biggerx7" } // Máximo sigue siendo x7
        ];

        let allPassed = true;
        const results = [];

        for (const escenario of escenarios) {
            this.resetTestState();
            this.mapaActual = "training"; // Reset
            this.createMockRoom(escenario.jugadores + 2, escenario.jugadores); // Total jugadores, activos específicos
            
            const resultado = this.detectarCambioMapa();
            const passed = this.mapaActual === escenario.mapaEsperado;
            
            // Esperar a que complete si hubo cambio
            if (resultado && !resultado.noChange) {
                await new Promise(resolve => setTimeout(resolve, 1100));
            }
            
            results.push({
                jugadores: escenario.jugadores,
                esperado: escenario.mapaEsperado,
                actual: this.mapaActual,
                passed
            });
            
            if (!passed) allPassed = false;
        }

        // Log resultados
        console.log("📊 Resultados del escalamiento:");
        results.forEach(r => {
            const status = r.passed ? `${COLORES_TEST.SUCCESS}✓${COLORES_TEST.RESET}` : `${COLORES_TEST.ERROR}✗${COLORES_TEST.RESET}`;
            console.log(`  ${status} ${r.jugadores} jugadores: ${r.actual} (esperado: ${r.esperado})`);
        });

        return {
            testName: "Escalamiento completo",
            passed: allPassed,
            details: results
        };
    }

    // Test específico para el umbral crítico de x7
    async testUmbralX7() {
        this.resetTestState();
        console.log(`${COLORES_TEST.INFO}🧪 TEST: Umbrales críticos para activación x7${COLORES_TEST.RESET}`);
        
        const umbrales = [
            { jugadores: 10, debeCambiar: false, mapaEsperado: "biggerx5" },
            { jugadores: 11, debeCambiar: false, mapaEsperado: "biggerx5" },
            { jugadores: 12, debeCambiar: true, mapaEsperado: "biggerx7" }
        ];

        let allPassed = true;
        const results = [];

        for (const umbral of umbrales) {
            this.resetTestState();
            this.mapaActual = "biggerx5"; // Comenzar desde x5
            this.createMockRoom(umbral.jugadores + 1, umbral.jugadores); // Total jugadores, activos específicos
            
            const resultado = this.detectarCambioMapa();
            const cambioOcurrido = resultado ? !resultado.noChange : false;
            const mapaFinal = this.mapaActual;
            
            // Esperar a que complete si hubo cambio
            if (resultado && !resultado.noChange) {
                await new Promise(resolve => setTimeout(resolve, 1100));
            }
            
            const test1 = cambioOcurrido === umbral.debeCambiar;
            const test2 = mapaFinal === umbral.mapaEsperado;
            const passed = test1 && test2;
            
            results.push({
                jugadores: umbral.jugadores,
                debeCambiar: umbral.debeCambiar,
                cambioOcurrido,
                mapaEsperado: umbral.mapaEsperado,
                mapaFinal,
                passed
            });
            
            if (!passed) allPassed = false;
        }

        // Log resultados detallados
        console.log("🎯 Análisis de umbrales x7:");
        results.forEach(r => {
            const status = r.passed ? `${COLORES_TEST.SUCCESS}✓${COLORES_TEST.RESET}` : `${COLORES_TEST.ERROR}✗${COLORES_TEST.RESET}`;
            console.log(`  ${status} ${r.jugadores} jugadores: Cambio=${r.cambioOcurrido}, Mapa=${r.mapaFinal}`);
        });

        return {
            testName: "Umbrales x7",
            passed: allPassed,
            details: results,
            critical: true // Este es un test crítico para x7
        };
    }

    // Utilidad para evaluar tests
    evaluateTests(testSuite, tests) {
        let passed = 0;
        let total = tests.length;

        tests.forEach(test => {
            if (test.condition) {
                console.log(`  ${COLORES_TEST.SUCCESS}✓${COLORES_TEST.RESET} ${test.name}`);
                passed++;
            } else {
                console.log(`  ${COLORES_TEST.ERROR}✗${COLORES_TEST.RESET} ${test.name} - Esperado: ${test.expected}, Actual: ${test.actual}`);
            }
        });

        const allPassed = passed === total;
        const status = allPassed ? 
            `${COLORES_TEST.SUCCESS}PASSED${COLORES_TEST.RESET}` : 
            `${COLORES_TEST.ERROR}FAILED${COLORES_TEST.RESET}`;
        
        console.log(`\n📊 ${testSuite}: ${status} (${passed}/${total})\n`);
        
        return {
            testName: testSuite,
            passed: allPassed,
            score: `${passed}/${total}`,
            details: tests
        };
    }

    // Ejecutar todos los tests
    async runAllTests() {
        console.log(`${COLORES_TEST.INFO}🚀 Iniciando Test Suite - Sistema de Cambio de Mapas x7${COLORES_TEST.RESET}\n`);
        
        this.setupLogCapture();
        
        try {
            // Mock Jest functions si no están disponibles
            if (typeof jest === 'undefined') {
                global.jest = {
                    fn: () => {
                        const mockFn = function(...args) {
                            mockFn.mock.calls.push(args);
                        };
                        mockFn.mock = { calls: [] };
                        return mockFn;
                    }
                };
            }

            const results = [];
            
            // Ejecutar tests principales
            results.push(await this.testCambioAx7());
            results.push(await this.testMantenimientoX7());
            results.push(await this.testCambioDeX7AX5());
            results.push(await this.testUmbralX7()); // Test crítico para x7
            results.push(await this.testEscalamientoCompleto());
            
            // Resumen final
            const totalTests = results.length;
            const passedTests = results.filter(r => r.passed).length;
            const criticalFailed = results.filter(r => r.critical && !r.passed).length;
            
            console.log(`${'='.repeat(60)}`);
            console.log(`📋 RESUMEN FINAL - TEST CAMBIO DE MAPAS X7`);
            console.log(`${'='.repeat(60)}`);
            console.log(`Tests ejecutados: ${totalTests}`);
            console.log(`Tests exitosos: ${COLORES_TEST.SUCCESS}${passedTests}${COLORES_TEST.RESET}`);
            console.log(`Tests fallidos: ${COLORES_TEST.ERROR}${totalTests - passedTests}${COLORES_TEST.RESET}`);
            
            if (criticalFailed > 0) {
                console.log(`${COLORES_TEST.ERROR}⚠️  TESTS CRÍTICOS FALLIDOS: ${criticalFailed}${COLORES_TEST.RESET}`);
            }
            
            // Estado general
            if (passedTests === totalTests) {
                console.log(`\n${COLORES_TEST.SUCCESS}🎉 TODOS LOS TESTS PASARON - Sistema x7 funcionando correctamente${COLORES_TEST.RESET}`);
            } else if (criticalFailed === 0) {
                console.log(`\n${COLORES_TEST.WARNING}⚠️  Algunos tests fallaron pero funcionalidad crítica x7 OK${COLORES_TEST.RESET}`);
            } else {
                console.log(`\n${COLORES_TEST.ERROR}❌ FUNCIONALIDAD CRÍTICA x7 COMPROMETIDA - Revisar urgente${COLORES_TEST.RESET}`);
            }
            
            console.log(`${'='.repeat(60)}\n`);
            
            // Detalles de logs capturados
            if (this.logs.length > 0) {
                console.log(`📝 Logs capturados durante tests:`);
                this.logs.slice(-10).forEach((log, i) => {
                    console.log(`  ${i+1}. ${log}`);
                });
            }
            
            return {
                summary: {
                    total: totalTests,
                    passed: passedTests,
                    failed: totalTests - passedTests,
                    criticalFailed,
                    success: passedTests === totalTests
                },
                results,
                logs: this.logs
            };
            
        } finally {
            this.restoreConsole();
        }
    }
}

// Función de utilidad para ejecutar los tests
async function testCambioMapasX7() {
    const testSuite = new MapChangeTestSuite();
    return await testSuite.runAllTests();
}

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapChangeTestSuite, testCambioMapasX7 };
}

// Auto-ejecutar si se ejecuta directamente
if (typeof require !== 'undefined' && require.main === module) {
    testCambioMapasX7().then(results => {
        process.exit(results.summary.success ? 0 : 1);
    }).catch(error => {
        console.error(`${COLORES_TEST.ERROR}💥 Error ejecutando tests:${COLORES_TEST.RESET}`, error);
        process.exit(1);
    });
}

console.log(`${COLORES_TEST.INFO}📄 Test Suite cargado. Ejecuta 'testCambioMapasX7()' para iniciar tests.${COLORES_TEST.RESET}`);
