const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const CONFIG = {
  SOLANA_RPC: 'https://api.mainnet-beta.solana.com',
  PAYMENT_WALLET: process.env.SOLANA_WALLET || '',
  AGENTS_DAILY_TARGET: 150
};

let income = {
  todaySOL: 0,
  todayUSD: 0,
  totalSOL: 0,
  totalUSD: 0,
  dailyTarget: 150,
  transactions: [],
  payments: []
};

let agents = {
  orchestrator: { status: 'idle', earnings: 0 },
  leadgen: { status: 'idle', leads: 0, earnings: 0 },
  outreach: { status: 'idle', messages: 0, earnings: 0 },
  content: { status: 'idle', posts: 0, earnings: 0 },
  analytics: { status: 'idle', conversions: 0, earnings: 0 }
};

const SERVICES = [
  { id: 'lead-gen-daily', name: 'Daily Lead Generation', priceUSD: 25, description: '10 qualified leads daily', agent: 'leadgen', earnings: 15 },
  { id: 'outreach-daily', name: 'Daily Outreach', priceUSD: 50, description: '15 personalized messages daily', agent: 'outreach', earnings: 30 },
  { id: 'content-daily', name: 'Daily Content', priceUSD: 35, description: '2 professional posts daily', agent: 'content', earnings: 20 },
  { id: 'full-revops', name: 'Full RevOps Daily', priceUSD: 99, description: 'All 4 agents working for you', agent: 'orchestrator', earnings: 60 },
  { id: 'consulting', name: '1-on-1 Strategy Call', priceUSD: 75, description: '45 min strategy session', agent: 'analytics', earnings: 50 },
  { id: 'automation-setup', name: 'Automation Setup', priceUSD: 199, description: 'Full workflow automation', agent: 'orchestrator', earnings: 120 }
];

let solPrice = 150;

async function getSolPrice() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const json = await res.json();
    solPrice = json.solana?.usd || 150;
  } catch (e) {}
  return solPrice;
}

async function verifySolTransaction(signature) {
  try {
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', commitment: 'confirmed' }]
      })
    });
    const json = await res.json();
    if (json.result) {
      return { success: true, result: json.result };
    }
    return { success: false, error: 'Transaction not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

app.get('/api/config', (req, res) => {
  res.json({
    wallet: CONFIG.PAYMENT_WALLET || 'Set SOLANA_WALLET env variable',
    minPayment: 0.001
  });
});

app.get('/api/status', async (req, res) => {
  const price = await getSolPrice();
  res.json({ agents, income, solPrice: price, dailyProgress: Math.round((income.todayUSD / income.dailyTarget) * 100), services: SERVICES });
});

app.get('/api/services', async (req, res) => {
  const price = await getSolPrice();
  const servicePrices = SERVICES.map(s => ({ ...s, priceSOL: (s.priceUSD / price).toFixed(4), priceUSD: s.priceUSD }));
  res.json(servicePrices);
});

app.get('/api/prices', async (req, res) => {
  const price = await getSolPrice();
  res.json({ solPrice: price, services: SERVICES.map(s => ({ ...s, priceSOL: (s.priceUSD / price).toFixed(4) })) });
});

app.post('/api/demo-payment', async (req, res) => {
  const { serviceId } = req.body;
  const service = SERVICES.find(s => s.id === serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const price = await getSolPrice();
  const amountSOL = service.priceUSD / price;

  const payment = {
    id: 'demo_' + Date.now(),
    amountSOL, amountUSD: service.priceUSD,
    service: service.name, agent: service.agent,
    timestamp: new Date().toISOString(),
    confirmed: true, demo: true
  };

  income.transactions.push(payment);
  income.todaySOL += amountSOL;
  income.todayUSD += service.priceUSD;
  income.totalSOL += amountSOL;
  income.totalUSD += service.priceUSD;
  agents[service.agent].earnings += service.earnings;

  res.json({ success: true, payment });
});

app.post('/api/verify-payment', async (req, res) => {
  const { signature, serviceId } = req.body;
  if (!signature) return res.status(400).json({ error: 'Signature required' });

  const result = await verifySolTransaction(signature);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const service = SERVICES.find(s => s.id === serviceId);
  const price = await getSolPrice();
  const amountSOL = 0.1; // Parse actual amount from transaction
  const usdValue = amountSOL * price;

  const payment = {
    id: signature,
    amountSOL, amountUSD: usdValue,
    service: service?.name || 'Service',
    agent: service?.agent || 'orchestrator',
    timestamp: new Date().toISOString(),
    confirmed: true, onChain: true
  };

  income.transactions.push(payment);
  income.todaySOL += amountSOL;
  income.todayUSD += usdValue;
  income.totalSOL += amountSOL;
  income.totalUSD += usdValue;
  if (service) agents[service.agent].earnings += service.earnings;

  res.json({ success: true, payment });
});

app.post('/api/start-day', (req, res) => {
  Object.keys(agents).forEach(k => agents[k].status = 'active');
  res.json({ success: true });
});

app.post('/api/stop-day', (req, res) => {
  Object.keys(agents).forEach(k => agents[k].status = 'idle');
  res.json({ success: true });
});

app.get('/api/transactions', (req, res) => res.json(income.transactions.slice(0, 50)));

app.get('/api/wallet-info', (req, res) => {
  res.json({
    wallet: CONFIG.PAYMENT_WALLET || 'Configure SOLANA_WALLET env',
    explorer: CONFIG.PAYMENT_WALLET ? `https://solscan.io/account/${CONFIG.PAYMENT_WALLET}` : null
  });
});

app.use(express.static('public'));
app.get('*', (req, res) => res.sendFile(__dirname + '/public/index.html'));

app.listen(PORT, () => {
  console.log(`\n🚀 RevOps Agency running at http://localhost:${PORT}`);
  console.log(`💰 Wallet: ${CONFIG.PAYMENT_WALLET || 'Not configured'}\n`);
});

module.exports = app;
