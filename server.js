const WebSocket = require('ws');
const net = require('net');
const https = require('https');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

// Load SSL/TLS certificates
const serverOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/zach-samuels.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/zach-samuels.com/fullchain.pem')
};

// Create an HTTPS server
const httpsServer = https.createServer(serverOptions);
httpsServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Pass the HTTPS server to the WebSocket.Server constructor
const wss = new WebSocket.Server({ server: httpsServer });

wss.on('connection', (ws) => {
  const mudClient = new net.Socket();
  mudClient.connect(4000, 'ifmud.port4000.com', () => {
    console.log('Connected to MUD server');
  });

  mudClient.setKeepAlive(true, 60000);

  mudClient.on('data', (data) => {
    ws.send(data.toString());
  });

  ws.on('message', (message) => {

    // If message is a Buffer (binary data), convert it to a string
    if (Buffer.isBuffer(message)) {
      const messageAsString = message.toString();
      console.log("Writing message: ", messageAsString);
      mudClient.write(messageAsString);
    } else {
      // For text data, message is already a string
      console.log("Writing message: ", message);
      mudClient.write(message);
    }
  });
  

  ws.on('close', () => {
    mudClient.end();
    console.log('Disconnected from MUD server');
  });
});