// unban_mejorado.js
const db = require('./database/db_functions.js');

async function unbanMejorado(authId) {
    if (!authId) {
        return { success: false, message: "Auth-ID no proporcionado." };
    }

    try {
        const banData = await db.estaBaneadoPromise(authId);

        if (!banData) {
            return { success: true, wasInDb: false, message: `No se encontró baneo activo en la DB para ${authId}.` };
        }

        const unbanResult = await db.desbanearJugadorNuevo(authId);

        if (unbanResult && unbanResult.cambios > 0) {
            return { success: true, wasInDb: true, playerName: unbanResult.nombre, message: `Jugador ${unbanResult.nombre} desbaneado de la DB.` };
        } else {
            return { success: true, wasInDb: false, message: `El baneo para ${authId} ya estaba inactivo en la DB.` };
        }
    } catch (error) {
        console.error(`❌ Error fatal en la función unbanMejorado:`, error);
        return { success: false, message: "Error interno del servidor al procesar el desbaneo." };
    }
}

module.exports = {
    unbanMejorado
};