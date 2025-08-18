/* 
* 🔗 INTEGRACIÓN DEL SISTEMA VIP EN EL BOT PRINCIPAL
* Ejemplo de cómo integrar el sistema VIP y Ultra VIP en tu bot existente
*/

const VIPSystem = require('./vip_system');
const VIPCommands = require('./vip_commands');

class BotVIPIntegration {
    constructor(database) {
        this.db = database;
        this.vipSystem = new VIPSystem(database);
        this.vipCommands = new VIPCommands(database);
        
        // Configurar limpieza automática de VIPs expirados cada hora
        setInterval(() => {
            this.vipSystem.cleanupExpiredVIPs().catch(console.error);
        }, 60 * 60 * 1000); // 1 hora
    }

    // === INTEGRACIÓN EN EL CHAT DEL JUEGO ===

    async handlePlayerMessage(playerName, message, playerAuth = null) {
        // Verificar si es un comando VIP
        const vipResponse = await this.vipCommands.processVIPCommand(message, playerName, playerAuth);
        
        if (vipResponse) {
            return vipResponse; // Retornar respuesta del comando VIP
        }

        // Si no es comando VIP, continuar con lógica normal del bot
        return null;
    }

    // === INTEGRACIÓN EN EL SISTEMA DE XP ===

    async giveXP(playerName, baseXP, reason = "Actividad en juego") {
        try {
            // Aplicar multiplicador VIP
            const finalXP = await this.vipSystem.applyVIPXPMultiplier(playerName, baseXP);
            
            // Actualizar XP en la base de datos (integrar con tu lógica existente)
            return new Promise((resolve, reject) => {
                this.db.run('UPDATE jugadores SET xp = xp + ? WHERE nombre = ?', 
                           [finalXP, playerName], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Si el jugador tiene VIP, mostrar mensaje especial
                    resolve({
                        xpGiven: finalXP,
                        wasMultiplied: finalXP > baseXP,
                        message: finalXP > baseXP ? 
                            `🎉 ${playerName} recibió ${finalXP} XP (VIP bonus aplicado!)` :
                            `${playerName} recibió ${finalXP} XP`
                    });
                });
            });
        } catch (error) {
            console.error('Error aplicando XP con bonus VIP:', error);
            // Fallback a XP normal si hay error
            return this.giveNormalXP(playerName, baseXP);
        }
    }

    // === INTEGRACIÓN EN EVENTOS DEL JUEGO ===

    async onPlayerJoin(playerName, playerAuth) {
        try {
            // Verificar estado VIP del jugador
            const vipStatus = await this.vipSystem.checkVIPStatus(playerName);
            
            if (vipStatus) {
                const benefits = this.vipSystem.getVIPBenefits(vipStatus.vip_type);
                
                // Mostrar mensaje de bienvenida VIP
                const welcomeMessage = `${benefits.color} ¡Bienvenido ${playerName}! Tu estatus ${benefits.name} está activo. Usa !viphelp para ver tus beneficios.`;
                
                return {
                    isVIP: true,
                    vipType: vipStatus.vip_type,
                    vipLevel: vipStatus.level,
                    welcomeMessage: welcomeMessage
                };
            }

            return {
                isVIP: false,
                welcomeMessage: null
            };
        } catch (error) {
            console.error('Error verificando VIP en join:', error);
            return { isVIP: false, welcomeMessage: null };
        }
    }

    async onPlayerGoal(playerName, goalDetails) {
        try {
            // Dar XP por gol con bonus VIP
            const xpResult = await this.giveXP(playerName, 10, "Gol anotado");
            
            return {
                xpMessage: xpResult.message
            };
        } catch (error) {
            console.error('Error en evento de gol:', error);
            return null;
        }
    }

    async onPlayerAssist(playerName, assistDetails) {
        try {
            // Dar XP por asistencia con bonus VIP
            const xpResult = await this.giveXP(playerName, 5, "Asistencia");
            
            return {
                xpMessage: xpResult.message
            };
        } catch (error) {
            console.error('Error en evento de asistencia:', error);
            return null;
        }
    }


    // === UTILIDADES AUXILIARES ===

    async getVIPPlayersList() {
        try {
            return await this.vipSystem.listActiveVIPs();
        } catch (error) {
            console.error('Error obteniendo lista VIP:', error);
            return [];
        }
    }

    async isPlayerVIP(playerName) {
        try {
            const vipStatus = await this.vipSystem.checkVIPStatus(playerName);
            return vipStatus !== null;
        } catch (error) {
            console.error('Error verificando VIP:', error);
            return false;
        }
    }

    async getPlayerVIPLevel(playerName) {
        try {
            const vipStatus = await this.vipSystem.checkVIPStatus(playerName);
            return vipStatus ? vipStatus.level : 0;
        } catch (error) {
            console.error('Error obteniendo nivel VIP:', error);
            return 0;
        }
    }

    // Métodos auxiliares (implementa según tu sistema)
    isOwner(playerName) {
        // Implementa tu lógica de verificación de owner
        return ['owner', 'admin_principal'].includes(playerName.toLowerCase());
    }

    isAdmin(playerName) {
        // Implementa tu lógica de verificación de admin
        return ['owner', 'admin', 'admin_basico'].includes(playerName.toLowerCase());
    }

    async giveNormalXP(playerName, xp) {
        // Lógica de XP normal sin bonus VIP
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE jugadores SET xp = xp + ? WHERE nombre = ?', 
                       [xp, playerName], function(err) {
                if (err) reject(err);
                else resolve({ xpGiven: xp, wasMultiplied: false });
            });
        });
    }

    // === COMANDO ESPECIAL PARA OWNERS ===

    async processOwnerCommands(message, playerName) {
        if (!this.isOwner(playerName)) return null;

        const args = message.slice(1).split(' ');
        const command = args[0].toLowerCase();

        switch (command) {
            case 'vipsetup':
                return this.setupVIPSystem();
            
            case 'vipbackup':
                return this.backupVIPData();
            
            case 'vipmigrate':
                return this.migrateExistingVIPs();
            
            default:
                return null;
        }
    }

    async setupVIPSystem() {
        try {
            // Verificar e inicializar sistema VIP
            await this.vipSystem.initializeVIPTables();
            return "✅ Sistema VIP configurado correctamente.";
        } catch (error) {
            return `❌ Error configurando VIP: ${error.message}`;
        }
    }

    async backupVIPData() {
        try {
            const vips = await this.vipSystem.listActiveVIPs();
            const backup = {
                timestamp: new Date().toISOString(),
                vips: vips
            };
            
            // Guardar backup (implementa según tus necesidades)
            require('fs').writeFileSync(
                `vip_backup_${Date.now()}.json`, 
                JSON.stringify(backup, null, 2)
            );
            
            return `✅ Backup VIP creado con ${vips.length} usuarios.`;
        } catch (error) {
            return `❌ Error creando backup: ${error.message}`;
        }
    }

    async migrateExistingVIPs() {
        try {
            // Migrar VIPs existentes de la tabla jugadores
            return new Promise((resolve, reject) => {
                this.db.all('SELECT nombre, esVIP, fechaVIP FROM jugadores WHERE esVIP > 0', [], async (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    let migrated = 0;
                    for (const row of rows) {
                        try {
                            const vipType = row.esVIP === 2 ? 'ULTRA_VIP' : 'VIP';
                            await this.vipSystem.grantVIP(row.nombre, vipType, 'MIGRATION', null, 'Migrado del sistema anterior');
                            migrated++;
                        } catch (error) {
                            console.error(`Error migrando ${row.nombre}:`, error);
                        }
                    }

                    resolve(`✅ Migrados ${migrated} VIPs al nuevo sistema.`);
                });
            });
        } catch (error) {
            return `❌ Error en migración: ${error.message}`;
        }
    }
}

