require('dotenv').config();
const WebSocket = require('ws');
const net = require('net');
const https = require('https');
const fs = require('fs');

// Environmental variables
const PORT = process.env.PORT || 8080;
const MUD_SERVER_ADDRESS = process.env.MUD_SERVER_ADDRESS;
const MUD_SERVER_PORT = process.env.MUD_SERVER_PORT;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL) || 30000;

try {
  // Load SSL/TLS certificates
  const serverOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };

  // Create an HTTPS server
  const httpsServer = https.createServer(serverOptions);
  httpsServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  // Pass the HTTPS server to the WebSocket.Server constructor
  const wss = new WebSocket.Server({ server: httpsServer });

  // Function to send a ping to each client
  function heartbeat() {
    this.isAlive = true;
  }

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    const ip = req.socket.remoteAddress;
    console.log('New client connected to WebSocket Server: ', ip);
    const mudServer = new net.Socket();
    mudServer.connect(MUD_SERVER_PORT, MUD_SERVER_ADDRESS, () => {
      console.log('Connected to MUD server from ', ip);
    });

    mudServer.setKeepAlive(true);

    mudServer.on('data', (data) => {
      console.log(`Received data from MUD server: ${data.length} bytes`);
      ws.send(data.toString(), (error) => {
        if (error) {
          console.log('Error sending data to WebSocket client:', error);
        }
      });
    });

    mudServer.on('error', (error) => {
      console.log('Error with MUD server connection:', error);
    });

    mudServer.on('close', (hadError) => {
      console.log('MUD server connection closed.', hadError ? 'Had error.' : 'No error.');
      ws.close();
    });

    ws.on('message', (message) => {
      console.log(`Received message from WebSocket client: ${message.length} bytes`);
      // If message is a Buffer (binary data), convert it to a string
      if (Buffer.isBuffer(message)) {
        const messageAsString = message.toString();
        mudServer.write(messageAsString, (error) => {
          if (error) {
            console.log('Error sending data to MUD server:', error);
          }
        });
      } else {
        // For text data, message is already a string
        mudServer.write(message, (error) => {
          if (error) {
            console.log('Error sending data to MUD server:', error);
          }
        });
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason}`);
      mudServer.end();
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
  }, PING_INTERVAL);

  // Cleanup on server close
  wss.on('close', function close() {
    clearInterval(interval);
  });

} catch (error) {
  console.error('Error starting server:', error);
}
