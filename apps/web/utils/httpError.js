module.exports = (res, status, err) => {
	if (err) console.error(err);
	res.status(status).end();
};
