const mysql = require('mysql2/promise');

async function analyzeDialokFields() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: 'dialokxml'
        });

        const [fields] = await connection.execute(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dialokxml'
            AND TABLE_NAME = 'directory'
            ORDER BY ORDINAL_POSITION;
        `);

        const fieldNames = fields.map(field => field.COLUMN_NAME);

        console.log('INFO');
        console.log('Dialok Directory Table Fields:');
        console.log('INFO');
        console.log('{');
        console.log('INFO');
        fieldNames.forEach(field => {
            console.log(`  "${field}": "",`);
            console.log('INFO');
        });
        console.log('}');

        return fieldNames;
    } catch (error) {
        console.error('Error analyzing Dialok fields:', error);
    } finally {
        if (connection) await connection.end();
    }
}

analyzeDialokFields();