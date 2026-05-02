// ⚠️ SECURITY: All credentials must be set as SECRETS in Cloudflare Workers dashboard.
// Then access them using global variables, e.g.:
// const ALPHA_VANTAGE_KEY = globalThis.ALPHA_VANTAGE_KEY || 'fallback-demo-key';
// const GEMINI_API_KEY = globalThis.GEMINI_API_KEY || 'fallback-demo-key';
// NEVER hardcode real keys in this file.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function nptHourMinute() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const npt = new Date(utc + (5 * 60 + 45) * 60000);
  return { hour: npt.getHours(), minute: npt.getMinutes() };
}

async function cacheKV(key, data, ttl = 300) {
  await NEPSE_KV.put(key, JSON.stringify(data), { expirationTtl: ttl });
}

async function getKV(key) {
  const raw = await NEPSE_KV.get(key);
  return raw ? JSON.parse(raw) : null;
}

// Multi-source fetch with Cloudflare caching
async function fetchWithFallback(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cf: { cacheTtl: 30 } });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return res;
    } catch (e) {
      console.error(`Fetch failed for ${url}: ${e.message}`);
    }
  }
  throw new Error('All sources exhausted');
}

// NEPSE Index collector
async function fetchNepseIndex() {
  const sources = [
    'https://www.nepalstock.com/api/nots/nepse-index',
    'https://merolagani.com/LatestMarket.aspx',
    'https://www.sharepricenepal.com/nepse-index'
  ];
  try {
    const res = await fetchWithFallback(sources);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      const data = await res.json();
      return { index: data.index, change: data.change_percent, updated: Date.now() };
    } else {
      const html = await res.text();
      const match = html.match(/(\d+\.\d+)/);
      if (!match) throw new Error('HTML parse failed');
      return { index: parseFloat(match[1]), change: null, updated: Date.now() };
    }
  } catch (e) {
    const cached = await getKV('nepse_index');
    if (cached) return cached;
    throw new Error('NEPSE index unavailable');
  }
}

// Fear & Greed (simplified – real implementation includes all 7 components)
async function computeFearGreed() {
  // ... calculation from cached NEPSE and other indicators
  const value = 50; // placeholder
  const label = value < 30 ? 'डर' : value > 70 ? 'लोभ' : 'Neutral';
  return { value, label };
}

// Basic in‑memory rate limiter (per IP)
const RATE_LIMIT = new Map();
function isRateLimited(ip, limit = 30, windowMs = 60000) {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 1;
    entry.reset = now + windowMs;
  } else {
    entry.count++;
  }
  RATE_LIMIT.set(ip, entry);
  return entry.count > limit;
}

// Request handler
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Rate limit API endpoints
  if (path.startsWith('/api/') && isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (path === '/api/ticker') {
      const ticker = await getKV('ticker_cache') || [];
      return new Response(JSON.stringify({ ticker }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/fear-and-greed') {
      const fng = await getKV('fear_greed') || { value: 50, label: 'Neutral' };
      return new Response(JSON.stringify(fng), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/technicals') {
      const sym = url.searchParams.get('symbol') || 'NEPSE';
      const tech = await getKV(`technicals_${sym}`) || [];
      return new Response(JSON.stringify({ indicators: tech }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/patterns') {
      const sym = url.searchParams.get('symbol') || 'NEPSE';
      const pat = await getKV(`patterns_${sym}`) || [];
      return new Response(JSON.stringify({ patterns: pat }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/ai-prediction') {
      const pred = await getKV('ai_prediction') || 'Awaiting first analysis...';
      return new Response(JSON.stringify({ prediction: pred }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/broadcast' && request.method === 'POST') {
      const body = await request.json();
      const masterPassword = globalThis.MASTER_PASSWORD || 'gyanendra@#&5009'; // fallback
      if (body.password !== masterPassword) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 403,
          headers: corsHeaders
        });
      }
      // Broadcast logic (Telegram + Facebook) goes here
      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  } catch (e) {
    console.error(`Error on ${path}:`, e.message);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Scheduled job – runs every minute via Cron Trigger
async function scheduled(event) {
  try {
    const nepse = await fetchNepseIndex();
    await cacheKV('nepse_index', nepse);

    const fng = await computeFearGreed();
    await cacheKV('fear_greed', fng);

    // ... update ticker, technicals, patterns, AI on special hours
    // Broadcast triggering logic here
  } catch (e) {
    console.error('Scheduled job error:', e);
  }
}

addEventListener('fetch', event => event.respondWith(handleRequest(event.request)));
addEventListener('scheduled', event => event.waitUntil(scheduled(event)));
