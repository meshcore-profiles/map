import timeout from 'express-timeout-handler';
import ApiError from '../utils/httpError.js';

export default () => timeout.handler({
	timeout: 15000,
	onTimeout: (req, res) => ApiError(res, 503),
	disable: ['write', 'setHeaders', 'send', 'json', 'end'],
});
