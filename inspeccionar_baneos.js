#!/usr/bin/env node

/**
 * Script para inspeccionar el estado actual de los baneos
 * Muestra información detallada sobre baneos activos, expirados y estadísticas
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración de la base de datos
const dbPath = path.join(process.cwd(), 'lnb_estadisticas.db');

console.log('🔍 INSPECCIÓN DE BANEOS EN LA BASE DE DATOS');
console.log('===========================================\n');

async function inspeccionarBaneos() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        // Obtener estadísticas generales
        const statsQueries = {
            totalBaneos: 'SELECT COUNT(*) as count FROM baneos',
            baneosActivos: 'SELECT COUNT(*) as count FROM baneos WHERE activo = 1',
            baneosInactivos: 'SELECT COUNT(*) as count FROM baneos WHERE activo = 0',
            baneosTemporales: 'SELECT COUNT(*) as count FROM baneos WHERE duracion > 0',
            baneosPermanentes: 'SELECT COUNT(*) as count FROM baneos WHERE duracion = 0'
        };
        
        let estadisticas = {};
        let completadas = 0;
        const totalQueries = Object.keys(statsQueries).length;
        
        // Ejecutar queries de estadísticas
        Object.entries(statsQueries).forEach(([key, query]) => {
            db.get(query, [], (err, row) => {
                if (err) {
                    console.error(`❌ Error en ${key}:`, err);
                    reject(err);
                    return;
                }
                estadisticas[key] = row.count;
                completadas++;
                
                if (completadas === totalQueries) {
                    // Ya tenemos todas las estadísticas, continuar
                    mostrarEstadisticas(estadisticas, db, resolve);
                }
            });
        });
    });
}

function mostrarEstadisticas(stats, db, resolve) {
    console.log('📊 ESTADÍSTICAS GENERALES:');
    console.log('==========================');
    console.log(`📈 Total de baneos: ${stats.totalBaneos}`);
    console.log(`✅ Baneos activos: ${stats.baneosActivos}`);
    console.log(`❌ Baneos inactivos: ${stats.baneosInactivos}`);
    console.log(`⏰ Baneos temporales: ${stats.baneosTemporales}`);
    console.log(`🔒 Baneos permanentes: ${stats.baneosPermanentes}`);
    console.log();
    
    // Obtener baneos temporales activos detallados
    const query = `SELECT * FROM baneos WHERE activo = 1 AND duracion > 0 ORDER BY fecha DESC`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Error obteniendo baneos temporales:', err);
            db.close();
            resolve({ stats, temporales: [] });
            return;
        }
        
        console.log('⏰ BANEOS TEMPORALES ACTIVOS DETALLADOS:');
        console.log('========================================');
        
        if (rows.length === 0) {
            console.log('🎉 No hay baneos temporales activos');
        } else {
            const ahora = new Date();
            let activosReales = 0;
            let expirados = 0;
            
            rows.forEach((row, index) => {
                const fechaBan = new Date(row.fecha);
                const tiempoTranscurrido = ahora.getTime() - fechaBan.getTime();
                const tiempoLimite = row.duracion * 60 * 1000;
                
                const minutosTranscurridos = Math.floor(tiempoTranscurrido / (60 * 1000));
                const horasTranscurridas = Math.floor(minutosTranscurridos / 60);
                
                const estado = tiempoTranscurrido >= tiempoLimite ? '⚠️ EXPIRADO' : '✅ ACTIVO';
                const estadoColor = tiempoTranscurrido >= tiempoLimite ? expirados++ : activosReales++;
                
                console.log(`${index + 1}. ${estado}: ${row.nombre} (ID: ${row.id})`);
                console.log(`   📅 Fecha: ${row.fecha}`);
                console.log(`   ⏱️ Duración: ${row.duracion} minutos`);
                console.log(`   🕐 Transcurrido: ${minutosTranscurridos} min (${horasTranscurridas}h)`);
                console.log(`   👮 Admin: ${row.admin}`);
                console.log(`   📝 Razón: ${row.razon}`);
                
                if (tiempoTranscurrido < tiempoLimite) {
                    const minutosRestantes = Math.floor((tiempoLimite - tiempoTranscurrido) / (60 * 1000));
                    const horasRestantes = Math.floor(minutosRestantes / 60);
                    console.log(`   ⏳ Restante: ${minutosRestantes} min (${horasRestantes}h)`);
                }
                console.log();
            });
            
            console.log('📊 RESUMEN DE BANEOS TEMPORALES:');
            console.log(`✅ Realmente activos: ${activosReales}`);
            console.log(`⚠️ Expirados (requieren limpieza): ${expirados}`);
            console.log(`📊 Total marcados como activos: ${rows.length}`);
        }
        
        // Obtener baneos permanentes activos
        const queryPermanentes = `SELECT * FROM baneos WHERE activo = 1 AND duracion = 0 ORDER BY fecha DESC LIMIT 10`;
        
        db.all(queryPermanentes, [], (err, permanentes) => {
            if (err) {
                console.error('❌ Error obteniendo baneos permanentes:', err);
            } else {
                console.log('\n🔒 BANEOS PERMANENTES ACTIVOS (últimos 10):');
                console.log('===========================================');
                
                if (permanentes.length === 0) {
                    console.log('📋 No hay baneos permanentes activos');
                } else {
                    permanentes.forEach((row, index) => {
                        const fechaBan = new Date(row.fecha);
                        const diasTranscurridos = Math.floor((new Date() - fechaBan) / (1000 * 60 * 60 * 24));
                        
                        console.log(`${index + 1}. ${row.nombre} (ID: ${row.id})`);
                        console.log(`   📅 Fecha: ${row.fecha} (${diasTranscurridos} días)`);
                        console.log(`   👮 Admin: ${row.admin}`);
                        console.log(`   📝 Razón: ${row.razon}`);
                        console.log();
                    });
                }
            }
            
            db.close();
            resolve({ stats, temporales: rows, permanentes });
        });
    });
}

async function main() {
    try {
        const resultado = await inspeccionarBaneos();
        
        console.log('\n' + '='.repeat(60));
        console.log('🔍 INSPECCIÓN COMPLETADA');
        console.log('='.repeat(60));
        
        if (resultado.temporales) {
            const ahora = new Date();
            const expirados = resultado.temporales.filter(row => {
                const fechaBan = new Date(row.fecha);
                const tiempoTranscurrido = ahora.getTime() - fechaBan.getTime();
                const tiempoLimite = row.duracion * 60 * 1000;
                return tiempoTranscurrido >= tiempoLimite;
            });
            
            if (expirados.length > 0) {
                console.log('\n🧹 RECOMENDACIÓN:');
                console.log(`Hay ${expirados.length} baneos temporales expirados que requieren limpieza.`);
                console.log('Ejecuta: node limpiar_baneos_expirados.js');
            }
        }
        
    } catch (error) {
        console.error('\n❌ ERROR durante la inspección:', error);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { inspeccionarBaneos };
