require('dotenv').config();
const router = require('express').Router();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const isAuthenticated = require('../middleware/isAuthenticated');

// Avoid requiring the app (prevents circular require issues). Open the DB directly.
const dbFile = path.resolve(__dirname, '../database/database.sqlite');
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error('Failed to open database in free route:', err);
});

// Companies route
router.get('/companies', isAuthenticated, async (req, res) => {
    const fb = req.session && req.session.fb_id ? String(req.session.fb_id) : null;
    const fbId = req.session.fb_id;
    let user = '';

    try {
        user = await new Promise((resolve, reject) => db.get('SELECT * FROM users WHERE fb_id = ?', [fbId], (e, row) => e ? reject(e) : resolve(row)));
        if (!user) return res.status(404).send('User not found');
    } catch (err) {
        console.log(err);
    }

    db.all('SELECT * FROM companies ORDER BY id DESC', (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        const normalized = (rows || []).map(r => ({
            ...r,
            verified: Number(r.verified) || 0,
            isOwner: fb ? (String(r.owner_id) === fb) : false
        }));
        res.render('companies', { companies: normalized, user, fb_id: fb });
    });
});

// Delete a company and related data (owner-only or admin)
router.post('/companies/delete', isAuthenticated, (req, res) => {
    const companyId = req.body.companyId;
    const referrer = req.get('Referer') || '/companies';
    if (!companyId) return res.status(400).send('Missing company id');

    db.get('SELECT * FROM companies WHERE id = ?', [companyId], (err, company) => {
        if (err) { console.error('DB error fetching company for delete', err); return res.status(500).send('Internal Server Error'); }
        if (!company) return res.status(404).send('Company not found');

        const ownerFb = company.owner_id != null ? String(company.owner_id) : null;
        const userFb = req.session && req.session.fb_id ? String(req.session.fb_id) : null;

        // allow admin (fb '1') or company owner
        if (userFb !== '1' && ownerFb !== userFb) {
            return res.status(403).send('You do not have permission to delete this company');
        }

        // perform cascading deletes: jobs -> job_applications -> job_application_files; positions -> position_applications -> job_application_files; position_tags
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Jobs and their applications/files
            db.all('SELECT id FROM jobs WHERE company = ?', [company.name], (jobRows) => {
                const jobIds = (jobRows || []).map(r => r.id);
                if (jobIds.length > 0) {
                    const phJobs = jobIds.map(() => '?').join(',');
                    db.all(`SELECT id FROM job_applications WHERE job_id IN (${phJobs})`, jobIds, (appRows) => {
                        const appIds = (appRows || []).map(r => r.id);
                        if (appIds.length > 0) {
                            const phApps = appIds.map(() => '?').join(',');
                                db.run(`DELETE FROM job_application_files WHERE application_id IN (${phApps})`, appIds, function(errf) {
                                    if (errf) console.error('Error deleting job_application_files for jobs', errf);
                                });
                                // delete any applicant details associated with these applications
                                db.run(`DELETE FROM job_applicant_details WHERE application_id IN (${phApps})`, appIds, function(errd) {
                                    if (errd) console.error('Error deleting job_applicant_details for jobs', errd);
                                });
                        }
                        db.run(`DELETE FROM job_applications WHERE job_id IN (${phJobs})`, jobIds, function(errja) {
                            if (errja) console.error('Error deleting job_applications for jobs', errja);
                        });
                        db.run('DELETE FROM jobs WHERE company = ?', [company.name], function(errj) { if (errj) console.error('Error deleting jobs for company', errj); });
                    });
                }
            });

            // Positions and their applications/files and tags
            db.all('SELECT id FROM company_positions WHERE company_id = ?', [company.id], (posRows) => {
                const posIds = (posRows || []).map(r => r.id);
                if (posIds.length > 0) {
                    const phPos = posIds.map(() => '?').join(',');

                    // delete files for position applications
                    db.all(`SELECT id FROM position_applications WHERE position_id IN (${phPos})`, posIds, (posAppRows) => {
                        const posAppIds = (posAppRows || []).map(r => r.id);
                        if (posAppIds.length > 0) {
                            const phPosApps = posAppIds.map(() => '?').join(',');
                            db.run(`DELETE FROM job_application_files WHERE application_id IN (${phPosApps})`, posAppIds, function(errpf) {
                                if (errpf) console.error('Error deleting job_application_files for position applications', errpf);
                            });
                            // delete any applicant details tied to these position applications
                            db.run(`DELETE FROM job_applicant_details WHERE application_id IN (${phPosApps})`, posAppIds, function(errpd) {
                                if (errpd) console.error('Error deleting job_applicant_details for position applications', errpd);
                            });
                        }
                        db.run(`DELETE FROM position_applications WHERE position_id IN (${phPos})`, posIds, function(errpa) { if (errpa) console.error('Error deleting position_applications', errpa); });
                    });

                    // delete position tags
                    db.run(`DELETE FROM position_tags WHERE position_id IN (${phPos})`, posIds, function(errpt) { if (errpt) console.error('Error deleting position_tags', errpt); });

                    // delete positions
                    db.run(`DELETE FROM company_positions WHERE id IN (${phPos})`, posIds, function(errp) { if (errp) console.error('Error deleting company_positions', errp); });
                }
            });

            // remove company employees records
            db.run('DELETE FROM company_employees WHERE company_id = ?', [company.id], function(errce) { if (errce) console.error('Error deleting company_employees for company', errce); });

            // Finally delete the company
            db.run('DELETE FROM companies WHERE id = ?', [company.id], function(errc) {
                if (errc) console.error('Error deleting company', errc);
            });

            db.run('COMMIT');
            return res.redirect(referrer);
        });
    });
});

// Transfer company ownership (owner or admin only)
router.post('/companies/transfer-owner', isAuthenticated, (req, res) => {
    const companyId = req.body.companyId;
    const newOwnerFb = req.body.newOwnerFb ? String(req.body.newOwnerFb).trim() : null;
    if (!companyId || !newOwnerFb) return res.status(400).send('Missing parameters');

    db.get('SELECT * FROM companies WHERE id = ?', [companyId], (err, company) => {
        if (err) { console.error('DB error fetching company for transfer', err); return res.status(500).send('Internal Server Error'); }
        if (!company) return res.status(404).send('Company not found');

        const ownerFb = company.owner_id != null ? String(company.owner_id) : null;
        const userFb = req.session && req.session.fb_id ? String(req.session.fb_id) : null;

        // Only admin (fb '1') or current owner may transfer
        if (userFb !== '1' && ownerFb !== userFb) {
            return res.status(403).send('You do not have permission to transfer this company');
        }

        db.run('UPDATE companies SET owner_id = ? WHERE id = ?', [newOwnerFb, companyId], function(uErr) {
            if (uErr) { console.error('Error transferring ownership', uErr); return res.status(500).send('Internal Server Error'); }
            return res.redirect('/profile');
        });
    });
});
module.exports = router;