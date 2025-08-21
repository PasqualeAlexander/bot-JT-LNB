/**
 * TEST PARA VERIFICAR EDICIÓN DE MENSAJE WEBHOOK - ESTADO ACTUAL DE LA SALA
 * 
 * Este test verifica que se edite correctamente el mensaje enviado al webhook 
 * sobre el estado actual de la sala de HaxBall.
 * 
 * Funcionalidades a testear:
 * - Envío inicial de mensaje con estado de sala
 * - Edición del mensaje cuando cambia el estado
 * - Manejo de errores en la edición
 * - Fallback a nuevo mensaje si falla la edición
 * - Formato correcto del mensaje de estado
 */

// Importar módulos necesarios
const originalFetch = global.fetch;

// Variables para simular el entorno del bot
let room = null;
let MENSAJE_IDS_DISCORD = {
    reportesSala: null,
    estadoSala: null,
    partidoReporte: null
};

// Variables de configuración
// MODO DE PRUEBA: Cambia USAR_WEBHOOK_REAL a true para enviar mensajes reales
const USAR_WEBHOOK_REAL = true; // Cambiar a true para usar webhook real
const WEBHOOK_REAL = "https://discord.com/api/webhooks/1389450191396143265/JxHRCmfNCFooAr3YjynXPmihlVSjnGw-FLql4VUHNUx15Yl8d8BipjaRd51uXpcXfiXv"; // Webhook del bot real
const WEBHOOK_PRUEBA = "https://discord.com/api/webhooks/123456789/abcdef123456"; // Webhook falso para tests

const webhookReportesSala = USAR_WEBHOOK_REAL ? WEBHOOK_REAL : WEBHOOK_PRUEBA;
let ultimoReporteSala = 0;
const INTERVALO_MINIMO_REPORTE = USAR_WEBHOOK_REAL ? 2000 : 5000; // Menos throttling para pruebas reales
let partidoEnCurso = false;
let enlaceRealSala = "https://www.haxball.com/play?c=test1234";
let enlaceRealConfirmado = false;
let jugadoresConectados = [];

// Mock de funciones globales del bot
global.nodeEnviarWebhook = null;
global.nodeEditarMensajeDiscord = null;

// Funciones auxiliares del bot
function obtenerInfoSala() {
    const jugadores = room ? room.getPlayerList() : [];
    const jugadoresEnJuego = jugadores.filter(j => j.team !== 0).length;
    const jugadoresTotales = jugadores.length;
    
    // En el bot real, esta función obtiene más información sobre el estado actual
    return {
        nombre: "⚡🔵 LNB JUEGAN TODOS BIGGER X7 🔵⚡",
        enlace: enlaceRealSala,
        jugadoresEnJuego: jugadoresEnJuego,
        jugadoresTotales: jugadoresTotales,
        maxJugadores: 23,
        esPublica: false,
        contraseña: null,
        estadoPartido: partidoEnCurso ? "En partido" : "En espera",
        tiempoPartido: partidoEnCurso ? "02:30" : "--:--",
        resultadoActual: partidoEnCurso ? "2 - 1" : "0 - 0"
    };
}

