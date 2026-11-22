import { Schema, model } from 'mongoose';

const TesterSignupSchema = new Schema({
	email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
	language: { type: String, enum: ['pl', 'en'], default: 'pl' },
	consentAt: { type: Date, required: true },
	notifiedAt: { type: Date, default: null },
	threadMessageId: { type: String, default: null },
}, { timestamps: true, versionKey: false });

export default model('TesterSignup', TesterSignupSchema);
