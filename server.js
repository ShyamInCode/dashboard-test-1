require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));



const gAccess_token = null;
// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set the views directory

async function getSalesforceData(token) {
  const headers = {
    "Content-Type": "text/xml;charset=UTF-8",
    "SOAPAction": "Retrieve",
    "Authorization": `Bearer ${token}`
  };
  const url = "https://mclxdpbrg2n9j1y8ftm46zszshqy.soap.marketingcloudapis.com/Service.asmx";
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
    <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <s:Header>
        <a:Action s:mustUnderstand="1">Retrieve</a:Action>
        <a:To s:mustUnderstand="1">${url}</a:To>
        <fueloauth xmlns="http://exacttarget.com">${token}</fueloauth>
      </s:Header>
      <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
          <RetrieveRequest>
            <ObjectType>Automation</ObjectType>
            <Properties>Name</Properties>
            <Properties>Description</Properties>
            <Properties>CustomerKey</Properties>
            <Properties>IsActive</Properties>
            <Properties>CreatedDate</Properties>
            <Properties>ModifiedDate</Properties>
            <Properties>Status</Properties>
            <Properties>ProgramID</Properties>
            <Properties>CategoryID</Properties>
            <Properties>LastRunTime</Properties>
            <Properties>ScheduledTime</Properties>
            <Properties>LastSaveDate</Properties>
            <Properties>ModifiedBy</Properties>
            <Properties>CreatedBy</Properties>
            <Properties>AutomationType</Properties>
            <Properties>RecurrenceID</Properties>
            <Filter xsi:type="SimpleFilterPart">
              <Property>IsActive</Property>
              <SimpleOperator>equals</SimpleOperator>
              <Value>true</Value>
            </Filter>
          </RetrieveRequest>
        </RetrieveRequestMsg>
      </s:Body>
    </s:Envelope>`;

  try {
    const response = await axios.post(url, soapBody, { headers });
    return response.data;
  } catch (error) {
    console.error("Error fetching data from Salesforce:", error.response ? error.response.data : error.message);
    throw error;
  }
}


function extractRelevantData(xmlData) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });
  const jsonData = parser.parse(xmlData);

  // Navigate to the Results array
  const results = jsonData['soap:Envelope']['soap:Body']
    .RetrieveResponseMsg.Results;

  const statusMap = {
    '-1': 'Error',
    '0': 'Building Error',
    '1': 'Building',
    '2': 'Ready',
    '3': 'Running',
    '4': 'Paused',
    '5': 'Stopped',
    '6': 'Scheduled',
    '7': 'Awaiting Trigger',
    '8': 'Inactive Trigger'
  };

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return dateString.replace('T', ', ').split('.')[0];
  }

  return results.map(result => ({
    BusinessUnit: 'Corporate',
    Name: result.Name || 'N/A',
    Description: result.Description || 'N/A',
    CustomerKey: result.CustomerKey || 'N/A',
    IsActive: result.IsActive,
    CreatedDate: formatDate(result.CreatedDate),
    ModifiedDate: formatDate(result.ModifiedDate),
    Status: statusMap[result.Status] || 'Unknown',
    ProgramID: result.ProgramID || 'N/A',
    CategoryID: result.CategoryID || 'N/A',
    LastRunTime: formatDate(result.LastRunTime),
    ScheduledTime: formatDate(result.ScheduledTime),
    LastSaveDate: formatDate(result.LastSaveDate),
    ModifiedBy: result.ModifiedBy || 'N/A',
    CreatedBy: result.CreatedBy || 'N/A',
    AutomationType: result.AutomationType || 'N/A',
    RecurrenceID: result.RecurrenceID || 'N/A'
  }));
}

app.get('/login', (req, res) => {
  const authUrl = `${process.env.AUTH_URL}?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
  console.log('Authorization URL:', authUrl);
  res.redirect(authUrl);
});

app.get('/oauth2/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post(process.env.TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI
    });
    
    // Store the access token in the session or a variable
    gAccess_token = response.data.access_token; // Ensure you have session middleware set up

    // Redirect to the dashboard
    const accessToken = gAccess_token; // Adjust this based on your implementation

  if (!accessToken) {
    return res.status(401).send('Unauthorized: No access token found');
  }

  try {
    const salesforceData = await getSalesforceData(accessToken);
    const extractedData = extractRelevantData(salesforceData);

    // Prepare data for rendering (only Business Unit Name and Status)
    const renderData = extractedData.map(item => ({
      Name: item.Name,
      Status: item.Status
    }));

    // Render the dashboard EJS file with the extracted data
    res.render('data', { data: renderData });
  } catch (error) {
    console.error('Error fetching data for dashboard:', error);
    res.status(500).send('Error fetching data for dashboard');
  }
  } catch (error) {
    console.error('Error getting token:', error.response ? error.response.data : error.message);
    res.status(500).send('Authentication failed');
  }
});

app.get('/logout', (req, res) => {
  // Clear any stored tokens or sessions here
  res.redirect('/');
});

app.get('/debug-env', (req, res) => {
  res.json({
    REDIRECT_URI: process.env.REDIRECT_URI,
    AUTH_URL: process.env.AUTH_URL,
    CLIENT_ID: process.env.CLIENT_ID
  });
});

app.get('/dashboard', async (req, res) => {
  // Assuming you have a way to store the access token, e.g., in session or a global variable
  
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
