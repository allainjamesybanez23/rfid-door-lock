const express = require('express');
const mqtt = require('mqtt');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// MQTT Configuration
const mqttBroker = 'mqtt://172.20.10.3'; // Replace with your MQTT broker IP
const accessTopic = 'rfid/access'; // Topic for access commands
const errorTopic = 'rfid/error'; // Topic for errors

let lastCommand = '';
let registeredUID = ''; // Stores the UID of the last registered card
const clients = []; // List of connected clients for Server-Sent Events (SSE)

const client = mqtt.connect(mqttBroker);

// MQTT Connection and Subscription
client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe([accessTopic, errorTopic], (err) => {
    if (err) {
      console.error('Subscription error:', err);
    }
  });
});

client.on('message', (topic, message) => {
  const command = message.toString().trim();
  console.log(`Message received on topic ${topic}: ${command}`);

  if (topic === errorTopic) {
    console.log(`Invalid Card Detected: ${command}`);
    broadcast(`ERROR: Invalid card detected - ${command}`);
  } else if (topic === accessTopic) {
    if (command === lastCommand) {
      console.log(`Duplicate message ignored: ${command}`);
      return;
    }

    lastCommand = command;
    console.log(`Processing command: ${command}`);
    broadcast(command);
  }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Route: Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route: Publish commands to MQTT
app.post('/publish', (req, res) => {
  const { command } = req.body;

  if (command) {
    console.log(`Command received: ${command}`);
    client.publish(accessTopic, command, (err) => {
      if (err) {
        console.error('Error publishing to MQTT broker:', err);
        res.status(500).send('Error publishing message');
      } else {
        let responseMessage = '';

        // Provide specific feedback for lock/unlock commands
        switch (command) {
          case 'lock':
            responseMessage = 'Door is Locked 🔒';
            break;
          case 'unlock':
            responseMessage = 'Door is Unlocked 🔓';
            break;
          default:
            responseMessage = `Command "${command}" sent successfully`;
        }

        console.log(responseMessage); // Debug statement
        res.status(200).send(responseMessage);
      }
    });
  } else {
    res.status(400).send('No command received');
  }
});
// Route: Register an RFID card
app.post('/register', (req, res) => {
  const { uid } = req.body;

  if (uid) {
    registeredUID = uid;
    client.publish(accessTopic, `register:${uid}`, (err) => {
      if (err) {
        console.error('Error registering UID:', err);
        res.status(500).send('Error registering UID');
      } else {
        console.log(`Card UID registered: ${uid}`);
        broadcast(`Registered UID: ${uid}`);
        res.status(200).send(`Card UID "${uid}" registered successfully`);
      }
    });
  } else {
    res.status(400).send('No UID provided');
  }
});

// Route: SSE for real-time events
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write('data: Connected to server\n\n');
  clients.push({ res });

  // Notify about the registered UID if available
  if (registeredUID) {
    res.write(`data: Registered UID: ${registeredUID}\n\n`);
  }

  req.on('close', () => {
    console.log('Client disconnected');
    const index = clients.findIndex(client => client.res === res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

// Broadcast messages to all connected clients
function broadcast(message) {
  clients.forEach(client => {
    client.res.write(`data: ${message}\n\n`);
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
