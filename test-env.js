// Test environment variable loading
const fs = require('fs');

console.log('🔍 Testing .env file loading...\n');

// Check if .env file exists
if (fs.existsSync('.env')) {
    console.log('✅ .env file found');
    
    // Load dotenv
    require('dotenv').config();
    
    // Display all DB-related environment variables
    console.log('\n📊 Database Configuration:');
    console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
    console.log('DB_PORT:', process.env.DB_PORT || 'NOT SET');
    console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[SET]' : 'NOT SET');
    console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
    
    // Test database connection config
    console.log('\n🔧 Final configuration that will be used:');
    const connectionConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'lnb_user',
        password: process.env.DB_PASSWORD || 'lnb_password',
        database: process.env.DB_NAME || 'lnb_estadisticas'
    };
    
    console.log('Host:', connectionConfig.host);
    console.log('Port:', connectionConfig.port);
    console.log('User:', connectionConfig.user);
    console.log('Password:', connectionConfig.password ? '[SET]' : '[NOT SET]');
    console.log('Database:', connectionConfig.database);
    
} else {
    console.log('❌ .env file not found!');
}