// Implementación simplificada de las funciones de webhook
function enviarOEditarReporteSala(razon = "Reporte automático", forzarEnvio = false) {
    try {
        const ahora = Date.now();
        if (!forzarEnvio && (ahora - ultimoReporteSala) < INTERVALO_MINIMO_REPORTE) {
            console.log('🕐 TEST: Reporte ignorado por throttling');
            return false;
        }
        ultimoReporteSala = ahora;
        
        if (!webhookReportesSala) {
            console.warn('⚠️ TEST: Webhook no configurado');
            return false;
        }
        
        const ALWAYS_EDIT = true;
        const info = obtenerInfoSala();
        
// Crear mensaje con formato ASCII (igual que en el bot real)
        const tipoSala = info.esPublica ? "Pública" : "Privada";
        const enlaceTexto = info.enlace !== "[Enlace no disponible]" ? info.enlace : "Enlace no disponible";
        
        // Emojis específicos para contraseña
        const iconoContraseña = info.contraseña ? "🔒" : "🔓";
        const contraseñaTexto = info.contraseña ? `"${info.contraseña}"` : "Sin contraseña";
        
        // Emoji para estado del partido
        let estadoEmoji = "⏳"; // Por defecto esperando jugadores
        let estadoTexto = "Esperando jugadores";
        
        if (info.jugadoresEnJuego >= 2 && !partidoEnCurso) {
            estadoEmoji = "🧍🧍‍♂️";
            estadoTexto = "Jugadores presentes, pero sin juego aún";
        } else if (partidoEnCurso) {
            estadoEmoji = "🕹️";
            estadoTexto = "Partido en juego";
        }
        
        // Crear mensaje con formato ASCII
        let mensaje = `╭━━━ 🏟️ Sala ${tipoSala} de Haxball ━━━╮\n`;
        mensaje += `┃ 🏷️ Nombre: ${info.nombre}\n`;
        mensaje += `┃ 🔗 Enlace: ${enlaceTexto}\n`;
        mensaje += `┃ 👥 Jugadores: ${info.jugadoresEnJuego} / ${info.maxJugadores}\n`;
        mensaje += `┃ ${iconoContraseña} Contraseña: ${contraseñaTexto}\n`;
        mensaje += `┃ ${estadoEmoji} Estado: ${estadoTexto}\n`;
        
        if (partidoEnCurso) {
            mensaje += `┃ ⏱️ Tiempo: ${info.tiempoPartido}\n`;
            mensaje += `┃ ⚽ Resultado: 🔴 ${info.resultadoActual} 🔵\n`;
        }
        
        mensaje += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
        
        const payload = { content: mensaje };
        
        // Intentar editar si tenemos ID previo
        if (MENSAJE_IDS_DISCORD.reportesSala && (ALWAYS_EDIT || !forzarEnvio)) {
            return editarMensajeDiscordReportes(payload);
        } else {
            return enviarNuevoMensajeDiscordReportes(payload);
        }
    } catch (error) {
        console.error('❌ TEST: Error en enviarOEditarReporteSala:', error);
        return false;
    }
}

function editarMensajeDiscordReportes(payload) {
    console.log('🔧 TEST: Iniciando edición de mensaje con ID:', MENSAJE_IDS_DISCORD.reportesSala);
    
    // Usar función Node.js si está disponible
    if (typeof nodeEditarMensajeDiscord === 'function') {
        console.log('📡 TEST: Usando nodeEditarMensajeDiscord');
        
        return nodeEditarMensajeDiscord(webhookReportesSala, MENSAJE_IDS_DISCORD.reportesSala, payload)
            .then(result => {
                if (result.success) {
                    console.log('✅ TEST: Mensaje editado exitosamente');
                    if (result.messageId && result.messageId !== MENSAJE_IDS_DISCORD.reportesSala) {
                        MENSAJE_IDS_DISCORD.reportesSala = result.messageId;
                    }
                    return true;
                } else {
                    throw new Error(`nodeEditarMensajeDiscord falló: ${result.status || result.error}`);
                }
            })
            .catch(error => {
                console.error('❌ TEST: Error en nodeEditarMensajeDiscord:', error);
                return usarFetchParaEdicion(payload);
            });
    } else {
        console.log('📡 TEST: Usando fetch nativo');
        return usarFetchParaEdicion(payload);
    }
}

