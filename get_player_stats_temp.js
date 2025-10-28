
const dbFunctions = require('./database/db_functions');

(async () => {
    const authId = '9M4tWPS5APaUyvxOc7ebVHm4lNYE-R7cLWQoiQifvDs';
    try {
        const jugador = await dbFunctions.obtenerJugadorPorAuth(authId);
        if (jugador) {
            console.log(JSON.stringify(jugador, null, 2));
        } else {
            console.log('No se encontró jugador con el auth_id proporcionado.');
        }
    } catch (error) {
        console.error('Error al obtener datos del jugador:', error);
    } finally {
        // It's good practice to close the database connection if it's managed by dbFunctions or its dependencies.
        // However, looking at db_functions.js, there's no explicit close function exposed.
        // Assuming the connection is managed externally or is persistent for the script's lifetime.
    }
})();
