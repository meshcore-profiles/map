const router = require('express').Router();
const { expo } = require('../../mobile/app.json');

// Digital Asset Links: lets Android verify that the app may open links of both sites (the intent filter in apps/mobile/app.json has autoVerify).
// The release key comes from app.json; ANDROID_PLAY_CERT_SHA256 (comma separated) adds the Play App Signing key from the Play Console.
const normalize = value => value.replaceAll(':', '').toUpperCase().match(/.{2}/g)?.join(':');
const fingerprints = [expo.extra.androidCertSha256, ...(process.env.ANDROID_PLAY_CERT_SHA256 || '').split(',')]
	.map(value => normalize(value?.trim() ?? ''))
	.filter(Boolean);

const assetLinks = [{
	relation: ['delegate_permission/common.handle_all_urls'],
	target: { namespace: 'android_app', package_name: expo.android.package, sha256_cert_fingerprints: [...new Set(fingerprints)] },
}];

router.get('/.well-known/assetlinks.json', (req, res) => {
	res.set('Cache-Control', 'public, max-age=3600').type('application/json').json(assetLinks);
});

module.exports = router;