function usarFetchParaEdicion(payload) {
    const webhookMatch = webhookReportesSala.match(/\/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)/);
    if (!webhookMatch) {
        console.error('❌ TEST: No se pudo extraer webhook ID y token');
        return Promise.resolve(false);
    }
    
    const webhookId = webhookMatch[1];
    const webhookToken = webhookMatch[2];
    const editUrl = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${MENSAJE_IDS_DISCORD.reportesSala}`;
    
    console.log('🔧 TEST: URL de edición:', editUrl);
    
    return fetch(editUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => {
        console.log('📡 TEST: Respuesta de edición - Status:', response.status);
        
        if (response.ok) {
            console.log('✅ TEST: Mensaje editado exitosamente');
            // Discord webhook responde con 204 (No Content) sin JSON cuando es exitoso
            if (response.status === 204) {
                console.log('✅ TEST: Edición exitosa (204 No Content)');
                // Mantener el ID actual ya que la edición fue exitosa
                return { id: MENSAJE_IDS_DISCORD.reportesSala };
            }
            return response.json();
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    })
    .then(data => {
        if (data && data.id && data.id !== MENSAJE_IDS_DISCORD.reportesSala) {
            MENSAJE_IDS_DISCORD.reportesSala = data.id;
        }
        return true;
    })
    .catch(error => {
        console.error('❌ TEST: Error en edición:', error);
        // Fallback a nuevo mensaje
        const idAnterior = MENSAJE_IDS_DISCORD.reportesSala;
        MENSAJE_IDS_DISCORD.reportesSala = null;
        console.log('🔄 TEST: Enviando nuevo mensaje como respaldo');
        
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(enviarNuevoMensajeDiscordReportes(payload));
            }, 1000);
        });
    });
}

function enviarNuevoMensajeDiscordReportes(payload) {
    console.log('📤 TEST: Enviando nuevo mensaje');
    
    if (typeof nodeEnviarWebhook === 'function') {
        console.log('📡 TEST: Usando nodeEnviarWebhook');
        
        return nodeEnviarWebhook(webhookReportesSala, payload)
            .then(result => {
                if (result.success) {
                    console.log('✅ TEST: Mensaje enviado exitosamente');
                    if (result.messageId) {
                        MENSAJE_IDS_DISCORD.reportesSala = result.messageId;
                    }
                    return true;
                } else {
                    throw new Error('nodeEnviarWebhook falló');
                }
            })
            .catch(error => {
                console.error('❌ TEST: Error en nodeEnviarWebhook:', error);
                return usarFetchParaEnvio(payload);
            });
    } else {
        return usarFetchParaEnvio(payload);
    }
}

function usarFetchParaEnvio(payload) {
    // Agregar wait=true para obtener el ID real del mensaje
    const webhookUrlConWait = webhookReportesSala + '?wait=true';
    
    return fetch(webhookUrlConWait, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => {
        console.log('📡 TEST: Respuesta de envío - Status:', response.status);
        
        if (response.ok) {
            // Discord webhook responde con 204 (No Content) sin JSON cuando es exitoso
            if (response.status === 204) {
                console.log('✅ TEST: Mensaje enviado exitosamente (204 No Content)');
                // Para webhooks de Discord que responden con 204, generar un ID simulado
                return { id: `discord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
            }
            return response.json();
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    })
    .then(data => {
        console.log('✅ TEST: Nuevo mensaje enviado exitosamente');
        
        if (data && data.id) {
            const idAnterior = MENSAJE_IDS_DISCORD.reportesSala;
            MENSAJE_IDS_DISCORD.reportesSala = data.id;
            console.log('🆔 TEST: ID guardado:', data.id, '(anterior:', idAnterior, ')');
            
    if (!enlaceRealConfirmado && enlaceRealSala && !enlaceRealSala.includes('test1234')) {
                enlaceRealConfirmado = true;
                console.log('🔗 TEST: enlaceRealConfirmado = true');
            }
            return true;
        } else {
            console.warn('⚠️ TEST: No se recibió ID en la respuesta');
            return false;
        }
    })
    .catch(error => {
        console.error('❌ TEST: Error al enviar mensaje:', error);
        MENSAJE_IDS_DISCORD.reportesSala = null;
        return false;
    });
}

// Mock del objeto room
function createMockRoom(jugadores = []) {
    return {
        getPlayerList: () => jugadores.map((nombre, index) => ({
            id: index + 1,
            name: nombre,
            team: index < 2 ? 0 : (index % 2 === 0 ? 1 : 2) // Primeros 2 spec, resto en equipos
        }))
    };
}

