const { Schema, model } = require('mongoose');

const TesterSignupSchema = new Schema({
	email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
	language: { type: String, enum: ['pl', 'en'], default: 'pl' },
	consentAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

module.exports = model('TesterSignup', TesterSignupSchema);
