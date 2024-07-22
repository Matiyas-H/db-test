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
        const parsedXML = await parseXML(contact.contactdata);
        const phoneNumbers = parsedXML.contact.subscription ? 
            parsedXML.contact.subscription[0].number.map(num => num._.trim()) : [];
        const email = parsedXML.contact.email ? parsedXML.contact.email[0]._.trim() : '';

        return {
            concernid: contact.concernid,
            personid: contact.personid,
            firstname: contact.firstname.trim(),
            lastname: contact.lastname.trim(),
            company: contact.company,
            title: contact.title,
            phoneNumbers: phoneNumbers,
            email: email,
            office: contact.office,
            organisation: contact.organisation,
            commentexternal: contact.commentexternal,
            commentinternal: contact.commentinternal,
            hideweb: contact.hideweb,
            alias: contact.alias,
            tcmsearch: contact.tcmsearch
        };
    }));
}

app.post('/api/search', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const { firstName, lastName, company } = req.body;

        let query = `
            SELECT *
            FROM directory
            WHERE 1=1
        `;
        const queryParams = [];

        if (firstName) {
            query += ` AND firstname LIKE ?`;
            queryParams.push(`%${firstName}%`);
        }
        if (lastName) {
            query += ` AND lastname LIKE ?`;
            queryParams.push(`%${lastName}%`);
        }
        if (company) {
            query += ` AND company LIKE ?`;
            queryParams.push(`%${company}%`);
        }

        query += ` LIMIT 10`;

        const [results] = await connection.execute(query, queryParams);

        if (results.length > 0) {
            const contacts = await processContactResults(results);
            res.json(contacts);
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

// New endpoint for company search
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
            res.json(contacts);
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});