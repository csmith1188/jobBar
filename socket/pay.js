const io = require('socket.io-client');

const socket = io("https://formbeta.yorktechapps.com/", {
    extraHeaders: {
        api: process.env.API_KEY || ''
    }
});

const data = {
    from: 1,
    to: 1,
    amount: 10,
    reason: 'test',
    pin: 1234
};



socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('transferDigipogs', data);
});

socket.on('transferResponse', (response) => {
    console.log('Transfer Response:', response);
    socket.disconnect();
});

socket.on('connect_error', (err) => {
    console.error('Connection Error:', err.message);
});

