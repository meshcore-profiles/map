const { connect, connection } = require('mongoose');

connect(process.env.MONGODB_URL).catch(err => console.error('Failed to connect to the database', err));

connection.on('connected', () => console.log('Successfully connected to the database'));
connection.on('disconnected', () => console.warn('MongoDB disconnected!'));
connection.on('error', err => console.error('MongoDB error:', err.message));

module.exports = connection;
