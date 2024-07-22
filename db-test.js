const mysql = require('mysql2/promise');
const xml2js = require('xml2js');
const util = require('util');

const parseXML = util.promisify(xml2js.parseString);

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
                COUNT(CASE WHEN alias != '' THEN 1 END) AS contacts_with_alias,
                COUNT(CASE WHEN contactdata LIKE '%<number%' THEN 1 END) AS contacts_with_phone
            FROM 
                directory;
        `);

        // Function to search for a person by phone number
        async function searchByPhoneNumber(phoneNumber) {
            const [results] = await connection.execute(`
                SELECT *
                FROM directory
                WHERE contactdata LIKE ?
                LIMIT 1;
            `, [`%<number secret="false" call="true" xfer="true">${phoneNumber}</number>%`]);

            if (results.length > 0) {
                const contact = results[0];
                const parsedXML = await parseXML(contact.contactdata);
                return {
                    personid: contact.personid,
                    firstname: contact.firstname,
                    lastname: contact.lastname,
                    company: contact.company,
                    title: contact.title,
                    phoneNumber: phoneNumber,
                    // Add other fields as needed
                };
            }
            return null;
        }

        console.log('INFO');
        console.log('Contact Information Analysis:');
        console.log('INFO');
        console.log(JSON.stringify(rows[0], null, 2));
        
        // Example of searching by phone number
        const samplePhoneNumber = '1234567890'; // Replace with an actual phone number for testing
        const contactByPhone = await searchByPhoneNumber(samplePhoneNumber);
        
        console.log('INFO');
        console.log('Sample Contact by Phone Number:');
        console.log('INFO');
        console.log(JSON.stringify(contactByPhone, null, 2));

        return { stats: rows[0], contactByPhone };
    } catch (error) {
        console.error('Error analyzing contact info:', error);
    } finally {
        if (connection) await connection.end();
    }
}

analyzeContactInfo();