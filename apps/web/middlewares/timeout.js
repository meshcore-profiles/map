import createTimeout from '../../../global/middlewares/timeout.js';
import HttpError from '../utils/httpError.js';

export default () => createTimeout({ onTimeout: res => HttpError(res, 503) });
