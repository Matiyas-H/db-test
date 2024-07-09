const mysql = require('mysql2/promise');

async function exploreDatabase(dbName) {
    let connection;
    try {
        const config = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: dbName
        };

        connection = await mysql.createConnection(config);
        console.log(`\nExploring database: ${dbName}`);

        // Get list of tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`Tables in ${dbName}:`, tables.map(table => Object.values(table)[0]).join(', '));

        // Explore each table
        for (const tableRow of tables) {
            const tableName = Object.values(tableRow)[0];
            console.log(`\nTable: ${tableName}`);

            // Get table structure
            const [columns] = await connection.query(`DESCRIBE ${tableName}`);
            console.log('Columns:');
            columns.forEach(column => {
                console.log(`  ${column.Field} (${column.Type})`);
            });

            // Get row count
            const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            console.log(`Row count: ${countResult[0].count}`);

            // Fetch sample rows (limit to 2 for brevity)
            const [rows] = await connection.query(`SELECT * FROM ${tableName} LIMIT 2`);
            console.log('Sample rows (up to 2):');
            rows.forEach((row, index) => {
                console.log(`  Row ${index + 1}:`);
                Object.entries(row).forEach(([key, value]) => {
                    let displayValue = value;
                    if (value === null) {
                        displayValue = 'NULL';
                    } else if (typeof value === 'string') {
                        if (value.startsWith('<?xml') || value.startsWith('<')) {
                            displayValue = 'XML Content (truncated): ' + value.substring(0, 50) + '...';
                        } else if (value.length > 100) {
                            displayValue = value.substring(0, 100) + '...';
                        }
                    } else if (Buffer.isBuffer(value)) {
                        displayValue = 'Binary Data (BLOB)';
                    }
                    if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
                        displayValue = '[REDACTED]';
                    }
                    console.log(`    ${key}: ${displayValue}`);
                });
            });
        }
    } catch (error) {
        console.error(`Error exploring ${dbName}:`, error);
    } finally {
        if (connection) await connection.end();
    }
}

async function main() {
    await exploreDatabase('dialokxml');
    await exploreDatabase('information_schema');
}

main().catch(console.error);