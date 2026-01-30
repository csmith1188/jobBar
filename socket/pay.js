const io = require('socket.io-client');
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

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

router.post('/api/digipogs/transfer', (req, res) => {
    // req.body gets the information sent from the client
    const cost = req.body.price;
    const payload = req.body;
    const reason = payload.reason;
    const pin = payload.pin;
    const id = req.session.user.fid; // Formbar user ID of payer from session
   
   
    console.log(cost, reason, pin, id);
    const paydesc = {
        from: id, // Formbar user ID of payer
        to: 30,    // Formbar user ID of payee (e.g., pog collecting's account)
        amount: cost,
        reason: reason,
        // security pin for the payer's account
        pin: pin,
        pool: true
    };
    // make a direct transfer request using fetch
    fetch(`${AUTH_URL}/api/digipogs/transfer`, {
        method: 'POST',
        // headers to specify json content
        headers: { 'Content-Type': 'application/json' },
        // stringify the paydesc object to send as JSON
        body: JSON.stringify(paydesc),
    }).then((transferResult) => {
        return transferResult.json();
    }).then((responseData) => {
        console.log("Transfer Response:", responseData);
        //res.JSON must be here to send the response back to the client
        res.json(responseData);
    }).catch(err => {
        console.error("Error during digipog transfer:", err);
        res.status(500).json({ message: 'Error during digipog transfer' });
    });
});