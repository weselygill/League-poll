import { getStore } from '@netlify/blobs';

const STORE = 'family-league-2026';
const VOTES = 'votes';
const CHAT = 'chat';
const CHAT_CAP = 120;

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const clean = (s, n) => String(s || '').trim().slice(0, n);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default async (req) => {
  const store = getStore(STORE);

  const votes = (await store.get(VOTES, { type: 'json' })) || [];
  const chat = (await store.get(CHAT, { type: 'json' })) || [];

  if (req.method === 'GET') return json({ votes, chat });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request body' }, 400);
  }

  // ---- a vote ------------------------------------------------------
  if (body.type === 'vote') {
    const name = clean(body.name, 60);
    if (name.length < 2) return json({ error: 'Name required' }, 400);

    const out = body.status === 'out';
    const entry = {
      name,
      status: out ? 'out' : 'in',
      buyIn: out ? null : clean(body.buyIn, 12),
      slots: out
        ? []
        : (Array.isArray(body.slots) ? body.slots : []).slice(0, 40).map((s) => clean(s, 24)),
      at: Date.now(),
    };

    const next = votes.filter((v) => norm(v.name) !== norm(name)).concat([entry]);
    await store.setJSON(VOTES, next);
    return json({ votes: next, chat });
  }

  // ---- a message ---------------------------------------------------
  if (body.type === 'chat') {
    const who = clean(body.who, 60);
    const text = clean(body.text, 220);
    if (!who || !text) return json({ error: 'Nothing to send' }, 400);

    const next = chat
      .concat([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, who, text, at: Date.now() }])
      .slice(-CHAT_CAP);
    await store.setJSON(CHAT, next);
    return json({ votes, chat: next });
  }

  // ---- delete your own message -------------------------------------
  if (body.type === 'delete') {
    const who = norm(body.who);
    const next = chat.filter((m) => !(m.id === body.id && norm(m.who) === who));
    await store.setJSON(CHAT, next);
    return json({ votes, chat: next });
  }

  return json({ error: 'Unknown action' }, 400);
};

export const config = { path: '/api/poll' };
