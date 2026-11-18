const router = require('express').Router();
const isAdmin = require('../middleware/isAdmin');

router.get('/admin', isAdmin, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.fb_id;

    const companyQuery = `
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

        db.all(companyQuery, (companyErr, companies) => {
            if (companyErr) {
                console.error('Database error loading admin companies:', companyErr);
                return res.status(500).send('Internal Server Error');
            }

            db.all('SELECT id, fb_id, username, is_manager FROM users ORDER BY username COLLATE NOCASE, id', (usersErr, users) => {
                if (usersErr) {
                    if (usersErr.message.includes('is_manager')) {
                        return res.status(500).send('Manager status is not migrated. Run npm run migrate:manager-status');
                    }
                    console.error('Database error loading admin users:', usersErr);
                    return res.status(500).send('Internal Server Error');
                }

                res.render('admin', {
                    companies: companies || [],
                    users: users || [],
                    user
                });
            });
        });
    });
});

router.post('/admin/users/manager', isAdmin, (req, res) => {
    const db = req.app.locals.db;
    const fbId = String(req.body.fbId || '').trim();
    const isManager = req.body.isManager === 'true' ? 1 : 0;

    if (!fbId) return res.status(400).send('Missing user Formbar ID');

    db.run('UPDATE users SET is_manager = ? WHERE fb_id = ?', [isManager, fbId], function (err) {
        if (err) {
            console.error('Database error updating manager status:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (this.changes === 0) return res.status(404).send('User not found');
        res.redirect('/admin');
    });
});

module.exports = router;
