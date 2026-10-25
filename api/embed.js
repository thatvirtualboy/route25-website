const embeds = require('../lib/embeds');
function createHandler({ loadTrainer = embeds.loadTrainer, loadCollection = embeds.loadCollection } = {}) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', embeds.EMBED_CSP);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    const send = (status, html) => { res.statusCode = status; res.end(req.method === 'HEAD' ? '' : html); };
    if (!['GET','HEAD'].includes(req.method || 'GET')) {
      res.setHeader('Allow','GET, HEAD'); send(405, embeds.renderError('This embed is read-only.')); return;
    }
    const opts = embeds.options(req.query);
    if (!opts) { send(404, embeds.renderError('Embed not found.')); return; }
    try {
      const data = opts.kind === 'trainer' ? await loadTrainer(opts.id) : await loadCollection(opts);
      if (!data) { send(404, embeds.renderError(opts.kind === 'trainer' ? 'Profile not found.' : 'Collection link unavailable.', opts.theme)); return; }
      send(200, opts.kind === 'trainer' ? embeds.renderTrainer(data,opts) : embeds.renderCollection(data,opts));
    } catch {
      res.setHeader('Retry-After','30');
      send(503, embeds.renderError('Temporarily unavailable.', opts.theme));
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
