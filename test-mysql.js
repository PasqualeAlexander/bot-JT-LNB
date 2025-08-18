const fs = require('fs');

console.log('🔌 Testing MySQL connection...\n');

// Load environment variables FIRST
if (fs.existsSync('.env')) {
    require('dotenv').config();
}

// Import database config AFTER loading env variables
const { testConnection } = require('./config/database');

// Test the connection
testConnection().then(isConnected => {
    if (isConnected) {
        console.log('✅ MySQL connection successful!');
        process.exit(0);
    } else {
        console.log('❌ MySQL connection failed!');
        process.exit(1);
    }
});
