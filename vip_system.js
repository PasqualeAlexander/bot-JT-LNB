/* 
* ██╗   ██╗██╗██████╗     ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗
* ██║   ██║██║██╔══██╗    ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║
* ██║   ██║██║██████╔╝    ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║
* ╚██╗ ██╔╝██║██╔═══╝     ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║
*  ╚████╔╝ ██║██║         ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║
*   ╚═══╝  ╚═╝╚═╝         ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝
*
* SISTEMA VIP Y ULTRA VIP PARA BOT LNB
* Incluye ventajas diferenciadas, comandos de administración y gestión completa
*/

const { executeQuery, executeTransaction } = require('./config/database');
const path = require('path');

class VIPSystem {
    constructor(database) {
        this.db = database;
        this.initializeVIPTables();
        
        // Configuración de ventajas VIP
        this.vipBenefits = {
            VIP: {
                name: "VIP",
                color: "💎",
                level: 1,
                benefits: [
                    "🎨 Colores especiales en chat",
                    "⚡ XP multiplicado x1.5",
                    "📊 Estadísticas detalladas",
                    "🎯 Comando !record personal",
                    "🔄 Prioridad en auto-balance"
                ]
            },
            ULTRA_VIP: {
                name: "Ultra VIP",
                color: "👑",
                level: 2,
                benefits: [
                    "🌈 Todos los beneficios VIP",
                    "🔥 XP multiplicado x2.0",
                    "🎮 Comandos de jugador especiales",
                    "🏆 Acceso a salas VIP exclusivas",
                    "🎨 Nombres con efectos especiales",
                    "🔧 Comandos de configuración personal",
                    "📈 Estadísticas avanzadas",
                    "🎪 Comandos de diversión exclusivos"
                ]
            }
        };
        
        // Comandos disponibles por nivel
        this.vipCommands = {
            VIP: [
                "!myrecord", "!mystats", "!playtime", "!viphelp"
            ],
            ULTRA_VIP: [
                "!myrecord", "!mystats", "!playtime", "!viphelp",
                "!customcolor", "!effect", "!premium", "!ultravip",
                "!exclusive", "!special"
            ]
        };
    }

