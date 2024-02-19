const WebSocket = require('ws');
const net = require('net');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("WebSocket Server running on port", PORT);

wss.on('connection', (ws) => {
  console.log('New client connected to WebSocket Server.');

  const mudClient = new net.Socket();
  mudClient.connect(4000, 'ifmud.port4000.com', () => {
    console.log('Connected to MUD server');
  });

  mudClient.setKeepAlive(true, 60000);

  mudClient.on('data', (data) => {
    console.log(`Received data from MUD server: ${data.length} bytes`);
    ws.send(data.toString(), (error) => {
      if (error) {
        console.log('Error sending data to WebSocket client:', error);
      }
    });
  });

  mudClient.on('error', (error) => {
    console.log('Error with MUD server connection:', error);
  });

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

  mudClient.on('close', (hadError) => {
    console.log('MUD server connection closed.', hadError ? 'Had error.' : 'No error.');
    ws.close();
  });
});
