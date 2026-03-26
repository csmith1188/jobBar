const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');

router.get('/allJobs', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    const fbId = req.session.fb_id;
    let user = '';
    try {
        user = await new Promise((resolve, reject) => db.get('SELECT * FROM users WHERE fb_id = ?', [fbId], (e, row) => e ? reject(e) : resolve(row)));
        if (!user) return res.status(404).send('User not found');
    } catch (err) {
        console.log(err);
    }

    // Query to get all available jobs (no employee assigned and not completed)
    // Join with companies to get company description, and job_applications to check if user applied
    const query = `
        SELECT 
            j.*,
            c.name as company_name,
            c.description as company_description,
            CASE WHEN ja.fb_id IS NOT NULL THEN 1 ELSE 0 END as you_applied
        FROM jobs j
        LEFT JOIN companies c ON j.company = c.name COLLATE NOCASE
        LEFT JOIN job_applications ja ON j.id = ja.job_id AND ja.fb_id = ?
        WHERE j.employee_id IS NULL 
          AND (j.status IS NULL OR j.status != 'completed')
        ORDER BY j.id DESC
    `;

    db.all(query, [fbId], (err, jobs) => {
        if (err) {
            console.error('Error fetching all jobs:', err);
            return res.status(500).send('Internal Server Error');
        }

        res.render('allJobs', { 
            jobs,
            fb_id: fbId,
            user
        });
    });
});

module.exports = router;
