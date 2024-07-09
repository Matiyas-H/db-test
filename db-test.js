const mysql = require('mysql2/promise');

async function testConnection() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log('Successfully connected to the database.');

        // Optional: Perform a simple query
        const [rows] = await connection.execute('SELECT 1 as test');
        console.log('Query result:', rows);

    } catch (error) {
        console.error('Error connecting to the database:', error);
    } finally {
        if (connection) await connection.end();
    }
}

testConnection();