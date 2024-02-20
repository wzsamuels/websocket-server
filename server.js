require('dotenv').config(); // Using dotenv for environment variables
const WebSocket = require('ws');
const net = require('net');
const https = require('https');
const fs = require('fs');
const winston = require('winston'); // Winston for logging

// Load environment variables or use defaults
const PORT = process.env.PORT || 8080;
const MUD_SERVER_ADDRESS = process.env.MUD_SERVER_ADDRESS || 'ifmud.port4000.com';
const MUD_SERVER_PORT = process.env.MUD_SERVER_PORT || 4000;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '/path/to/your/privkey.pem';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/path/to/your/fullchain.pem';
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL) || 30000;

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: 'server.log' })
  ],
});

// Load SSL/TLS certificates
const serverOptions = {
  key: fs.readFileSync(SSL_KEY_PATH),
  cert: fs.readFileSync(SSL_CERT_PATH)
};

// Create an HTTPS server
const httpsServer = https.createServer(serverOptions);
httpsServer.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

// WebSocket server setup
const wss = new WebSocket.Server({ server: httpsServer });

function heartbeat() {
  this.isAlive = true;
}

function connectToMudServer(ws) {
  const mudClient = new net.Socket();
  mudClient.connect(4000, 'ifmud.port4000.com', () => {
    console.log('Connected to MUD server');
    mudClient.setKeepAlive(true);
  });

  mudClient.on('error', (error) => {
    console.log('Error with MUD server connection:', error);
    // Optionally, implement reconnection logic here
  });

  mudClient.on('data', (data) => {
    console.log(`Received data from MUD server: ${data.length} bytes`);
    ws.send(data.toString(), (error) => {
      if (error) {
        console.log('Error sending data to WebSocket client:', error);
      }
    });
  });
  
  mudClient.on('close', (hadError) => {
    console.log('MUD server connection closed.', hadError ? 'Had error.' : 'No error.');
    console.log('MUD server connection closed. Attempting to reconnect...');
    // Wait for a few seconds before attempting to reconnect
    setTimeout(() => connectToMudServer(ws), 5000);
  });

  return mudClient;
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  const ip = req.socket.remoteAddress;
  logger.info('New client connected to WebSocket Server: ', ip);
  
  const mudClient = connectToMudServer(ws);

  ws.on('message', (message) => {
    console.log(`Received message from WebSocket client: ${message.length} bytes`);
    // If message is a Buffer (binary data), convert it to a string
    if (Buffer.isBuffer(message)) {
      const messageAsString = message.toString();
      mudClient.write(messageAsString, (error) => {
        if (error) {
          console.log('Error sending data to MUD server:', error);
        }
      });
    } else {
      // For text data, message is already a string
      mudClient.write(message, (error) => {
        if (error) {
          console.log('Error sending data to MUD server:', error);
        }
      });
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason}`);
    mudClient.end();
  });

  ws.on('error', (error) => {
    console.log('WebSocket error:', error);
  });
});

// Interval to check if clients are still alive
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Ping interval set to 30 seconds

// Cleanup on server close
wss.on('close', function close() {
  clearInterval(interval);
});
