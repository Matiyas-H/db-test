const mysql = require('mysql2/promise');

async function analyzeContactInfo() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: 'dialokxml'
        });

        const [rows] = await connection.execute(`
            SELECT
                COUNT(DISTINCT personid) AS total_unique_contacts,
                COUNT(DISTINCT concernid) AS total_unique_concerns,
                COUNT(DISTINCT company) AS total_unique_companies,
                COUNT(DISTINCT title) AS total_unique_titles,
                
                (SELECT GROUP_CONCAT(DISTINCT company SEPARATOR ', ') 
                 FROM (SELECT DISTINCT company FROM directory WHERE company != '' ORDER BY company LIMIT 5) AS top_companies) AS sample_companies,
                
                (SELECT GROUP_CONCAT(DISTINCT title SEPARATOR ', ') 
                 FROM (SELECT DISTINCT title FROM directory WHERE title != '' ORDER BY title LIMIT 5) AS top_titles) AS sample_titles,
                
                COUNT(CASE WHEN firstname != '' THEN 1 END) AS contacts_with_firstname,
                COUNT(CASE WHEN lastname != '' THEN 1 END) AS contacts_with_lastname,
                COUNT(CASE WHEN company != '' THEN 1 END) AS contacts_with_company,
                COUNT(CASE WHEN title != '' THEN 1 END) AS contacts_with_title,
                COUNT(CASE WHEN organisation != '' THEN 1 END) AS contacts_with_organisation,
                COUNT(CASE WHEN office != '' THEN 1 END) AS contacts_with_office,
                COUNT(CASE WHEN commentexternal != '' THEN 1 END) AS contacts_with_external_comment,
                COUNT(CASE WHEN commentinternal != '' THEN 1 END) AS contacts_with_internal_comment,
                COUNT(CASE WHEN alias != '' THEN 1 END) AS contacts_with_alias
            FROM 
                directory;
        `);

        // Fetch a sample contact
        const [sampleContact] = await connection.execute(`
            SELECT *
            FROM directory
            WHERE firstname != '' AND lastname != ''
            LIMIT 1;
        `);

        console.log('INFO');
        console.log('Contact Information Analysis:');
        console.log('INFO');
        console.log(JSON.stringify(rows[0], null, 2));
        console.log('INFO');
        console.log('Sample Contact:');
        console.log('INFO');
        console.log(JSON.stringify(sampleContact[0], null, 2));

        return { stats: rows[0], sampleContact: sampleContact[0] };
    } catch (error) {
        console.error('Error analyzing contact info:', error);
    } finally {
        if (connection) await connection.end();
    }
}

analyzeContactInfo();