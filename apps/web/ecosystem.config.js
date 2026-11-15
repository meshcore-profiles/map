module.exports = {
	apps: [{
		name: 'mcmap',
		script: './index.js',

		// Logging configuration
		log_date_format: 'HH:mm:ss.SSS DD.MM.YYYY',
		merge_logs: true,
		log_file: '/home/sefinek/logs/www/mapa.meshcorepolska.org/combined.log',
		out_file: '/home/sefinek/logs/www/mapa.meshcorepolska.org/out.log',
		error_file: '/home/sefinek/logs/www/mapa.meshcorepolska.org/error.log',

		// Application restart policy settings
		wait_ready: true,
		autorestart: true,
		max_restarts: 5,
		restart_delay: 4000,
		min_uptime: 13000,

		// Environment variables configuration
		env: {
			NODE_ENV: 'production',
		},
	}],
};