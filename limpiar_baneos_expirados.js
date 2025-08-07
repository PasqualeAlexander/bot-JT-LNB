#!/usr/bin/env node

/**
 * Script para limpiar baneos temporales expirados manualmente
 * Este script identifica y desactiva baneos temporales que ya expiraron
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración de la base de datos
const dbPath = path.join(process.cwd(), 'lnb_estadisticas.db');

console.log('🧹 LIMPIEZA MANUAL DE BANEOS TEMPORALES EXPIRADOS');
console.log('================================================\n');

async function limpiarBaneosExpirados() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        // Primero obtener todos los baneos temporales activos
        const selectQuery = `SELECT * FROM baneos WHERE activo = 1 AND duracion > 0 ORDER BY fecha DESC`;
        
        db.all(selectQuery, [], (err, rows) => {
            if (err) {
                console.error('❌ Error obteniendo baneos:', err);
                reject(err);
                return;
            }
            
            console.log(`📊 Encontrados ${rows.length} baneos temporales activos para verificar\n`);
            
            if (rows.length === 0) {
                console.log('✅ No hay baneos temporales activos que verificar');
                db.close();
                resolve({ total: 0, expirados: 0 });
                return;
            }
            
            const ahora = new Date();
            const baneosExpirados = [];
            
            // Verificar cada baneo temporal
            rows.forEach(row => {
                const fechaBan = new Date(row.fecha);
                const tiempoTranscurrido = ahora.getTime() - fechaBan.getTime();
                const tiempoLimite = row.duracion * 60 * 1000; // duración en minutos a milisegundos
                
                const minutosTranscurridos = Math.floor(tiempoTranscurrido / (60 * 1000));
                const horasTranscurridas = Math.floor(minutosTranscurridos / 60);
                
                if (tiempoTranscurrido >= tiempoLimite) {
                    // Baneo temporal expirado
                    baneosExpirados.push({
                        id: row.id,
                        nombre: row.nombre,
                        duracion: row.duracion,
                        minutosTranscurridos: minutosTranscurridos,
                        horasTranscurridas: horasTranscurridas
                    });
                    
                    console.log(`⏰ EXPIRADO: ${row.nombre} (ID: ${row.id})`);
                    console.log(`   - Duración: ${row.duracion} minutos`);
                    console.log(`   - Transcurridos: ${minutosTranscurridos} minutos (${horasTranscurridas}h)`);
                    console.log(`   - Admin: ${row.admin}`);
                    console.log(`   - Fecha: ${row.fecha}`);
                    console.log();
                } else {
                    const minutosRestantes = Math.floor((tiempoLimite - tiempoTranscurrido) / (60 * 1000));
                    console.log(`✅ ACTIVO: ${row.nombre} (faltan ${minutosRestantes} min)`);
                }
            });
            
            if (baneosExpirados.length === 0) {
                console.log('\n🎉 No hay baneos temporales expirados para limpiar');
                db.close();
                resolve({ total: rows.length, expirados: 0 });
                return;
            }
            
            console.log(`\n🧹 Limpiando ${baneosExpirados.length} baneos temporales expirados...\n`);
            
            let limpiados = 0;
            let errores = 0;
            
            // Limpiar cada baneo expirado
            const limpiarBaneo = (index) => {
                if (index >= baneosExpirados.length) {
                    // Terminamos
                    console.log(`\n📊 RESUMEN:`);
                    console.log(`✅ Total limpiados: ${limpiados}/${baneosExpirados.length}`);
                    console.log(`❌ Errores: ${errores}`);
                    
                    db.close();
                    resolve({ total: rows.length, expirados: limpiados });
                    return;
                }
                
                const baneo = baneosExpirados[index];
                const updateQuery = `UPDATE baneos SET activo = 0 WHERE id = ?`;
                
                db.run(updateQuery, [baneo.id], function(err) {
                    if (err) {
                        console.error(`❌ Error limpiando baneo ID ${baneo.id}: ${err.message}`);
                        errores++;
                    } else {
                        console.log(`✅ Limpiado: ${baneo.nombre} (ID: ${baneo.id}) - ${baneo.horasTranscurridas}h expirado`);
                        limpiados++;
                    }
                    
                    // Continuar con el siguiente
                    limpiarBaneo(index + 1);
                });
            };
            
            // Iniciar la limpieza
            limpiarBaneo(0);
        });
    });
}

// Función principal
async function main() {
    try {
        const resultado = await limpiarBaneosExpirados();
        
        console.log('\n' + '='.repeat(50));
        console.log('🎉 LIMPIEZA COMPLETADA');
        console.log(`📊 Baneos verificados: ${resultado.total}`);
        console.log(`🧹 Baneos limpiados: ${resultado.expirados}`);
        console.log('='.repeat(50));
        
        if (resultado.expirados > 0) {
            console.log('\n💡 Los baneos han sido marcados como inactivos pero mantienen su historial');
            console.log('💡 Ahora !banlist solo mostrará baneos realmente activos');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR durante la limpieza:', error);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { limpiarBaneosExpirados };