    // Inicializar tablas del sistema VIP
    initializeVIPTables() {
        // Crear tabla de tipos VIP
        this.db.run(`CREATE TABLE IF NOT EXISTS vip_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type_name TEXT UNIQUE NOT NULL,
            level INTEGER NOT NULL,
            color TEXT NOT NULL,
            benefits TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Crear tabla de membresías VIP
        this.db.run(`CREATE TABLE IF NOT EXISTS vip_memberships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            vip_type TEXT NOT NULL,
            granted_by TEXT NOT NULL,
            granted_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expiry_date DATETIME,
            is_active INTEGER DEFAULT 1,
            reason TEXT,
            FOREIGN KEY (player_name) REFERENCES jugadores(nombre)
        )`);

        // Crear tabla de beneficios utilizados
        this.db.run(`CREATE TABLE IF NOT EXISTS vip_benefits_used (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            benefit_type TEXT NOT NULL,
            used_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            details TEXT
        )`);

        // Insertar tipos VIP por defecto
        this.insertDefaultVIPTypes();
    }

    // Insertar tipos VIP por defecto
    insertDefaultVIPTypes() {
        const defaultTypes = [
            {
                type_name: 'VIP',
                level: 1,
                color: '💎',
                benefits: JSON.stringify(this.vipBenefits.VIP.benefits)
            },
            {
                type_name: 'ULTRA_VIP',
                level: 2,
                color: '👑',
                benefits: JSON.stringify(this.vipBenefits.ULTRA_VIP.benefits)
            }
        ];

        defaultTypes.forEach(type => {
            this.db.run(`INSERT OR IGNORE INTO vip_types (type_name, level, color, benefits) 
                        VALUES (?, ?, ?, ?)`, 
                        [type.type_name, type.level, type.color, type.benefits]);
        });
    }

    // Otorgar VIP a un jugador
    grantVIP(playerName, vipType, grantedBy, durationDays = null, reason = "Otorgado por admin") {
        return new Promise((resolve, reject) => {
            // Verificar si el jugador existe
            this.db.get('SELECT nombre FROM jugadores WHERE nombre = ?', [playerName], (err, player) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!player) {
                    reject(new Error(`Jugador ${playerName} no encontrado en la base de datos`));
                    return;
                }

                // Verificar si el tipo VIP existe
                this.db.get('SELECT * FROM vip_types WHERE type_name = ?', [vipType], (err, vipTypeData) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!vipTypeData) {
                        reject(new Error(`Tipo VIP ${vipType} no válido`));
                        return;
                    }

                    // Desactivar membresías VIP anteriores
                    this.db.run('UPDATE vip_memberships SET is_active = 0 WHERE player_name = ?', [playerName], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Calcular fecha de expiración
                        let expiryDate = null;
                        if (durationDays) {
                            const expiry = new Date();
                            expiry.setDate(expiry.getDate() + durationDays);
                            expiryDate = expiry.toISOString();
                        }

                        // Insertar nueva membresía VIP
                        this.db.run(`INSERT INTO vip_memberships 
                                    (player_name, vip_type, granted_by, expiry_date, reason) 
                                    VALUES (?, ?, ?, ?, ?)`,
                                    [playerName, vipType, grantedBy, expiryDate, reason], function(err) {
                            if (err) {
                                reject(err);
                                return;
                            }

                            // Actualizar tabla de jugadores
                            const vipLevel = vipType === 'ULTRA_VIP' ? 2 : 1;
                            this.db.run('UPDATE jugadores SET esVIP = ?, fechaVIP = CURRENT_TIMESTAMP WHERE nombre = ?',
                                       [vipLevel, playerName], (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }

                                resolve({
                                    success: true,
                                    message: `${vipTypeData.color} ${playerName} ahora es ${vipType}`,
                                    membershipId: this.lastID,
                                    vipLevel: vipLevel,
                                    expiryDate: expiryDate
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    // Remover VIP de un jugador
    removeVIP(playerName, removedBy, reason = "Removido por admin") {
        return new Promise((resolve, reject) => {
            // Desactivar membresías VIP
            this.db.run('UPDATE vip_memberships SET is_active = 0 WHERE player_name = ? AND is_active = 1',
                       [playerName], function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.changes === 0) {
                    reject(new Error(`${playerName} no tiene VIP activo`));
                    return;
                }

                // Actualizar tabla de jugadores
                this.db.run('UPDATE jugadores SET esVIP = 0, fechaVIP = NULL WHERE nombre = ?',
                           [playerName], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve({
                        success: true,
                        message: `VIP removido de ${playerName}`,
                        removedBy: removedBy,
                        reason: reason
                    });
                });
            });
        });
    }

    // Verificar estado VIP de un jugador
    checkVIPStatus(playerName) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT vm.*, vt.level, vt.color, vt.benefits 
                FROM vip_memberships vm
                JOIN vip_types vt ON vm.vip_type = vt.type_name
                WHERE vm.player_name = ? AND vm.is_active = 1
                AND (vm.expiry_date IS NULL OR vm.expiry_date > CURRENT_TIMESTAMP)
                ORDER BY vt.level DESC
                LIMIT 1
            `;

            this.db.get(query, [playerName], (err, membership) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(membership || null);
            });
        });
    }

    // Listar todos los VIPs activos
    listActiveVIPs() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT vm.player_name, vm.vip_type, vm.granted_date, vm.expiry_date, 
                       vm.granted_by, vt.color, vt.level
                FROM vip_memberships vm
                JOIN vip_types vt ON vm.vip_type = vt.type_name
                WHERE vm.is_active = 1
                AND (vm.expiry_date IS NULL OR vm.expiry_date > CURRENT_TIMESTAMP)
                ORDER BY vt.level DESC, vm.granted_date ASC
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(rows || []);
            });
        });
    }

    // Aplicar multiplicador de XP basado en VIP
    applyVIPXPMultiplier(playerName, baseXP) {
        return new Promise(async (resolve, reject) => {
            try {
                const vipStatus = await this.checkVIPStatus(playerName);
                
                if (!vipStatus) {
                    resolve(baseXP); // Sin VIP, XP normal
                    return;
                }

                let multiplier = 1.0;
                switch (vipStatus.vip_type) {
                    case 'VIP':
                        multiplier = 1.5;
                        break;
                    case 'ULTRA_VIP':
                        multiplier = 2.0;
                        break;
                    default:
                        multiplier = 1.0;
                }

                const bonusXP = Math.floor(baseXP * multiplier);
                
                // Registrar uso del beneficio
                this.db.run(`INSERT INTO vip_benefits_used 
                            (player_name, benefit_type, details) 
                            VALUES (?, ?, ?)`,
                            [playerName, 'XP_MULTIPLIER', 
                             `XP: ${baseXP} → ${bonusXP} (x${multiplier})`]);

                resolve(bonusXP);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Verificar si un jugador puede usar un comando VIP
    canUseVIPCommand(playerName, command) {
        return new Promise(async (resolve, reject) => {
            try {
                const vipStatus = await this.checkVIPStatus(playerName);
                
                if (!vipStatus) {
                    resolve(false);
                    return;
                }

                const availableCommands = this.vipCommands[vipStatus.vip_type] || [];
                resolve(availableCommands.includes(command));
            } catch (error) {
                reject(error);
            }
        });
    }

    // Obtener información de beneficios VIP
    getVIPBenefits(vipType) {
        return this.vipBenefits[vipType] || null;
    }

    // Limpiar VIPs expirados
    cleanupExpiredVIPs() {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE vip_memberships 
                        SET is_active = 0 
                        WHERE expiry_date IS NOT NULL 
                        AND expiry_date <= CURRENT_TIMESTAMP 
                        AND is_active = 1`, function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Actualizar tabla de jugadores para VIPs expirados
                this.db.run(`UPDATE jugadores 
                            SET esVIP = 0, fechaVIP = NULL 
                            WHERE nombre IN (
                                SELECT player_name FROM vip_memberships 
                                WHERE expiry_date IS NOT NULL 
                                AND expiry_date <= CURRENT_TIMESTAMP 
                                AND is_active = 0
                            )`, (updateErr) => {
                    if (updateErr) {
                        reject(updateErr);
                        return;
                    }

                    resolve({
                        expiredCount: this.changes,
                        message: `${this.changes} VIPs expirados limpiados`
                    });
                });
            });
        });
    }

    // Generar reporte de actividad VIP
    generateVIPReport() {
        return new Promise((resolve, reject) => {
            const queries = {
                activeVIPs: `SELECT COUNT(*) as count FROM vip_memberships 
                           WHERE is_active = 1 
                           AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)`,
                
                vipsByType: `SELECT vm.vip_type, COUNT(*) as count, vt.color
                           FROM vip_memberships vm
                           JOIN vip_types vt ON vm.vip_type = vt.type_name
                           WHERE vm.is_active = 1 
                           AND (vm.expiry_date IS NULL OR vm.expiry_date > CURRENT_TIMESTAMP)
                           GROUP BY vm.vip_type`,
                
                recentGrants: `SELECT player_name, vip_type, granted_by, granted_date, vt.color
                             FROM vip_memberships vm
                             JOIN vip_types vt ON vm.vip_type = vt.type_name
                             WHERE vm.granted_date >= datetime('now', '-7 days')
                             ORDER BY vm.granted_date DESC
                             LIMIT 10`
            };

            Promise.all([
                new Promise((res, rej) => {
                    this.db.get(queries.activeVIPs, [], (err, row) => {
                        if (err) rej(err);
                        else res(row);
                    });
                }),
                new Promise((res, rej) => {
                    this.db.all(queries.vipsByType, [], (err, rows) => {
                        if (err) rej(err);
                        else res(rows);
                    });
                }),
                new Promise((res, rej) => {
                    this.db.all(queries.recentGrants, [], (err, rows) => {
                        if (err) rej(err);
                        else res(rows);
                    });
                })
            ]).then(([activeCount, vipsByType, recentGrants]) => {
                resolve({
                    totalActiveVIPs: activeCount.count,
                    vipsByType: vipsByType,
                    recentGrants: recentGrants,
                    generatedAt: new Date().toISOString()
                });
            }).catch(reject);
        });
    }
}

module.exports = VIPSystem;
