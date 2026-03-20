require('dotenv').config();
const router = require('express').Router();
const isAuthenticated = require('../middleware/isAuthenticated');

router.get('/edit/company/:companyId', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    const fb_id = req.session.fb_id;
    const userFb = fb_id ? String(fb_id) : null;
    const fbId = req.session.fb_id;
    let user = '';

    try {
        user = await new Promise((resolve, reject) => db.get('SELECT * FROM users WHERE fb_id = ?', [fbId], (e, row) => e ? reject(e) : resolve(row)));
        if (!user) return res.status(404).send('User not found');
    } catch (err) {
        console.log(err);
    }
    if (!fb_id) {
        return res.status(403).send('Forbidden: You must be logged in to edit a company');
    }
    const query = `SELECT * FROM companies WHERE id = ? COLLATE NOCASE`;
    db.get(query, [req.params.companyId], (err, company) => {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }
        if (!company) {
            return res.status(404).send('Company not found');
        }
        // render shared edit page with company context
        res.render('edit', { type: 'company', company, user });
    });
});

router.post('/edit/company/:companyId', isAuthenticated, (req, res) => {
    const db = req.app.locals.db;
    const fb_id = req.session.fb_id;
    if (!fb_id) {
        return res.status(403).send('Forbidden: You must be logged in to edit a company');
    }
    const { name, description, link, pColor, sColor } = req.body;
    if (!name || !description || !link || !pColor || !sColor) {
        return res.status(400).send('All fields are required.');
    }
    const query = `UPDATE companies SET name = ?, description = ?, link = ?, pColor = ?, sColor = ? WHERE owner_id = ? COLLATE NOCASE`;
    db.run(query, [name, description, link, pColor, sColor, fb_id], function(err) {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/jobManager/' + encodeURIComponent(name));
    });
});

router.get('/edit/job/:jobId', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    const fb_id = req.session.fb_id;
    const userFb = fb_id ? String(fb_id) : null;
    const jobId = req.params.jobId;
    const fbId = req.session.fb_id;
    let user = '';

    try {
        user = await new Promise((resolve, reject) => db.get('SELECT * FROM users WHERE fb_id = ?', [fbId], (e, row) => e ? reject(e) : resolve(row)));
        if (!user) return res.status(404).send('User not found');
    } catch (err) {
        console.log(err);
    }
    if (!fb_id) {
        return res.status(403).send('Forbidden: You must be logged in to edit a job');
    }
    const query = `SELECT j.*, c.owner_id FROM jobs j LEFT JOIN companies c ON j.company = c.name WHERE j.id = ?`;
    db.get(query, [jobId], (err, job) => {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }
        if (!job) {
            return res.status(404).send('Job not found');
        }
        // ensure the session user is the owner of the company that the job belongs to (or admin '1')
        const companyOwnerFb = job.owner_id != null ? String(job.owner_id) : null;
        // if the job isn't associated with any company, only allow admin (fb '1') to proceed
        if (!companyOwnerFb && userFb !== '1') {
            return res.status(403).send('Forbidden: Job is not associated with a company you own');
        }
        // require that the current user matches the company owner (unless admin)
        if (userFb !== '1' && companyOwnerFb !== userFb) {
            return res.status(403).send("Forbidden: You do not own this job's company");
        }
        // If the job is already in progress or completed, prevent editing and redirect back to manager
        if (job.status === 'in_progress' || job.status === 'completed') {
            const companyName = job.company || '';
            return res.redirect('/jobManager/' + encodeURIComponent(companyName) + '?error=' + encodeURIComponent('Too late to edit this job.'));
        }
        // fetch company details for styling/hidden fields on the job edit page
        const compQuery = `SELECT * FROM companies WHERE name = ?`;
        db.get(compQuery, [job.company], (err2, company) => {
            if (err2) {
                return res.status(500).send('Internal Server Error');
            }
            // render shared edit page with job + company context
            res.render('edit', { type: 'job', job, company: company || null, user });
        });
    });
});

