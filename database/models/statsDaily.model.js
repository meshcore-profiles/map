const { Schema, model } = require('mongoose');

const TypeCountsSchema = new Schema({
	client: { type: Number, default: 0 },
	repeater: { type: Number, default: 0 },
	roomServer: { type: Number, default: 0 },
	sensor: { type: Number, default: 0 },
}, { _id: false });

const StatusCountsSchema = new Schema({
	recent: { type: Number, default: 0 },
	stale: { type: Number, default: 0 },
	old: { type: Number, default: 0 },
	extinct: { type: Number, default: 0 },
	none: { type: Number, default: 0 },
}, { _id: false });

const StatsDailySchema = new Schema({
	region: { type: String, required: true, enum: ['pl', 'all'] },
	date: { type: String, required: true },
	total: { type: Number, required: true },
	active: { type: Number, required: true },
	nodes: { type: Number, required: true },
	types: { type: TypeCountsSchema, required: true },
	status: { type: StatusCountsSchema, required: true },
}, { timestamps: true, versionKey: false });

StatsDailySchema.index({ region: 1, date: 1 }, { unique: true });

module.exports = model('StatsDaily', StatsDailySchema);
