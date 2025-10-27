
const dbFunctions = require('./database/db_functions.js');
const authId = process.argv[2];

if (!authId) {
  console.log('Por favor, proporciona un auth_id como argumento.');
  process.exit(1);
}

dbFunctions.estaBaneadoPromise(authId).then(baneo => {
  if (baneo) {
    console.log('El jugador está baneado.');
    console.log(baneo);
  } else {
    console.log('El jugador no está baneado o el baneo ha expirado.');
  }
}).catch(error => {
  console.error('Error al verificar el baneo:', error);
});