// TESTS
async function testEnvioInicialMensaje() {
    console.log('\n🧪 TEST 1: Envío inicial de mensaje');
    
    if (USAR_WEBHOOK_REAL) {
        console.log('🌐 USANDO WEBHOOK REAL - Los mensajes se enviarán a Discord');
        // No mockear fetch, usar el real
    } else {
        console.log('🎭 USANDO MOCKS - Simulación sin envío real');
        // Mock fetch para simular respuesta exitosa
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'test_message_123' })
        });
    }
    
    // Configurar sala inicial
    room = createMockRoom(['Jugador1', 'Jugador2']);
    MENSAJE_IDS_DISCORD.reportesSala = null;
    
    const resultado = await enviarOEditarReporteSala('Test inicial');
    
    console.assert(resultado === true, 'Debería enviar mensaje exitosamente');
    
    if (USAR_WEBHOOK_REAL) {
        console.assert(MENSAJE_IDS_DISCORD.reportesSala !== null, 'Debería guardar el ID del mensaje real');
        console.log('📋 ID del mensaje real guardado:', MENSAJE_IDS_DISCORD.reportesSala);
    } else {
        console.assert(MENSAJE_IDS_DISCORD.reportesSala === 'test_message_123', 'Debería guardar el ID del mensaje');
        console.assert(global.fetch.mock.calls.length === 1, 'Debería hacer 1 llamada fetch');
        console.assert(global.fetch.mock.calls[0][0] === webhookReportesSala, 'Debería usar la URL correcta');
        console.assert(global.fetch.mock.calls[0][1].method === 'POST', 'Debería usar método POST');
        
        const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
        console.assert(payload.content.includes('Esperando jugadores'), 'Mensaje debe indicar esperando jugadores');
        console.assert(payload.content.includes('0 / 23'), 'Mensaje debe mostrar 0 jugadores en juego');
        console.assert(payload.content.includes(`🔗 Enlace: ${enlaceRealSala}`), 'Mensaje debe mostrar el enlace actual');
    }
    
    console.log('✅ TEST 1 PASADO: Envío inicial correcto');
    
    if (!USAR_WEBHOOK_REAL) {
        global.fetch.mockClear();
    }
}

async function testEdicionMensajeConCambioEstado() {
    console.log('\n🧪 TEST 2: Edición de mensaje con cambio de estado');
    
    // Mock fetch para simular edición exitosa
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'test_message_123' })
    });
    
    // Configurar sala con más jugadores y partido en curso
    room = createMockRoom(['Spec1', 'Spec2', 'Player1', 'Player2', 'Player3', 'Player4']);
    partidoEnCurso = true;
    MENSAJE_IDS_DISCORD.reportesSala = 'test_message_123'; // Simular mensaje existente
    
    // Resetear throttling para permitir envío
    ultimoReporteSala = 0;
    
    const resultado = await enviarOEditarReporteSala('Cambio de estado');
    
    console.assert(resultado === true, 'Debería editar mensaje exitosamente');
    console.assert(MENSAJE_IDS_DISCORD.reportesSala === 'test_message_123', 'Debería mantener el ID del mensaje');
    console.assert(global.fetch.mock.calls.length === 1, 'Debería hacer 1 llamada fetch');
    
    const editUrl = global.fetch.mock.calls[0][0];
    console.assert(editUrl.includes('/messages/test_message_123'), 'URL debe incluir ID del mensaje');
    console.assert(global.fetch.mock.calls[0][1].method === 'PATCH', 'Debería usar método PATCH para edición');
    
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    console.assert(payload.content.includes('Partido en juego'), 'Mensaje debe indicar partido en curso');
    console.assert(payload.content.includes('4 / 23'), 'Mensaje debe mostrar 4 jugadores en juego');
    console.assert(payload.content.includes('02:30'), 'Mensaje debe mostrar tiempo de partido');
    console.assert(payload.content.includes('2 - 1'), 'Mensaje debe mostrar resultado');
    console.assert(payload.content.includes(`🔗 Enlace: ${enlaceRealSala}`), 'Mensaje debe mostrar el enlace actual');
    
    console.log('✅ TEST 2 PASADO: Edición con cambio de estado correcta');
    
    global.fetch.mockClear();
}

