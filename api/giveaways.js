const { eventId, rulePath, overview, rules, errorPage, loadGiveaways } = require('../lib/giveaway-pages');
function createHandler(load = loadGiveaways) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); res.end(); return; }
    try {
      const { id, cursor } = req.query || {};
      if (id !== undefined && (typeof id !== 'string' || !eventId.test(id))) { const error = new Error(); error.status = 404; throw error; }
      if (cursor !== undefined && (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,300}$/.test(cursor))) { const error = new Error(); error.status = 400; throw error; }
      const data = await load(id ? { id } : cursor ? { cursor } : {});
      res.statusCode = 200;
      if (cursor) res.setHeader('X-Robots-Tag', 'noindex, follow');
      res.setHeader('Link', `<https://route25.app${id ? rulePath(id) : '/giveaways'}>; rel="canonical"`);
      const transitions = (data.event ? [data.event] : data.activeEvents)
        .filter(event => ['upcoming', 'open'].includes(event.phase))
        .map(event => event.phase === 'upcoming' ? event.startsAt : event.endsAt)
        .filter(time => Number.isFinite(time) && time > data.serverTime);
      let html = id ? rules(data.event) : overview(data, cursor);
      if (transitions.length) html = html.replace('<body ', `<body data-refresh-after="${Math.ceil(Math.min(...transitions) - data.serverTime + 100)}" `);
      res.end(req.method === 'HEAD' ? undefined : html);
    } catch (error) {
      res.statusCode = [400, 404].includes(error.status) ? error.status : 503;
      res.setHeader('X-Robots-Tag', 'noindex');
      if (res.statusCode === 503) res.setHeader('Retry-After', '60');
      res.end(req.method === 'HEAD' ? undefined : errorPage(res.statusCode));
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
