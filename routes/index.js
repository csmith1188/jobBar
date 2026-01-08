require('dotenv').config();
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const isAuthenticated = require('../middleware/isAuthenticated');

// Home route
router.get('/', isAuthenticated, (req, res) => {
    res.render('index', { title: 'Home' });
});

module.exports = router;