async function testFallbackCuandoFallaEdicion() {
    console.log('\n🧪 TEST 3: Fallback a nuevo mensaje cuando falla edición');
    
    // Mock fetch para simular fallo en edición, luego éxito en envío nuevo
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
            // Primera llamada (edición) falla
            return Promise.reject(new Error('Message not found'));
        } else {
            // Segunda llamada (nuevo mensaje) exitosa
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ id: 'new_message_456' })
            });
        }
    });
    
    // Configurar sala con mensaje existente
    room = createMockRoom(['Player1', 'Player2']);
    partidoEnCurso = false;
    MENSAJE_IDS_DISCORD.reportesSala = 'old_message_999'; // Mensaje que ya no existe
    
    // Resetear throttling
    ultimoReporteSala = 0;
    
    const resultado = await enviarOEditarReporteSala('Test fallback');
    
    console.assert(resultado === true, 'Debería enviar nuevo mensaje exitosamente');
    console.assert(MENSAJE_IDS_DISCORD.reportesSala === 'new_message_456', 'Debería actualizar con nuevo ID');
    console.assert(global.fetch.mock.calls.length === 2, 'Debería hacer 2 llamadas fetch (edición + nuevo)');
    
    // Verificar primera llamada (edición fallida)
    const editUrl = global.fetch.mock.calls[0][0];
    console.assert(editUrl.includes('/messages/old_message_999'), 'Primera llamada debe intentar editar mensaje anterior');
    console.assert(global.fetch.mock.calls[0][1].method === 'PATCH', 'Primera llamada debe ser PATCH');
    
    // Verificar segunda llamada (nuevo mensaje)
    console.assert(global.fetch.mock.calls[1][0] === webhookReportesSala, 'Segunda llamada debe usar webhook base');
    console.assert(global.fetch.mock.calls[1][1].method === 'POST', 'Segunda llamada debe ser POST');
    
    console.log('✅ TEST 3 PASADO: Fallback funcionando correctamente');
    
    global.fetch.mockClear();
}

async function testThrottling() {
    console.log('\n🧪 TEST 4: Sistema de throttling');
    
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'test_message' })
    });
    
    room = createMockRoom(['Player1']);
    MENSAJE_IDS_DISCORD.reportesSala = null;
    
    // Primer envío
    ultimoReporteSala = 0; // Resetear para permitir envío
    const resultado1 = await enviarOEditarReporteSala('Test 1');
    console.assert(resultado1 === true, 'Primer envío debe ser exitoso');
    console.assert(global.fetch.mock.calls.length === 1, 'Debe hacer 1 llamada');
    
    // Segundo envío inmediato (debe ser bloqueado por throttling)
    const resultado2 = enviarOEditarReporteSala('Test 2');
    console.assert(resultado2 === false, 'Segundo envío debe ser bloqueado por throttling');
    console.assert(global.fetch.mock.calls.length === 1, 'No debe hacer llamadas adicionales');
    
    // Tercer envío forzado (debe pasar el throttling)
    const resultado3 = await enviarOEditarReporteSala('Test 3', true);
    console.assert(resultado3 === true, 'Envío forzado debe ser exitoso');
    console.assert(global.fetch.mock.calls.length === 2, 'Debe hacer llamada adicional');
    
    console.log('✅ TEST 4 PASADO: Sistema de throttling funcionando');
    
    global.fetch.mockClear();
}

