const express = require('express');
const mysql = require('mysql2/promise');
const xml2js = require('xml2js');
const util = require('util');

const app = express();
const port = process.env.PORT || 3000;

const parseXML = util.promisify(xml2js.parseString);

app.use(express.json());

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'dialokxml'
    });
}

async function processContactResults(results) {
    return await Promise.all(results.map(async (contact) => {
        try {
            const parsedXML = await parseXML(contact.contactdata);
            const phoneNumbers = parsedXML.contact.subscription ? 
                parsedXML.contact.subscription[0].number.map(num => num._.trim()) : [];
            const email = parsedXML.contact.email ? parsedXML.contact.email[0]._.trim() : '';

            return {
                concernid: contact.concernid,
                personid: contact.personid,
                firstname: contact.firstname ? contact.firstname.trim() : '',
                lastname: contact.lastname ? contact.lastname.trim() : '',
                company: contact.company ? contact.company.trim() : '',
                title: contact.title ? contact.title.trim() : '',
                phoneNumbers: phoneNumbers,
                email: email,
                office: contact.office ? contact.office.trim() : '',
                organisation: contact.organisation ? contact.organisation.trim() : '',
            };
        } catch (error) {
            console.error('Error processing contact:', error, 'Contact data:', contact);
            return null;
        }
    }));
}

app.post('/api/search', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const { fullName, company } = req.body;

        if (!fullName || fullName.trim() === '') {
            return res.status(400).json({ message: 'Full name is required' });
        }

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];

        let query = `
            SELECT *
            FROM directory
            WHERE firstname LIKE ? AND lastname LIKE ?
        `;
        const queryParams = [`%${firstName}%`, `%${lastName}%`];

        if (company) {
            query += ` AND company LIKE ?`;
            queryParams.push(`%${company}%`);
        }

        query += ` LIMIT 10`;

        const [results] = await connection.execute(query, queryParams);

        if (results.length > 0) {
            const contacts = await processContactResults(results);
            const filteredContacts = contacts.filter(contact => contact !== null);
            res.json(filteredContacts);
        } else {
            res.status(404).json({ message: 'No contacts found' });
        }
    } catch (error) {
        console.error('Error searching for contacts:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) await connection.end();
    }
});

app.get('/api/company/:companyName', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const companyName = req.params.companyName;

        const query = `
            SELECT *
            FROM directory
            WHERE company LIKE ?
            LIMIT 50
        `;

        const [results] = await connection.execute(query, [`%${companyName}%`]);

        if (results.length > 0) {
            const contacts = await processContactResults(results);
            const filteredContacts = contacts.filter(contact => contact !== null);
            res.json(filteredContacts);
        } else {
            res.status(404).json({ message: 'No contacts found for this company' });
        }
    } catch (error) {
        console.error('Error searching for company contacts:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) await connection.end();
    }
});

app.get('/api/sample-data', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        // First, get the column names
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dialokxml' AND TABLE_NAME = 'directory'
            ORDER BY ORDINAL_POSITION
        `);

        // Then, fetch a sample of the data
        const [sampleData] = await connection.execute(`
            SELECT *
            FROM directory
            LIMIT 20
        `);

        // Process the data to handle potential large fields
        const processedSampleData = sampleData.map(record => {
            const processedRecord = {};
            for (const key in record) {
                if (typeof record[key] === 'string' && record[key].length > 1000) {
                    processedRecord[key] = record[key].substring(0, 1000) + '... (truncated)';
                } else {
                    processedRecord[key] = record[key];
                }
            }
            return processedRecord;
        });

        res.json({
            columns: columns.map(col => col.COLUMN_NAME),
            sampleData: processedSampleData
        });
    } catch (error) {
        console.error('Error fetching sample data:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) await connection.end();
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});