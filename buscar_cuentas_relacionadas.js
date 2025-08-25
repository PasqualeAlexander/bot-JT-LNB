/**
 * BUSCAR CUENTAS RELACIONADAS
 * ===========================
 */

const { executeQuery } = require('./config/database');

async function buscarCuentasRelacionadas() {
    try {
        console.log('🔍 Buscando todas las cuentas que podrían ser tuyas...');
        
        // Buscar cuentas con nombres similares o que contengan 'asa'
        const queryNombres = `
            SELECT nombre, codigoRecuperacion, partidos, goles, asistencias, 
                   fechaUltimoPartido, uid, nivel, xp
            FROM jugadores 
            WHERE nombre LIKE '%asa%' 
               OR nombre LIKE '%alex%' 
               OR nombre LIKE '%alexa%'
            ORDER BY fechaUltimoPartido DESC
            LIMIT 30
        `;
        
        const resultados = await executeQuery(queryNombres);
        
        if (resultados.length > 0) {
            console.log('📋 Cuentas encontradas con nombres similares:');
            console.log('═'.repeat(100));
            
            resultados.forEach((j, i) => {
                const fecha = j.fechaUltimoPartido ? j.fechaUltimoPartido.substring(0, 10) : 'N/A';
                const codigo = j.codigoRecuperacion ? `🔐 ${j.codigoRecuperacion}` : '❌ Sin código';
                
                console.log(`${(i + 1).toString().padStart(2)}. ${j.nombre.padEnd(20)} | ${codigo} | 🎮 ${j.partidos.toString().padStart(3)}PJ ${j.goles.toString().padStart(3)}G ${j.asistencias.toString().padStart(3)}A | 📅 ${fecha} | ⭐ Nv${j.nivel} (${j.xp}XP)`);
            });
            
            console.log('\n💡 Si ves tu nombre en esta lista, usa el código que aparece con 🔐');
            
        } else {
            console.log('❌ No se encontraron cuentas con nombres similares');
        }
        
        // También mostrar las 20 cuentas más activas recientes
        console.log('\n🏆 Top 20 cuentas más activas (por si usaste otro nombre):');
        console.log('─'.repeat(100));
        
        const topActivas = await executeQuery(`
            SELECT nombre, codigoRecuperacion, partidos, goles, asistencias, fechaUltimoPartido
            FROM jugadores 
            WHERE partidos > 3
            ORDER BY fechaUltimoPartido DESC
            LIMIT 20
        `);
        
        topActivas.forEach((j, i) => {
            const fecha = j.fechaUltimoPartido ? j.fechaUltimoPartido.substring(0, 10) : 'N/A';
            const codigo = j.codigoRecuperacion ? `🔐 ${j.codigoRecuperacion}` : '❌ Sin código';
            
            console.log(`${(i + 1).toString().padStart(2)}. ${j.nombre.padEnd(20)} | ${codigo} | 🎮 ${j.partidos.toString().padStart(3)}PJ ${j.goles.toString().padStart(3)}G | 📅 ${fecha}`);
        });
        
        console.log('\n📊 Resumen:');
        console.log('- Si encuentras tu nombre con 🔐, ese es tu código de recuperación');
        console.log('- Si encuentras tu nombre con ❌, aún no tienes código (necesitas 5+ partidos)');
        console.log('- Los códigos se generan automáticamente al llegar a 5 partidos');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

buscarCuentasRelacionadas().then(() => process.exit(0));