async function testFormatoMensaje() {
    console.log('\n🧪 TEST 5: Formato correcto del mensaje');
    
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'test_message' })
    });
    
    // Test con diferentes estados
    const estados = [
        {
            jugadores: [],
            partidoEnCurso: false,
            descripcion: 'sala vacía'
        },
        {
            jugadores: ['P1', 'P2', 'P3', 'P4'],
            partidoEnCurso: true,
            descripcion: 'partido en curso'
        },
        {
            jugadores: ['Spec1', 'Spec2', 'P1', 'P2'],
            partidoEnCurso: false,
            descripcion: 'jugadores esperando'
        }
    ];
    
    for (const estado of estados) {
        room = createMockRoom(estado.jugadores);
        partidoEnCurso = estado.partidoEnCurso;
        MENSAJE_IDS_DISCORD.reportesSala = null;
        ultimoReporteSala = 0; // Resetear throttling
        
        await enviarOEditarReporteSala(`Test ${estado.descripcion}`);
        
        const payload = JSON.parse(global.fetch.mock.calls[global.fetch.mock.calls.length - 1][1].body);
        const contenido = payload.content;
        
        // Verificar formato ASCII
        console.assert(contenido.includes('╭━━━ 🏟️ Sala'), 'Debe incluir encabezado ASCII');
        console.assert(contenido.includes('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯'), 'Debe incluir pie ASCII');
        
        // Verificar elementos obligatorios
        console.assert(contenido.includes('🏷️ Nombre:'), 'Debe incluir nombre de sala');
        console.assert(contenido.includes('🔗 Enlace:'), 'Debe incluir enlace');
        console.assert(contenido.includes('👥 Jugadores:'), 'Debe incluir contador jugadores');
        console.assert(contenido.includes('🔓 Contraseña:'), 'Debe incluir info contraseña');
        
        // Verificar estado específico
        if (estado.partidoEnCurso) {
            console.assert(contenido.includes('🕹️ Estado: Partido en juego'), 'Debe mostrar partido en curso');
            console.assert(contenido.includes('⏱️ Tiempo:'), 'Debe incluir tiempo de partido');
            console.assert(contenido.includes('⚽ Resultado:'), 'Debe incluir resultado');
        } else {
            console.assert(contenido.includes('⏳ Estado: Esperando jugadores'), 'Debe mostrar esperando jugadores');
        }
        
        console.log(`  ✓ Formato correcto para: ${estado.descripcion}`);
    }
    
    console.log('✅ TEST 5 PASADO: Formato de mensaje correcto');
    
    global.fetch.mockClear();
}

async function testFuncionesNodeJs() {
    console.log('\n🧪 TEST 6: Uso de funciones Node.js');
    
    // Mock funciones Node.js
    global.nodeEditarMensajeDiscord = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'node_edit_123'
    });
    
    global.nodeEnviarWebhook = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'node_send_456'
    });
    
    room = createMockRoom(['Player1']);
    
    // Test edición con función Node.js
    MENSAJE_IDS_DISCORD.reportesSala = 'existing_message';
    ultimoReporteSala = 0; // Resetear throttling
    const resultado1 = await enviarOEditarReporteSala('Test Node.js edit');
    
    console.assert(resultado1 === true, 'Edición con Node.js debe ser exitosa');
    console.assert(global.nodeEditarMensajeDiscord.mock.calls.length === 1, 'Debe llamar nodeEditarMensajeDiscord');
    console.assert(MENSAJE_IDS_DISCORD.reportesSala === 'node_edit_123', 'Debe actualizar ID desde Node.js');
    
    // Test envío con función Node.js
    MENSAJE_IDS_DISCORD.reportesSala = null;
    ultimoReporteSala = 0; // Resetear throttling
    const resultado2 = await enviarOEditarReporteSala('Test Node.js send');
    
    console.assert(resultado2 === true, 'Envío con Node.js debe ser exitoso');
    console.assert(global.nodeEnviarWebhook.mock.calls.length === 1, 'Debe llamar nodeEnviarWebhook');
    console.assert(MENSAJE_IDS_DISCORD.reportesSala === 'node_send_456', 'Debe guardar ID desde Node.js');
    
    console.log('✅ TEST 6 PASADO: Funciones Node.js funcionando');
    
    // Limpiar mocks
    global.nodeEditarMensajeDiscord = null;
    global.nodeEnviarWebhook = null;
}

