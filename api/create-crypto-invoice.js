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
      amount = 180,
      currency = 'RUB',
      asset = 'USDT',
      description = 'MAGNAT Emoji Studio',
      orderId,
    } = req.body || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ ok: false, error: 'Amount must be greater than zero' });
    }

    const token = process.env.CRYPTO_BOT_TOKEN || '660970:AApeeKG0rlbHg2iFyzdDfJWqc7GiNok2Oxv';
    const ref = orderId || `MG-CRYPTO-${Date.now().toString(36).toUpperCase()}`;

    const payloadData = {
      currency_type: currency === 'RUB' ? 'fiat' : 'crypto',
      amount: String(amount),
      description: `${description} (${ref})`,
      payload: JSON.stringify({ ref, project: 'MAGNAT' }),
      paid_btn_name: 'openBot',
      paid_btn_url: 'https://emoji-editor-ten.vercel.app?payment=success',
    };

    if (currency === 'RUB') {
      payloadData.fiat = 'RUB';
      payloadData.accepted_assets = asset || 'USDT';
    } else {
      payloadData.asset = asset || 'USDT';
    }

    const botRes = await fetch('https://pay.crypt.bot/api/createInvoice', {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadData),
      signal: AbortSignal.timeout(10000),
    });

    const data = await botRes.json();
    if (!data.ok) {
      return res.status(502).json({ ok: false, error: data.error?.name || 'CryptoBot API error' });
    }

    return res.status(200).json({
      ok: true,
      invoiceId: data.result.invoice_id,
      payUrl: data.result.pay_url,
      botInvoiceUrl: data.result.bot_invoice_url,
      miniAppInvoiceUrl: data.result.mini_app_invoice_url,
      amount: data.result.amount,
      asset: data.result.asset,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
