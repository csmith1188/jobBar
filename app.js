require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const AUTH_URL = process.env.AUTH_URL || 'localhost:4000/auth';
const THIS_URL = process.env.THIS_URL || 'http://localhost:3000/login';

const db = new sqlite3.Database('./database/database.sqlite', (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to database');
    }
});

// Make database available to other modules
app.locals.db = db;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

// expose the current user's database manager status to all views and routes
app.use((req, res, next) => {
    const fb = req.session && req.session.fb_id;
    res.locals.fb_id = fb || null;
    res.locals.isAdmin = isAdminUser(fb);

    if (!fb) {
        res.locals.isManager = false;
        res.locals.CPOST = Number(process.env.CPOST || 300);
        res.locals.JPOST = Number(process.env.JPOST || 100);
        res.locals.EPOST = Number(process.env.EPOST || 5);
        return next();
    }

    db.get('SELECT is_manager FROM users WHERE fb_id = ?', [fb], (err, user) => {
        res.locals.isManager = !err && Boolean(user && Number(user.is_manager));
        res.locals.CPOST = Number(process.env.CPOST || 300);
        res.locals.JPOST = Number(process.env.JPOST || 100);
        res.locals.EPOST = Number(process.env.EPOST || 5);
        next();
    });
});

// expose helpers to check company ownership/permission
app.use((req, res, next) => {
    const fb = req.session && req.session.fb_id ? String(req.session.fb_id) : null;

    // Promise-based check: resolves true if fb is 1 (super user) or matches company owner_id
    req.canManageCompany = (companyId) => {
        return new Promise((resolve, reject) => {
            if (!fb) return resolve(false);
            if (fb === '1') return resolve(true);
            if (!companyId) return resolve(false);

            const id = String(companyId).replace(/^\/|\/$/g, ''); // normalize if a path slipped in
            db.get('SELECT owner_id FROM companies WHERE id = ?', [id], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(false);
                resolve(String(row.owner_id) === fb);
            });
        });
    };

    // convenience middleware helper for routes/views (note: this is async and should be awaited in routes)
    req.ensureCanManageCompany = async (companyId) => {
        const ok = await req.canManageCompany(companyId).catch(() => false);
        if (!ok) {
            const err = new Error('Forbidden');
            err.status = 403;
            throw err;
        }
    };

    // expose a non-async hint to views (best-effort; actual checks should use req.canManageCompany in routes)
    res.locals.canManageCompanyHint = (companyId) => {
        if (!fb) return false;
        if (fb === '1') return true;
        // unknown until checked against DB, so return null to indicate "unknown"
        return null;
    };

    next();
});

// Routes
const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
const companiesRouter = require('./routes/companies');
const postRouter = require('./routes/post');
const jobPostsRouter = require('./routes/jobPosts');
const jobRouter = require('./routes/job');
const payRouter = require('./routes/payment');
const jobManagerRouter = require('./routes/jobManager');
const positionManagerRouter = require('./routes/positionManager');
const eJobRouter = require('./routes/eJob');
const ePostRouter = require('./routes/ePost');
const positionRouter = require('./routes/position');
const filesRouter = require('./routes/files');
const allJobsRouter = require('./routes/allJobs');
const editRouter = require('./routes/edit');
const eformRouter = require('./routes/Eform');
const profileRouter = require('./routes/profile');
const homeRouter = require('./routes/home');
const adminRouter = require('./routes/admin');
const { isAdminUser } = require('./middleware/isAdmin');

// Register routes
app.use('/', editRouter);
app.use('/', indexRouter);
app.use('/', eformRouter);
app.use('/', homeRouter);
app.use('/', profileRouter);
app.use('/', eJobRouter);
app.use('/', ePostRouter);
app.use('/', positionRouter);
app.use('/', filesRouter);
app.use('/', loginRouter);
app.use('/', companiesRouter);
app.use('/', postRouter);
app.use('/', jobPostsRouter);
app.use('/', allJobsRouter);
app.use('/', jobRouter);
app.use('/', payRouter);
app.use('/', jobManagerRouter);
app.use('/', positionManagerRouter);
app.use('/', adminRouter);


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;