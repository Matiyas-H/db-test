const mysql = require('mysql2/promise');

async function testConnection() {
    let connection;
    try {
        const config = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        };

        // Only add database name if it's provided
        if (process.env.DB_NAME) {
            config.database = process.env.DB_NAME;
        }

        connection = await mysql.createConnection(config);
        console.log('Successfully connected to the database server.');

        // If no specific database, list available databases
        if (!process.env.DB_NAME) {
            const [rows] = await connection.execute('SHOW DATABASES');
            console.log('Available databases:', rows.map(row => row.Database));
        } else {
            const [rows] = await connection.execute('SELECT 1 as test');
            console.log('Query result:', rows);
        }

    } catch (error) {
        console.error('Error connecting to the database:', error);
    } finally {
        if (connection) await connection.end();
    }
}

testConnection();