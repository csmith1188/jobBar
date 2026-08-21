const isAuthenticated = require('./isAuthenticated');

const ADMIN_FB_IDS = new Set(['1', '43']);

function isAdminUser(fbId) {
    return fbId != null && ADMIN_FB_IDS.has(String(fbId));
}

function isAdmin(req, res, next) {
    isAuthenticated(req, res, () => {
        if (!isAdminUser(req.session.fb_id)) {
            return res.status(403).send('Forbidden: Admin access required');
        }
        next();
    });
}

module.exports = isAdmin;
module.exports.isAdminUser = isAdminUser;
module.exports.ADMIN_FB_IDS = ADMIN_FB_IDS;
