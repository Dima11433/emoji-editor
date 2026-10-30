export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const {
      amount = 10,
      title = 'MAGNAT Emoji Studio',
      description = 'Оплата подписки MAGNAT Emoji Studio',
      payload = `stars_${Date.now()}`,
    } = req.body || {};

    const numericAmount = Math.max(1, Math.round(Number(amount)));
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '9138718385:AAGs-H7KUADtf2_QlU1ukIsKeEl6icd8y58';

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: String(title).slice(0, 32),
        description: String(description).slice(0, 255),
        payload: String(payload),
        currency: 'XTR',
        prices: [{ label: String(title).slice(0, 32), amount: numericAmount }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await tgRes.json();
    if (!data.ok) {
      return res.status(502).json({ ok: false, error: data.description || 'Telegram API error' });
    }

    return res.status(200).json({
      ok: true,
      invoiceLink: data.result,
      amount: numericAmount,
      currency: 'XTR',
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
