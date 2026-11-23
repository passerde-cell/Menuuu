// Cloudflare Worker:替你保管 Gemini API Key,讓不同使用者不用自己申請 Key。
// 部署:Cloudflare → Workers & Pages → Create → 貼上本檔 → Deploy。
// Settings → Variables and Secrets:
//   GEMINI_KEY  (Secret)  你的 Gemini API Key
//   ALLOW_ORIGIN (Text)   https://你的帳號.github.io   (只允許你的網站呼叫;非瀏覽器仍可偽造,不是真正的防護)
// 可選:在 Settings → Bindings 加上 Rate Limiting 綁定,名稱 LIMITER,限制每個 IP 的頻率。
// 重要:公開給大家用,費用由你的 Key 負擔。務必在 Google Cloud 設預算上限與提醒。
// 部署後,把 Worker 網址填到 App「設定」的「伺服器位址」。
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];   // 允許的型號,可自行調整

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || (env.ALLOW_ORIGIN && req.headers.get('Origin') !== env.ALLOW_ORIGIN))
      return new Response('forbidden', { status: 403, headers: cors });
    const model = new URL(req.url).searchParams.get('model');
    if (!MODELS.includes(model)) return new Response('bad model', { status: 400, headers: cors });
    const body = await req.text();
    if (body.length > 12_000_000) return new Response('too large', { status: 413, headers: cors });
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: req.headers.get('CF-Connecting-IP') || 'x' });
      if (!success) return new Response('rate limited', { status: 429, headers: cors });
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
      body,
    });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
