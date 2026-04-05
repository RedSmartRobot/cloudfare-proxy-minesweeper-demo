/**
 * Cloudflare Worker — AI Proxy for Minesweeper Agent Demo
 *
 * Routes requests to Groq or Google Gemini depending on the
 * X-AI-Provider header sent by the demo page.
 *
 * Environment variables to set in Cloudflare dashboard:
 *   GROQ_API_KEY   — your Groq API key
 *   GEMINI_API_KEY — your Google AI Studio API key
 *
 * Both providers use OpenAI-compatible /chat/completions format,
 * so the same request body works for both.
 */

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// --- CORS headers — allow your demo page to call this worker ---
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-AI-Provider',
};

export default {
  async fetch(request, env) {

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Only POST is supported', { status: 405, headers: CORS });
    }

    // Determine provider from header (default: groq)
    const provider = (request.headers.get('X-AI-Provider') || 'groq').toLowerCase();

    let targetUrl, apiKey;
    if (provider === 'gemini') {
      targetUrl = GEMINI_URL;
      apiKey    = env.GEMINI_API_KEY;
    } else {
      targetUrl = GROQ_URL;
      apiKey    = env.GROQ_API_KEY;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key for "${provider}" is not configured in the worker.` }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // Forward the request body unchanged
    let body;
    try {
      body = await request.text();
    } catch {
      return new Response('Could not read request body', { status: 400, headers: CORS });
    }

    // Call the upstream AI API
    let upstream;
    try {
      upstream = await fetch(targetUrl, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to reach upstream API: ' + err.message }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // Return the upstream response, adding CORS headers
    const responseBody    = await upstream.text();
    const responseHeaders = { ...CORS, 'Content-Type': 'application/json' };

    return new Response(responseBody, {
      status:  upstream.status,
      headers: responseHeaders,
    });
  },
};
