const router = require('express').Router();
const isAdmin = require('../middleware/isAdmin');

router.get('/admin', isAdmin, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.fb_id;

    const query = `
        SELECT companies.*, users.username AS owner_username
        FROM companies
        LEFT JOIN users ON CAST(users.fb_id AS TEXT) = CAST(companies.owner_id AS TEXT)
        ORDER BY companies.id DESC
    `;

    db.get('SELECT * FROM users WHERE fb_id = ?', [userId], (userErr, user) => {
        if (userErr || !user) {
            return res.status(userErr ? 500 : 404).send(
                userErr ? 'Internal Server Error' : 'User not found'
            );
        }

        db.all(query, (err, companies) => {
            if (err) {
                console.error('Database error loading admin companies:', err);
                return res.status(500).send('Internal Server Error');
            }

            res.render('admin', {
                companies: companies || [],
                user
            });
        });
    });
});

module.exports = router;
