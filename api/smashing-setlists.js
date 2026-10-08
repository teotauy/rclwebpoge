// Proxy for setlist.fm, used by /smashing-payouts.
// Keeps the API key server-side and only answers Smashing Pumpkins lookups,
// so the key can't be used as a general setlist.fm proxy.
// Needs the SETLISTFM_API_KEY environment variable in Vercel.

const API = 'https://api.setlist.fm/rest/1.0';
const ARTIST = 'The Smashing Pumpkins';

function send(res, status, body, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Short edge cache only: setlist.fm's terms don't allow keeping a persistent copy.
  res.setHeader('Cache-Control', cache ? 'public, s-maxage=600, stale-while-revalidate=60' : 'no-store');
  res.end(JSON.stringify(body));
}

function trim(s) {
  const [d, m, y] = String(s.eventDate || '').split('-');
  const city = s.venue && s.venue.city;
  const songs = [];
  for (const set of (s.sets && s.sets.set) || []) {
    for (const song of set.song || []) {
      if (!song || !song.name || song.tape) continue;
      songs.push({ name: song.name, cover: song.cover ? song.cover.name : null });
    }
  }
  return {
    id: s.id,
    date: y && m && d ? `${y}-${m}-${d}` : '',
    venue: (s.venue && s.venue.name) || '',
    city: city ? [city.name, city.stateCode, city.country && city.country.code !== 'US' ? city.country.name : null].filter(Boolean).join(', ') : '',
    tour: (s.tour && s.tour.name) || '',
    url: s.url || '',
    songs,
  };
}

async function search(key, params) {
  const url = `${API}/search/setlists?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json', 'User-Agent': 'SmashingPayouts/1.0 (redcrowlabs.com)' } });
  if (r.status === 404) return { setlist: [], total: 0 };
  if (!r.ok) { const e = new Error('upstream'); e.status = r.status; throw e; }
  return r.json();
}

module.exports = async (req, res) => {
  const key = (process.env.SETLISTFM_API_KEY || '').trim();
  const q = req.query || {};
  if (q.probe) return send(res, 200, { ready: Boolean(key) }, false);
  if (!key) return send(res, 503, { error: 'not_configured' }, false);

  const page = Math.max(1, Math.min(50, parseInt(q.page, 10) || 1));
  const params = { artistName: ARTIST, p: String(page) };
  if (/^\d{4}$/.test(q.year || '')) params.year = q.year;
  const where = String(q.q || '').trim().slice(0, 60);

  try {
    let data;
    if (where) {
      data = await search(key, { ...params, cityName: where });
      if (!(data.setlist || []).length) data = await search(key, { ...params, venueName: where });
    } else {
      data = await search(key, params);
    }
    const shows = (data.setlist || [])
      .filter(s => s.artist && s.artist.name === ARTIST)
      .map(trim)
      .filter(s => s.songs.length);
    const per = data.itemsPerPage || 20;
    return send(res, 200, { shows, page, more: page * per < (data.total || 0) }, true);
  } catch (e) {
    if (e.status === 429) return send(res, 429, { error: 'rate_limited' }, false);
    return send(res, 502, { error: 'upstream', status: e.status || null }, false);
  }
};
