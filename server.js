const WebSocket = require('ws');
const net = require('net');

const wss = new WebSocket.Server({ port: process.env.PORT || 80 });
console.log("Port: ", process.env.port || 80)

wss.on('connection', (ws) => {
  const mudClient = new net.Socket();
  mudClient.
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