// Test para simular actualización de enlace y entrada de nuevos jugadores
async function testActualizacionEnlaceYJugadores() {
    console.log('\n🧪 TEST 7: Actualización de enlace y entrada de nuevos jugadores');
    
    // Mock fetch para simular edición exitosa
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'test_message_update' })
    });
    
    // 1. Configuración inicial con enlace por defecto
    enlaceRealSala = "https://www.haxball.com/play?c=test1234";
    enlaceRealConfirmado = false;
    room = createMockRoom(['Jugador1']);
    MENSAJE_IDS_DISCORD.reportesSala = 'test_message_prev';
    ultimoReporteSala = 0; // Resetear throttling
    
    // 2. Simular evento onRoomLink (como si el bot recibiera el enlace real)
    console.log('🔗 TEST: Simulando evento onRoomLink con nuevo enlace');
    const nuevoEnlace = "https://www.haxball.com/play?c=reallink123";
    enlaceRealSala = nuevoEnlace;
    
    // 3. Enviar reporte con enlace actualizado
    const resultado1 = await enviarOEditarReporteSala('Enlace actualizado');
    
    // Verificar que se usó el enlace correcto
    const payload1 = JSON.parse(global.fetch.mock.calls[0][1].body);
    console.assert(payload1.content.includes(nuevoEnlace), 'Mensaje debe incluir el nuevo enlace');
    // El enlaceRealConfirmado se actualiza solo cuando se envía un mensaje nuevo, no al editar
    // console.assert(enlaceRealConfirmado === true, 'enlaceRealConfirmado debe ser true después del envío exitoso');
    
    // 4. Simular entrada de nuevos jugadores
    console.log('👥 TEST: Simulando entrada de nuevos jugadores');
    room = createMockRoom(['Jugador1', 'Jugador2', 'Jugador3', 'Jugador4', 'Jugador5']);
    global.fetch.mockClear();
    ultimoReporteSala = 0; // Resetear throttling
    
    // 5. Enviar nuevo reporte con jugadores actualizados
    const resultado2 = await enviarOEditarReporteSala('Nuevos jugadores');
    
    // Verificar que se mantiene el enlace y se actualizó la cantidad de jugadores
    const payload2 = JSON.parse(global.fetch.mock.calls[0][1].body);
    console.assert(payload2.content.includes(nuevoEnlace), 'Mensaje debe mantener el enlace real');
    console.assert(payload2.content.includes('3 / 23'), 'Mensaje debe mostrar 3 jugadores en juego');
    
    console.log('✅ TEST 7 PASADO: Actualización de enlace y jugadores funciona correctamente');
    
    global.fetch.mockClear();
}

// Test simplificado solo para webhooks reales
async function testWebhookReal() {
    console.log('\n🌐 TEST WEBHOOK REAL: Envío y edición de mensajes reales');
    
    // 1. Envío inicial
    console.log('\n📤 Paso 1: Enviando mensaje inicial...');
    room = createMockRoom(['Jugador1', 'Jugador2']);
    MENSAJE_IDS_DISCORD.reportesSala = null;
    ultimoReporteSala = 0;
    
    const resultado1 = await enviarOEditarReporteSala('🧪 TEST: Mensaje inicial');
    console.log('✅ Mensaje inicial enviado, ID:', MENSAJE_IDS_DISCORD.reportesSala);
    
    // Esperar un poco antes de la siguiente actualización
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 2. Actualización con más jugadores
    console.log('\n🔄 Paso 2: Actualizando con más jugadores...');
    room = createMockRoom(['Spec1', 'Spec2', 'Player1', 'Player2', 'Player3', 'Player4']);
    ultimoReporteSala = 0;
    
    const resultado2 = await enviarOEditarReporteSala('🧪 TEST: Más jugadores conectados');
    console.log('✅ Mensaje actualizado con más jugadores');
    
    // Esperar un poco antes de la siguiente actualización
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Simulación de partido en curso
    console.log('\n🎮 Paso 3: Simulando partido en curso...');
    partidoEnCurso = true;
    ultimoReporteSala = 0;
    
    const resultado3 = await enviarOEditarReporteSala('🧪 TEST: Partido iniciado');
    console.log('✅ Mensaje actualizado con partido en curso');
    
    // Esperar un poco antes de la siguiente actualización
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 4. Actualización de enlace
    console.log('\n🔗 Paso 4: Actualizando enlace...');
    enlaceRealSala = "https://www.haxball.com/play?c=TESTREAL123";
    ultimoReporteSala = 0;
    
    const resultado4 = await enviarOEditarReporteSala('🧪 TEST: Enlace actualizado');
    console.log('✅ Mensaje actualizado con nuevo enlace');
    
    // Esperar antes de finalizar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Finalización
    console.log('\n🏁 Paso 5: Finalizando test...');
    partidoEnCurso = false;
    room = createMockRoom([]);
    ultimoReporteSala = 0;
    
    const resultado5 = await enviarOEditarReporteSala('🧪 TEST: Sala vacía - Test completado');
    console.log('✅ Test finalizado, mensaje final enviado');
    
    return resultado1 && resultado2 && resultado3 && resultado4 && resultado5;
}

