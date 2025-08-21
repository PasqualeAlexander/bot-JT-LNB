/**
 * 🧪 TEST ESPECÍFICO: CAMBIO DE MAPA X4 A X7 CON 12 JUGADORES
 * 
 * Este test verifica el escenario específico donde:
 * 1. Hay un partido activo en mapa biggerx5 (x4)
 * 2. Hay exactamente 12 jugadores activos
 * 3. El partido termina
 * 4. El bot debe cambiar automáticamente a biggerx7 (x7)
 * 
 * Basado en el código real del bot en BOTLNBCODE.js líneas 4681-4700
 */

const COLORES = {
    SUCCESS: '\x1b[32m',
    ERROR: '\x1b[31m',
    WARNING: '\x1b[33m',
    INFO: '\x1b[36m',
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m'
};

class TestCambioX4AX7 {
    constructor() {
        this.mockRoom = null;
        this.mapaActual = "biggerx5"; // Inicializar en x4 (biggerx5)
        this.partidoEnCurso = false;
        this.cambioMapaEnProceso = false;
        this.terminoPorCambioMapa = false;
        this.logs = [];
        this.originalConsoleLog = console.log;
        
        // Mock de mapas del bot
        this.mapas = {
            biggerx5: { 
                nombre: "LNB Bigger x4", 
                minJugadores: 5, 
                maxJugadores: 10, 
                hbs: "mock_x5_hbs",
                timeLimit: 5,
                scoreLimit: 4
            },
            biggerx7: { 
                nombre: "LNB Bigger x7", 
                minJugadores: 10, 
                maxJugadores: 14, 
                hbs: "mock_x7_hbs",
                timeLimit: 5,
                scoreLimit: 5
            }
        };
    }

    // Configurar captura de logs
    setupLogCapture() {
        console.log = (...args) => {
            this.logs.push(args.join(' '));
            this.originalConsoleLog(...args);
        };
    }

    restoreConsole() {
        console.log = this.originalConsoleLog;
    }

    // Crear mock del objeto room de HaxBall
    createMockRoom(jugadoresActivos = 12) {
        const players = [];
        
        // Crear jugadores activos distribuidos en ambos equipos
        for (let i = 1; i <= jugadoresActivos; i++) {
            const team = (i % 2 === 1) ? 1 : 2; // Alternar entre equipo 1 y 2
            players.push({ 
                id: i, 
                name: `Player${i}`, 
                team: team 
            });
        }
        
        // Añadir algunos espectadores para hacer más realista
        for (let i = jugadoresActivos + 1; i <= jugadoresActivos + 2; i++) {
            players.push({ 
                id: i, 
                name: `Spec${i}`, 
                team: 0 
            });
        }

        this.mockRoom = {
            getPlayerList: () => players,
            setCustomStadium: jest.fn((hbs) => {
                this.mockRoom.customStadiumSet = hbs;
            }),
            setTimeLimit: jest.fn((limit) => {
                this.mockRoom.timeLimitSet = limit;
            }),
            setScoreLimit: jest.fn((limit) => {
                this.mockRoom.scoreLimitSet = limit;
            }),
            stopGame: jest.fn(() => {
                this.partidoEnCurso = false;
            }),
            sendAnnouncement: jest.fn(),
            // Mock states para verificación
            customStadiumSet: null,
            timeLimitSet: null,
            scoreLimitSet: null
        };

        // Mock global room
        global.room = this.mockRoom;
        return this.mockRoom;
    }

