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

// async function processContactResults(results) {
//     return await Promise.all(results.map(async (contact) => {
//         try {
//             const parsedXML = await parseXML(contact.contactdata);
//             const phoneNumbers = parsedXML.contact.subscription ? 
//                 parsedXML.contact.subscription[0].number.map(num => num._.trim()) : [];
//             const email = parsedXML.contact.email ? parsedXML.contact.email[0]._.trim() : '';

//             return {
//                 concernid: contact.concernid,
//                 personid: contact.personid,
//                 firstname: contact.firstname ? contact.firstname.trim() : '',
//                 lastname: contact.lastname ? contact.lastname.trim() : '',
//                 company: contact.company ? contact.company.trim() : '',
//                 title: contact.title ? contact.title.trim() : '',
//                 phoneNumbers: phoneNumbers,
//                 email: email,
//                 office: contact.office ? contact.office.trim() : '',
//                 organisation: contact.organisation ? contact.organisation.trim() : '',
//             };
//         } catch (error) {
//             console.error('Error processing contact:', error, 'Contact data:', contact);
//             return null;
//         }
//     }));
// }

async function processContactResults(results) {
    return await Promise.all(results.map(async (contact) => {
        try {
            const parsedXML = await parseXML(contact.contactdata);
            
            const phoneNumbers = parsedXML.contact && parsedXML.contact.subscription ? 
                parsedXML.contact.subscription.flatMap(sub => 
                    sub.number ? sub.number.map(num => num._ && typeof num._ === 'string' ? num._.trim() : '') : []
                ).filter(Boolean) : [];
            
            const email = parsedXML.contact && parsedXML.contact.email && 
                          parsedXML.contact.email[0] && parsedXML.contact.email[0]._ ? 
                          parsedXML.contact.email[0]._.trim() : '';

            return {
                concernid: contact.concernid,
                personid: contact.personid,
                firstname: contact.firstname && typeof contact.firstname === 'string' ? contact.firstname.trim() : '',
                lastname: contact.lastname && typeof contact.lastname === 'string' ? contact.lastname.trim() : '',
                company: contact.company && typeof contact.company === 'string' ? contact.company.trim() : '',
                title: contact.title && typeof contact.title === 'string' ? contact.title.trim() : '',
                phoneNumbers: phoneNumbers,
                email: email,
                office: contact.office && typeof contact.office === 'string' ? contact.office.trim() : '',
                organisation: contact.organisation && typeof contact.organisation === 'string' ? contact.organisation.trim() : '',
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

        if (!fullName || fullName.trim() === '' || !company || company.trim() === '') {
            return res.status(400).json({ message: 'Both full name and company are required' });
        }

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];

        const query = `
            SELECT *
            FROM directory
            WHERE (firstname LIKE ? AND lastname LIKE ?)
            AND (company LIKE ? OR organisation LIKE ?)
            LIMIT 1
        `;
        const queryParams = [`%${firstName}%`, `%${lastName}%`, `%${company}%`, `%${company}%`];

        const [results] = await connection.execute(query, queryParams);

        if (results.length > 0) {
            const contactDetails = await processContactResults(results);
            res.json(contactDetails[0]); // Return the first (and only) result
        } else {
            res.status(404).json({ message: 'No contact found' });
        }
    } catch (error) {
        console.error('Error searching for contact:', error);
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
            LIMIT 100
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



app.get('/api/company/:companyName', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const companyName = decodeURIComponent(req.params.companyName).toLowerCase();

        const query = `
            SELECT *
            FROM directory
            WHERE LOWER(company) LIKE ? OR LOWER(organisation) LIKE ?
            LIMIT 100
        `;

        const [results] = await connection.execute(query, [`%${companyName}%`, `%${companyName}%`]);

        if (results.length > 0) {
            const contacts = await processContactResults(results);
            const filteredContacts = contacts.filter(contact => contact !== null);
            
            // Group contacts by company and organisation
            const groupedContacts = filteredContacts.reduce((acc, contact) => {
                const key = contact.organisation || contact.company;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(contact);
                return acc;
            }, {});

            res.json({
                mainCompany: companyName,
                contacts: groupedContacts
            });
        } else {
            res.status(404).json({ message: 'No contacts found for this company or its related organisations' });
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



app.get('/api/company-structure/:companyName', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const companyName = decodeURIComponent(req.params.companyName).toLowerCase();

        const query = `
            SELECT *
            FROM directory
            WHERE LOWER(company) LIKE ?
            ORDER BY organisation, lastname, firstname
        `;

        const [results] = await connection.execute(query, [`%${companyName}%`]);

        if (results.length > 0) {
            const structuredData = await processCompanyStructure(results);
            res.json(structuredData);
        } else {
            res.status(404).json({ message: 'No data found for this company' });
        }
    } catch (error) {
        console.error('Error fetching company structure:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) await connection.end();
    }
});

async function processCompanyStructure(results) {
    const structuredData = {};

    for (const result of results) {
        try {
            const parsedXML = await parseXML(result.contactdata);
            const contact = parsedXML.contact;

            const company = result.company;
            const organisation = result.organisation || 'No Organization';

            if (!structuredData[company]) {
                structuredData[company] = {};
            }

            if (!structuredData[company][organisation]) {
                structuredData[company][organisation] = [];
            }

            const phoneNumbers = contact.subscription ? 
                contact.subscription.map(sub => sub.number[0]._).filter(num => num && num.trim() !== '') : [];

            const contactInfo = {
                personid: result.personid,
                concerned: result.concernid,
                firstname: result.firstname,
                lastname: result.lastname,
                title: result.title,
                email: contact.email ? contact.email[0]._ : '',
                phoneNumbers: phoneNumbers,
                office: contact.office ? contact.office[0] : '',
                tasks: contact.task ? contact.task.map(task => task._) : [],
                commentExternal: result.commentexternal,
                commentInternal: result.commentinternal,
                alias: contact.alias ? contact.alias[0] : '',
            };

            structuredData[company][organisation].push(contactInfo);
        } catch (error) {
            console.error('Error processing contact:', error, 'Contact data:', result);
        }
    }

    return structuredData;
}

app.get('/api/structured-search/:organization/:companyName', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const organization = decodeURIComponent(req.params.organization).toLowerCase();
        const companyName = decodeURIComponent(req.params.companyName).toLowerCase();

        const query = `
            SELECT *
            FROM directory
            WHERE LOWER(organisation) LIKE ? AND LOWER(company) LIKE ?
            ORDER BY lastname, firstname
        `;

        const [results] = await connection.execute(query, [`%${organization}%`, `%${companyName}%`]);

        if (results.length > 0) {
            const structuredData = await processStructuredResults(results);
            res.json(structuredData);
        } else {
            res.status(404).json({ message: 'No data found for this organization and company' });
        }
    } catch (error) {
        console.error('Error in structured search:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) await connection.end();
    }
});

async function processStructuredResults(results) {
    const structuredData = {};

    for (const result of results) {
        try {
            const parsedXML = await parseXML(result.contactdata);
            const contact = parsedXML.contact;

            const organisation = result.organisation || 'No Organization';
            const company = result.company || 'Unspecified Company';

            if (!structuredData[organisation]) {
                structuredData[organisation] = {};
            }

            if (!structuredData[organisation][company]) {
                structuredData[organisation][company] = [];
            }

            const phoneNumbers = contact.subscription ? 
                contact.subscription.flatMap(sub => 
                    sub.number ? sub.number.map(num => num._ && typeof num._ === 'string' ? num._.trim() : '') : []
                ).filter(Boolean) : [];

            const contactInfo = {
                personid: result.personid,
                concerned: result.concernid,
                firstname: result.firstname && typeof result.firstname === 'string' ? result.firstname.trim() : '',
                lastname: result.lastname && typeof result.lastname === 'string' ? result.lastname.trim() : '',
                title: result.title && typeof result.title === 'string' ? result.title.trim() : '',
                email: contact.email && contact.email[0] && contact.email[0]._ ? contact.email[0]._.trim() : '',
                phoneNumbers: phoneNumbers,
                office: contact.office && contact.office[0] ? contact.office[0] : '',
                tasks: contact.task ? contact.task.map(task => task && task._ ? task._.trim() : '').filter(Boolean) : [],
                commentExternal: result.commentexternal,
                commentInternal: result.commentinternal,
                alias: contact.alias && contact.alias[0] ? contact.alias[0] : '',
            };

            structuredData[organisation][company].push(contactInfo);
        } catch (error) {
            console.error('Error processing contact:', error, 'Contact data:', result);
        }
    }

    return structuredData;
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
