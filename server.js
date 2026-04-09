import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const DATA_DIR = join(__dirname, 'data');

function loadData(filename, defaultData = []) {
  const filepath = join(DATA_DIR, filename);
  if (existsSync(filepath)) {
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  }
  return defaultData;
}

function saveData(filename, data) {
  const filepath = join(DATA_DIR, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
}

let agentState = {
  orchestrator: { status: 'idle', lastUpdate: null, dailyGoal: 150 },
  leadgen: { status: 'idle', leadsFound: 0, target: 50 },
  outreach: { status: 'idle', messagesSent: 0, target: 30 },
  content: { status: 'idle', piecesCreated: 0, target: 3 },
  analytics: { status: 'idle', conversions: 0, revenue: 0 }
};

let activityLog = [];
let income = { today: 0, dailyTarget: 150, history: [] };

function initializeDay() {
  const today = new Date().toDateString();
  const data = loadData('income.json', {});
  
  if (data.lastDate !== today) {
    income = {
      today: 0,
      dailyTarget: 150,
      lastDate: today,
      history: data.history || []
    };
    saveData('income.json', income);
    
    agentState.leadgen.leadsFound = 0;
    agentState.outreach.messagesSent = 0;
    agentState.content.piecesCreated = 0;
    activityLog = [];
    
    addActivity('system', 'New day initialized. Daily target: $150');
  }
}

function addActivity(agent, message) {
  const entry = {
    timestamp: new Date().toISOString(),
    agent,
    message
  };
  activityLog.unshift(entry);
  if (activityLog.length > 50) activityLog.pop();
  saveData('activity.json', activityLog);
}

function generateLeads(count) {
  const companies = ['TechFlow', 'GrowthLabs', 'AutoMate', 'DataFlow', 'CloudScale', 'SmartOps', 'ScaleUp', 'InnovateCo'];
  const roles = ['CEO', 'Founder', 'CTO', 'VP Sales', 'Director'];
  const needs = ['Need help scaling sales', 'Looking for automation', 'Want to 3x revenue'];
  const leads = [];
  for (let i = 0; i < count; i++) {
    leads.push({
      id: crypto.randomUUID(),
      name: `Contact ${i + 1}`,
      company: companies[Math.floor(Math.random() * companies.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
      need: needs[Math.floor(Math.random() * needs.length)],
      budget: ['$1-2k/mo', '$2-5k/mo', '$5k+/mo'][Math.floor(Math.random() * 3)],
      score: Math.floor(Math.random() * 40) + 60,
      source: ['linkedin', 'twitter', 'website'][Math.floor(Math.random() * 3)],
      createdAt: new Date().toISOString()
    });
  }
  return leads;
}

function generateOutreach(count) {
  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      id: crypto.randomUUID(),
      channel: ['email', 'linkedin', 'twitter'][Math.floor(Math.random() * 3)],
      status: ['sent', 'delivered', 'opened', 'replied'][Math.floor(Math.random() * 4)],
      sentAt: new Date().toISOString()
    });
  }
  return messages;
}

async function simulateAgents() {
  agentState.orchestrator.status = 'active';
  agentState.orchestrator.lastUpdate = new Date().toISOString();
  addActivity('orchestrator', 'Day started. Activating all agents...');

  agentState.leadgen.status = 'active';
  const leadCount = Math.floor(Math.random() * 20) + 30;
  agentState.leadgen.leadsFound = leadCount;
  saveData('leads.json', generateLeads(leadCount));
  addActivity('leadgen', `Found ${leadCount} qualified leads`);

  await new Promise(r => setTimeout(r, 1000));

  agentState.outreach.status = 'active';
  const messageCount = Math.floor(Math.random() * 10) + 20;
  agentState.outreach.messagesSent = messageCount;
  saveData('outreach.json', generateOutreach(messageCount));
  addActivity('outreach', `Sent ${messageCount} personalized messages`);

  await new Promise(r => setTimeout(r, 1000));

  agentState.content.status = 'active';
  agentState.content.piecesCreated = Math.floor(Math.random() * 2) + 2;
  addActivity('content', `Created ${agentState.content.piecesCreated} content pieces`);

  await new Promise(r => setTimeout(r, 1000));

  const potentialRevenue = Math.floor(Math.random() * 50) + 100;
  income.today += potentialRevenue;
  saveData('income.json', income);
  addActivity('analytics', `Potential revenue tracked: $${potentialRevenue}`);
}

app.get('/api/status', (req, res) => {
  initializeDay();
  res.json({ agents: agentState, income, activityLog: activityLog.slice(0, 20) });
});

app.post('/api/start-day', async (req, res) => {
  initializeDay();
  await simulateAgents();
  res.json({ success: true, income });
});

app.get('/api/leads', (req, res) => {
  res.json(loadData('leads.json', []));
});

app.get('/api/outreach', (req, res) => {
  res.json(loadData('outreach.json', []));
});

app.get('/api/income', (req, res) => {
  initializeDay();
  res.json(income);
});

app.post('/api/income/add', (req, res) => {
  const { amount, source } = req.body;
  income.today += amount;
  income.history.unshift({ date: new Date().toISOString(), amount, source });
  if (income.history.length > 100) income.history.pop();
  saveData('income.json', income);
  addActivity('income', `$${amount} earned from ${source}`);
  res.json({ success: true, income });
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  initializeDay();
  console.log(`RevOps Agency AI running at http://localhost:${PORT}`);
});