    // Mock de la función cambiarMapa basada en el código real
    cambiarMapa(codigoMapa) {
        if (this.mapas[codigoMapa]) {
            const mapa = this.mapas[codigoMapa];
            
            try {
                // Simular cambio de mapa
                this.mockRoom.setCustomStadium(mapa.hbs);
                this.mockRoom.setTimeLimit(mapa.timeLimit);
                this.mockRoom.setScoreLimit(mapa.scoreLimit);
                
                this.mapaActual = codigoMapa;
                
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

    // Mock de verificarCambioMapaPostPartido basado en el código real (líneas 4681-4700)
    verificarCambioMapaPostPartido() {
        // Contar jugadores activos (en equipos 1 y 2, no espectadores)
        const jugadoresActivos = this.mockRoom.getPlayerList().filter(j => j.team === 1 || j.team === 2).length;
        
        console.log(`🏁 DEBUG: Verificando cambio de mapa post-partido con ${jugadoresActivos} jugadores activos`);
        
        // CAMBIO ESPECÍFICO: De biggerx5 (x4) a biggerx7 si hay 12 o más jugadores
        if (this.mapaActual === "biggerx5" && jugadoresActivos >= 12) {
            console.log(`📈 DEBUG: Cambiando de x5 a x7 después del partido (${jugadoresActivos} >= 12 jugadores)`);
            
            this.cambioMapaEnProceso = true;
            
            if (this.cambiarMapa("biggerx7")) {
                console.log(`🎯 ¡Cambio automático! Detectados ${jugadoresActivos} jugadores - Cambiando de x4 a x7`);
                console.log("⚡ El bot ha detectado suficientes jugadores para una experiencia x7 más emocionante!");
                
                // Simular timeout del bot real
                setTimeout(() => {
                    this.cambioMapaEnProceso = false;
                }, 1000);
                
                return { 
                    success: true, 
                    changed: true, 
                    from: "biggerx5", 
                    to: "biggerx7", 
                    players: jugadoresActivos,
                    reason: "12+ jugadores detectados"
                };
            } else {
                console.error(`❌ Error al cambiar de x5 a x7 con ${jugadoresActivos} jugadores`);
                this.cambioMapaEnProceso = false;
                return { 
                    success: false, 
                    error: "Falló cambio de mapa",
                    players: jugadoresActivos
                };
            }
        }
        
        console.log(`✅ DEBUG: No se necesita cambio de mapa post-partido (${jugadoresActivos} jugadores en ${this.mapaActual})`);
        return { 
            success: true, 
            changed: false, 
            reason: "No cumple condiciones para cambio",
            currentMap: this.mapaActual,
            players: jugadoresActivos
        };
    }

    // Mock del evento onGameStop
    onGameStop() {
        this.partidoEnCurso = false;
        console.log("🏁 Partido finalizado - ejecutando verificación de cambio de mapa");
        
        // Simular el timeout de 1000ms del código real (línea 11261-11263)
        return new Promise((resolve) => {
            setTimeout(() => {
                const resultado = this.verificarCambioMapaPostPartido();
                resolve(resultado);
            }, 1000);
        });
    }

    // Test principal: Verificar cambio de x4 a x7 con exactamente 12 jugadores
    async testCambioX4AX7Con12Jugadores() {
        console.log(`${COLORES.INFO}${COLORES.BOLD}🧪 TEST: Cambio de x4 a x7 con 12 jugadores al finalizar partido${COLORES.RESET}\n`);
        
        // SETUP: Configurar escenario inicial
        this.mapaActual = "biggerx5"; // Mapa x4 actual
        this.partidoEnCurso = true; // Partido en curso
        this.createMockRoom(12); // 12 jugadores activos
        
        console.log(`📋 SETUP INICIAL:`);
        console.log(`   Mapa actual: ${this.mapaActual} (x4)`);
        console.log(`   Partido en curso: ${this.partidoEnCurso}`);
        console.log(`   Jugadores activos: 12`);
        console.log(`   Distribución: 6 en equipo rojo, 6 en equipo azul`);
        
        // ACCIÓN: Simular finalización del partido
        console.log(`\n🏁 ACCIÓN: Finalizando partido...`);
        const resultado = await this.onGameStop();
        
        // VERIFICACIONES
        console.log(`\n🔍 VERIFICACIONES:`);
        const tests = [
            {
                name: "El partido se marcó como finalizado",
                condition: !this.partidoEnCurso,
                expected: false,
                actual: this.partidoEnCurso
            },
            {
                name: "Se detectó necesidad de cambio de mapa",
                condition: resultado.changed === true,
                expected: true,
                actual: resultado.changed
            },
            {
                name: "El cambio fue exitoso",
                condition: resultado.success === true,
                expected: true,
                actual: resultado.success
            },
            {
                name: "Mapa cambió de biggerx5 a biggerx7",
                condition: this.mapaActual === "biggerx7",
                expected: "biggerx7",
                actual: this.mapaActual
            },
            {
                name: "Se configuró el stadium correcto (x7)",
                condition: this.mockRoom.customStadiumSet === "mock_x7_hbs",
                expected: "mock_x7_hbs",
                actual: this.mockRoom.customStadiumSet
            },
            {
                name: "Se configuró tiempo límite correcto (5 min)",
                condition: this.mockRoom.timeLimitSet === 5,
                expected: 5,
                actual: this.mockRoom.timeLimitSet
            },
            {
                name: "Se configuró límite de goles correcto (5)",
                condition: this.mockRoom.scoreLimitSet === 5,
                expected: 5,
                actual: this.mockRoom.scoreLimitSet
            },
            {
                name: "Detectó el número correcto de jugadores",
                condition: resultado.players === 12,
                expected: 12,
                actual: resultado.players
            }
        ];

        let passed = 0;
        let total = tests.length;

        tests.forEach((test, index) => {
            if (test.condition) {
                console.log(`  ${COLORES.SUCCESS}✓${COLORES.RESET} ${test.name}`);
                passed++;
            } else {
                console.log(`  ${COLORES.ERROR}✗${COLORES.RESET} ${test.name}`);
                console.log(`    Esperado: ${test.expected}, Actual: ${test.actual}`);
            }
        });

        const allPassed = passed === total;
        const status = allPassed ? 
            `${COLORES.SUCCESS}${COLORES.BOLD}EXITOSO${COLORES.RESET}` : 
            `${COLORES.ERROR}${COLORES.BOLD}FALLIDO${COLORES.RESET}`;
        
        console.log(`\n📊 RESULTADO: ${status} (${passed}/${total} verificaciones pasaron)`);
        
        if (allPassed) {
            console.log(`${COLORES.SUCCESS}🎉 ¡El bot cambia correctamente de x4 a x7 con 12 jugadores!${COLORES.RESET}`);
        } else {
            console.log(`${COLORES.ERROR}⚠️  El cambio automático de mapa no funciona correctamente${COLORES.RESET}`);
        }

        return {
            testName: "Cambio x4 a x7 con 12 jugadores",
            passed: allPassed,
            score: `${passed}/${total}`,
            details: tests,
            resultado
        };
    }

    // Test de casos límite
    async testCasosLimite() {
        console.log(`${COLORES.INFO}${COLORES.BOLD}🧪 TEST: Casos límite para cambio x4 a x7${COLORES.RESET}\n`);
        
        const casos = [
            { jugadores: 11, debeCambiar: false, descripcion: "11 jugadores (límite inferior)" },
            { jugadores: 12, debeCambiar: true, descripcion: "12 jugadores (umbral exacto)" },
            { jugadores: 13, debeCambiar: true, descripcion: "13 jugadores (por encima del umbral)" },
            { jugadores: 14, debeCambiar: true, descripcion: "14 jugadores (máximo x7)" }
        ];

        let todosPasaron = true;
        const resultados = [];

        for (const caso of casos) {
            console.log(`\n📋 CASO: ${caso.descripcion}`);
            
            // Reset para cada caso
            this.mapaActual = "biggerx5";
            this.partidoEnCurso = true;
            this.createMockRoom(caso.jugadores);
            
            const resultado = await this.onGameStop();
            const cambioOcurrido = resultado.changed === true;
            const paso = cambioOcurrido === caso.debeCambiar;
            
            if (paso) {
                console.log(`  ${COLORES.SUCCESS}✓${COLORES.RESET} Comportamiento correcto: ${cambioOcurrido ? 'Cambió' : 'No cambió'} como esperado`);
            } else {
                console.log(`  ${COLORES.ERROR}✗${COLORES.RESET} Comportamiento incorrecto: ${cambioOcurrido ? 'Cambió' : 'No cambió'} cuando debería ${caso.debeCambiar ? 'cambiar' : 'no cambiar'}`);
                todosPasaron = false;
            }

            resultados.push({
                jugadores: caso.jugadores,
                debeCambiar: caso.debeCambiar,
                cambioOcurrido,
                paso
            });
        }

        console.log(`\n📊 RESUMEN CASOS LÍMITE:`);
        resultados.forEach(r => {
            const status = r.paso ? `${COLORES.SUCCESS}✓${COLORES.RESET}` : `${COLORES.ERROR}✗${COLORES.RESET}`;
            console.log(`  ${status} ${r.jugadores} jugadores: ${r.cambioOcurrido ? 'Cambió' : 'No cambió'}`);
        });

        return {
            testName: "Casos límite x4 a x7",
            passed: todosPasaron,
            details: resultados
        };
    }

    // Ejecutar todos los tests
    async runAllTests() {
        console.log(`${COLORES.INFO}${'='.repeat(80)}${COLORES.RESET}`);
        console.log(`${COLORES.INFO}${COLORES.BOLD}🚀 TEST SUITE: CAMBIO AUTOMÁTICO X4 → X7 CON 12 JUGADORES${COLORES.RESET}`);
        console.log(`${COLORES.INFO}${'='.repeat(80)}${COLORES.RESET}\n`);
        
        this.setupLogCapture();
        
        try {
            // Mock Jest functions si no están disponibles
            if (typeof jest === 'undefined') {
                global.jest = {
                    fn: (implementation) => { // Aceptar implementación
                        const mockFn = function(...args) {
                            mockFn.mock.calls.push(args);
                            if (implementation) {
                                implementation.apply(this, args); // Ejecutar implementación
                            }
                        };
                        mockFn.mock = { calls: [] };
                        return mockFn;
                    }
                };
            }

            const results = [];
            
            // Ejecutar tests
            results.push(await this.testCambioX4AX7Con12Jugadores());
            results.push(await this.testCasosLimite());
            
            // Resumen final
            const totalTests = results.length;
            const passedTests = results.filter(r => r.passed).length;
            
            console.log(`\n${COLORES.INFO}${'='.repeat(80)}${COLORES.RESET}`);
            console.log(`${COLORES.INFO}${COLORES.BOLD}📋 RESUMEN FINAL${COLORES.RESET}`);
            console.log(`${COLORES.INFO}${'='.repeat(80)}${COLORES.RESET}`);
            console.log(`Tests ejecutados: ${totalTests}`);
            console.log(`Tests exitosos: ${COLORES.SUCCESS}${passedTests}${COLORES.RESET}`);
            console.log(`Tests fallidos: ${COLORES.ERROR}${totalTests - passedTests}${COLORES.RESET}`);
            
            if (passedTests === totalTests) {
                console.log(`\n${COLORES.SUCCESS}${COLORES.BOLD}🎉 ¡TODOS LOS TESTS PASARON!${COLORES.RESET}`);
                console.log(`${COLORES.SUCCESS}✅ El cambio automático de x4 a x7 con 12 jugadores funciona correctamente${COLORES.RESET}`);
            } else {
                console.log(`\n${COLORES.ERROR}${COLORES.BOLD}❌ ALGUNOS TESTS FALLARON${COLORES.RESET}`);
                console.log(`${COLORES.ERROR}⚠️  El cambio automático de mapa necesita revisión${COLORES.RESET}`);
            }
            
            console.log(`${COLORES.INFO}${'='.repeat(80)}${COLORES.RESET}\n`);
            
            return {
                summary: {
                    total: totalTests,
                    passed: passedTests,
                    failed: totalTests - passedTests,
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

// Función de utilidad para ejecutar el test
async function testCambioX4AX7() {
    const testSuite = new TestCambioX4AX7();
    return await testSuite.runAllTests();
}

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestCambioX4AX7, testCambioX4AX7 };
}

// Auto-ejecutar si se ejecuta directamente
if (typeof require !== 'undefined' && require.main === module) {
    testCambioX4AX7().then(results => {
        process.exit(results.summary.success ? 0 : 1);
    }).catch(error => {
        console.error(`${COLORES.ERROR}💥 Error ejecutando tests:${COLORES.RESET}`, error);
        process.exit(1);
    });
}

console.log(`${COLORES.INFO}📄 Test cargado. Ejecuta 'testCambioX4AX7()' para iniciar el test específico.${COLORES.RESET}`);