router.post('/edit/job/:jobId', isAuthenticated, (req, res) => {
    const db = req.app.locals.db;
    const fb_id = req.session.fb_id;
    const jobId = req.params.jobId;
    if (!fb_id) {
        return res.status(403).send('Forbidden: You must be logged in to edit a job');
    }
    const { title, description, pay, link } = req.body;
    if (!title || !description || !pay) {
        return res.status(400).send('Title, description, and pay are required.');
    }
    // accept link as optional (store empty string if missing)
    const safeLink = typeof link !== 'undefined' && link !== null ? String(link) : '';
    // verify ownership and that job is editable (not in_progress or completed)
    db.get('SELECT j.*, c.owner_id FROM jobs j LEFT JOIN companies c ON j.company = c.name WHERE j.id = ?', [jobId], (err, job) => {
        if (err) {
            console.error('Database error checking job before edit:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!job) return res.status(404).send('Job not found');

        const companyOwnerFb = job.owner_id != null ? String(job.owner_id) : null;
        const userFb = fb_id ? String(fb_id) : null;

        // if the job isn't associated with any company, only allow admin (fb '1') to proceed
        if (!companyOwnerFb && userFb !== '1') {
            return res.status(403).send('Forbidden: Job is not associated with a company you own');
        }

        // require that the current user matches the company owner (unless admin)
        if (userFb !== '1' && companyOwnerFb !== userFb) {
            return res.status(403).send("Forbidden: You do not own this job's company");
        }

        // prevent editing if already in progress or completed
        if (job.status === 'in_progress' || job.status === 'completed') {
            const companyName = job.company || '';
            return res.redirect('/jobManager/' + encodeURIComponent(companyName) + '?error=' + encodeURIComponent('Too late to edit this job.'));
        }

        const query = `UPDATE jobs SET title = ?, description = ?, pay = ?, link = ? WHERE id = ?`;
        db.run(query, [title, description, pay, safeLink, jobId], function(err2) {
            if (err2) {
                console.error('Database error updating job:', err2);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/jobManager/' + encodeURIComponent(req.body.company));
        });
    });
});

// --- routes for editing positions ---
router.get('/edit/position/:positionId', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    const fb_id = req.session.fb_id;
    const userFb = fb_id ? String(fb_id) : null;
    const positionId = req.params.positionId;
    const fbId = req.session.fb_id;
    let user = '';

    try {
        user = await new Promise((resolve, reject) => db.get('SELECT * FROM users WHERE fb_id = ?', [fbId], (e, row) => e ? reject(e) : resolve(row)));
        if (!user) return res.status(404).send('User not found');
    } catch (err) {
        console.log(err);
    }

    if (!fb_id) {
        return res.status(403).send('Forbidden: You must be logged in to edit a position');
    }

    const query = `SELECT p.*, c.owner_id, c.name AS company_name FROM company_positions p LEFT JOIN companies c ON p.company_id = c.id WHERE p.id = ?`;
    db.get(query, [positionId], (err, position) => {
        if (err) {
            console.error('Database error fetching position:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!position) return res.status(404).send('Position not found');

        const companyOwnerFb = position.owner_id != null ? String(position.owner_id) : null;
        // if the position isn't associated with any company, only allow admin (fb '1')
        if (!companyOwnerFb && userFb !== '1') return res.status(403).send('Forbidden: Position is not associated with a company you own');
        if (userFb !== '1' && companyOwnerFb !== userFb) return res.status(403).send("Forbidden: You do not own this position's company");

        if (position.status === 'in_progress' || position.status === 'filled' || position.status === 'completed') {
            const companyName = position.company_name || '';
            return res.redirect('/positionManager/' + encodeURIComponent(companyName) + '?error=' + encodeURIComponent('Too late to edit this position.'));
        }

        // fetch company details and tags for rendering
        db.get('SELECT * FROM companies WHERE id = ?', [position.company_id], (err2, company) => {
            if (err2) {
                console.error('Database error fetching company for position edit:', err2);
                return res.status(500).send('Internal Server Error');
            }

            db.all('SELECT t.name FROM tags t JOIN position_tags pt ON pt.tag_id = t.id WHERE pt.position_id = ?', [positionId], (tErr, tagRows) => {
                if (tErr) {
                    console.error('Database error fetching position tags:', tErr);
                    return res.status(500).send('Internal Server Error');
                }
                const tags = (tagRows || []).map(r => r.name);
                res.render('edit', { type: 'position', position, company: company || null, tags, user });
            });
        });
    });
});

router.post('/edit/position/:positionId', isAuthenticated, (req, res) => {
    const db = req.app.locals.db;
    const fb_id = req.session.fb_id;
    const positionId = req.params.positionId;

    if (!fb_id) return res.status(403).send('Forbidden: You must be logged in to edit a position');

    const { title, description, link } = req.body;
    if (!title || !description) return res.status(400).send('Title and description are required.');

    db.get('SELECT p.*, c.owner_id, c.name AS company_name FROM company_positions p LEFT JOIN companies c ON p.company_id = c.id WHERE p.id = ?', [positionId], (err, position) => {
        if (err) {
            console.error('Database error checking position before edit:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!position) return res.status(404).send('Position not found');

        const companyOwnerFb = position.owner_id != null ? String(position.owner_id) : null;
        const userFb = fb_id ? String(fb_id) : null;
        if (!companyOwnerFb && userFb !== '1') return res.status(403).send('Forbidden: Position is not associated with a company you own');
        if (userFb !== '1' && companyOwnerFb !== userFb) return res.status(403).send("Forbidden: You do not own this position's company");

        if (position.status === 'in_progress' || position.status === 'filled' || position.status === 'completed') {
            const companyName = position.company_name || '';
            return res.redirect('/positionManager/' + encodeURIComponent(companyName) + '?error=' + encodeURIComponent('Too late to edit this position.'));
        }

        const updateQuery = 'UPDATE company_positions SET title = ?, description = ?, link = ? WHERE id = ?';
        db.run(updateQuery, [title, description, link || '', positionId], function(updateErr) {
            if (updateErr) {
                console.error('Database error updating position:', updateErr);
                return res.status(500).send('Internal Server Error');
            }
            const companyName = position.company_name || '';
            res.redirect('/positionManager/' + encodeURIComponent(companyName));
        });
    });
});

module.exports = router;