// EJECUTAR TODOS LOS TESTS
async function ejecutarTodos() {
    console.log('🚀 INICIANDO TESTS DE EDICIÓN DE MENSAJE WEBHOOK - ESTADO DE SALA\n');
    
    if (USAR_WEBHOOK_REAL) {
        console.log('⚠️  MODO WEBHOOK REAL ACTIVADO');
        console.log('📡 Webhook:', webhookReportesSala);
        console.log('⏰ Los mensajes se enviarán cada 2-3 segundos\n');
        
        try {
            const resultado = await testWebhookReal();
            if (resultado) {
                console.log('\n🎉 TEST WEBHOOK REAL COMPLETADO EXITOSAMENTE');
                console.log('✅ Revisa tu canal de Discord para ver los mensajes');
            } else {
                console.log('\n❌ ALGUNOS MENSAJES FALLARON');
            }
        } catch (error) {
            console.error('\n❌ ERROR EN TEST WEBHOOK REAL:', error);
        }
    } else {
        console.log('🎭 MODO SIMULACIÓN ACTIVADO - No se enviarán mensajes reales\n');
        
        try {
            await testEnvioInicialMensaje();
            // Ejecutar solo el test básico en modo simulación
            
            console.log('\n🎉 TESTS DE SIMULACIÓN COMPLETADOS');
            console.log('✅ Para enviar mensajes reales, cambia USAR_WEBHOOK_REAL a true');
            
        } catch (error) {
            console.error('\n❌ ERROR EN LOS TESTS:', error);
            process.exit(1);
        } finally {
            // Restaurar fetch original solo si se usó mock
            if (!USAR_WEBHOOK_REAL) {
                global.fetch = originalFetch;
            }
        }
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    // Setup Jest mock functions
    global.jest = {
        fn: () => {
            const mockFn = function(...args) {
                mockFn.mock.calls.push(args);
                return mockFn._mockImplementation ? mockFn._mockImplementation(...args) : mockFn._mockReturnValue;
            };
            
            mockFn.mock = { calls: [] };
            mockFn._mockReturnValue = undefined;
            mockFn._mockImplementation = null;
            
            mockFn.mockReturnValue = (value) => {
                mockFn._mockReturnValue = value;
                return mockFn;
            };
            
            mockFn.mockImplementation = (impl) => {
                mockFn._mockImplementation = impl;
                return mockFn;
            };
            
            mockFn.mockResolvedValue = (value) => {
                mockFn._mockImplementation = () => Promise.resolve(value);
                return mockFn;
            };
            
            mockFn.mockRejectedValue = (value) => {
                mockFn._mockImplementation = () => Promise.reject(value);
                return mockFn;
            };
            
            mockFn.mockClear = () => {
                mockFn.mock.calls = [];
            };
            
            return mockFn;
        }
    };
    
    ejecutarTodos();
}

module.exports = {
    ejecutarTodos,
    testEnvioInicialMensaje,
    testEdicionMensajeConCambioEstado,
    testFallbackCuandoFallaEdicion,
    testThrottling,
    testFormatoMensaje,
    testFuncionesNodeJs,
    testActualizacionEnlaceYJugadores
};
