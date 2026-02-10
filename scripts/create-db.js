import mysql from 'mysql2/promise';

async function createDb() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'tkdgur619!', // Hardcoded for now based on user input, or assume .env is not loaded here easily without dotenv
    });

    try {
        await connection.query('CREATE DATABASE IF NOT EXISTS boj_helper');
        console.log('Database boj_helper created or already exists.');
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await connection.end();
    }
}

createDb();
