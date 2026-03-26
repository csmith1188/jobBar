require('dotenv').config();
const router = require('express').Router();
const isAuthenticated = require('../middleware/isAuthenticated');

// Home route
router.get('/', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    const fbId = req.session.fb_id;
    let user = '';
    try {
        user = await new Promise((resolve, reject) => db.get('SELECT * FROM users WHERE fb_id = ?', [fbId], (e, row) => e ? reject(e) : resolve(row)));
        if (!user) return res.status(404).send('User not found');
    } catch (err) {
        console.log(err);
    }
    res.render('index', { title: 'Home', user });
});

module.exports = router;