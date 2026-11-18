const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/database.sqlite');
const db = new sqlite3.Database(dbPath);

function columnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) return reject(err);
            resolve(columns.some(column => column.name === columnName));
        });
    });
}

async function migrate() {
    try {
        const exists = await columnExists('users', 'is_manager');

        if (!exists) {
            await new Promise((resolve, reject) => {
                db.run(
                    'ALTER TABLE users ADD COLUMN is_manager INTEGER NOT NULL DEFAULT 0',
                    err => err ? reject(err) : resolve()
                );
            });
            console.log('Added users.is_manager column.');
        } else {
            console.log('users.is_manager column already exists.');
        }

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET is_manager = 0 WHERE is_manager IS NULL',
                err => err ? reject(err) : resolve()
            );
        });

        console.log('Manager status migration completed successfully.');
    } catch (err) {
        console.error('Manager status migration failed:', err);
        process.exitCode = 1;
    } finally {
        db.close();
    }
}

migrate();
