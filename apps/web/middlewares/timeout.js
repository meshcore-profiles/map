const timeout = require('express-timeout-handler');
const ApiError = require('../utils/httpError.js');

module.exports = () => timeout.handler({
	timeout: 15000,
	onTimeout: (req, res) => ApiError(res, 503),
	disable: ['write', 'setHeaders', 'send', 'json', 'end'],
});
