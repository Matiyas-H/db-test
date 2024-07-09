const mysql = require('mysql2/promise');

async function exploreDatabaseStructure() {
    let connection;
    try {
        const config = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME // This should be 'dialokxml'
        };

        connection = await mysql.createConnection(config);
        console.log('Successfully connected to the database:', config.database);

        // Get list of tables
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('Tables in the database:', tables.map(table => Object.values(table)[0]));

        // Explore each table
        for (const tableRow of tables) {
            const tableName = Object.values(tableRow)[0];
            console.log(`\nExploring table: ${tableName}`);

            // Get table structure
            const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
            console.log('Table structure:');
            columns.forEach(column => {
                console.log(`  ${column.Field} (${column.Type})`);
            });

            // Get a sample row (first row) from the table
            const [sampleRows] = await connection.execute(`SELECT * FROM ${tableName} LIMIT 1`);
            if (sampleRows.length > 0) {
                console.log('Sample data (first row):');
                const sampleRow = sampleRows[0];
                Object.keys(sampleRow).forEach(key => {
                    // Truncate long values and mask potential sensitive data
                    let value = sampleRow[key];
                    if (typeof value === 'string' && value.length > 50) {
                        value = value.substring(0, 50) + '...';
                    }
                    if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
                        value = '[REDACTED]';
                    }
                    console.log(`  ${key}: ${value}`);
                });
            } else {
                console.log('  (Table is empty)');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

exploreDatabaseStructure();