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

        // Original query with added phone number count
        const [generalStats] = await connection.execute(`
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
                COUNT(CASE WHEN alias != '' THEN 1 END) AS contacts_with_alias,
                COUNT(CASE WHEN phone != '' THEN 1 END) AS contacts_with_phone
            FROM 
                directory;
        `);

        // Query to get a sample company structure
        const [sampleCompany] = await connection.execute(`
            SELECT *
            FROM directory
            WHERE company != ''
            LIMIT 1;
        `);

        // Query to get a sample person structure
        const [samplePerson] = await connection.execute(`
            SELECT *
            FROM directory
            WHERE firstname != '' AND lastname != ''
            LIMIT 1;
        `);

        console.log('Contact Information Analysis:');
        console.log(JSON.stringify(generalStats[0], null, 2));
        console.log('\nSample Company Structure:');
        console.log(JSON.stringify(sampleCompany[0], null, 2));
        console.log('\nSample Person Structure:');
        console.log(JSON.stringify(samplePerson[0], null, 2));

        return {
            generalStats: generalStats[0],
            sampleCompany: sampleCompany[0],
            samplePerson: samplePerson[0]
        };
    } catch (error) {
        console.error('Error analyzing contact info:', error);
    } finally {
        if (connection) await connection.end();
    }
}

analyzeContactInfo();