module.exports = BotVIPIntegration;

/* 
EJEMPLO DE USO EN TU BOT PRINCIPAL:

// En tu bot.js, después de inicializar la base de datos:

const BotVIPIntegration = require('./bot_vip_integration');
const vipBot = new BotVIPIntegration(db);

// En el evento de mensaje del chat:
room.onPlayerChat = async (player, message) => {
    // Procesar comandos VIP primero
    const vipResponse = await vipBot.handlePlayerMessage(player.name, message, player.auth);
    
    if (vipResponse) {
        room.sendAnnouncement(vipResponse, player.id);
        return;
    }
    
    // Procesar comandos de owner
    if (message.startsWith('!')) {
        const ownerResponse = await vipBot.processOwnerCommands(message, player.name);
        if (ownerResponse) {
            room.sendAnnouncement(ownerResponse, player.id);
            return;
        }
    }
    
    // Continuar con lógica normal del bot...
};

// En el evento de jugador que se une:
room.onPlayerJoin = async (player) => {
    const joinResult = await vipBot.onPlayerJoin(player.name, player.auth);
    
    if (joinResult.welcomeMessage) {
        room.sendAnnouncement(joinResult.welcomeMessage, player.id, 0x00FF00);
    }
    
    // Lógica normal de join...
};

// En el evento de gol:
room.onPlayerGoal = async (player) => {
    const goalResult = await vipBot.onPlayerGoal(player.name, {});
    
    if (goalResult && goalResult.xpMessage) {
        room.sendAnnouncement(goalResult.xpMessage, null, 0xFFD700);
    }
    
    // Lógica normal de gol...
};

*/
