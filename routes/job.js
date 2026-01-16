require('dotenv').config();
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const isAuthenticated = require('../middleware/isAuthenticated');

// JOB ROUTE
router.get('/job', isAuthenticated, (req, res) => {
    const db = req.app.locals.db;

    const query = `SELECT * FROM freelance_companies`;

    db.all(query, [], (err, companies) => {
        if (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.render('job', { companies });
    });
});
module.exports = router;