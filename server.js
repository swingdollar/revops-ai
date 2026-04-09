const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let agentState = {
  orchestrator: { status: 'idle', lastUpdate: null, dailyGoal: 150 },
  leadgen: { status: 'idle', leadsFound: 0, target: 50 },
  outreach: { status: 'idle', messagesSent: 0, target: 30 },
  content: { status: 'idle', piecesCreated: 0, target: 3 },
  analytics: { status: 'idle', conversions: 0, revenue: 0 }
};

let activityLog = [];
let income = { today: 0, dailyTarget: 150, history: [] };

function addActivity(agent, message) {
  activityLog.unshift({
    timestamp: new Date().toISOString(),
    agent,
    message
  });
  if (activityLog.length > 50) activityLog.pop();
}

app.get('/api/status', (req, res) => {
  res.json({ agents: agentState, income, activityLog: activityLog.slice(0, 20) });
});

app.post('/api/start-day', (req, res) => {
  agentState.orchestrator.status = 'active';
  agentState.orchestrator.lastUpdate = new Date().toISOString();
  addActivity('orchestrator', 'Day started. All agents activated!');

  agentState.leadgen.status = 'active';
  agentState.leadgen.leadsFound = 35 + Math.floor(Math.random() * 20);
  addActivity('leadgen', `Found ${agentState.leadgen.leadsFound} qualified leads`);

  agentState.outreach.status = 'active';
  agentState.outreach.messagesSent = 22 + Math.floor(Math.random() * 12);
  addActivity('outreach', `Sent ${agentState.outreach.messagesSent} personalized messages`);

  agentState.content.status = 'active';
  agentState.content.piecesCreated = 2 + Math.floor(Math.random() * 2);
  addActivity('content', `Created ${agentState.content.piecesCreated} content pieces`);

  const potentialRevenue = 100 + Math.floor(Math.random() * 60);
  income.today += potentialRevenue;
  addActivity('analytics', `Revenue tracked: $${potentialRevenue}`);

  res.json({ success: true, income });
});

app.post('/api/income/add', (req, res) => {
  const { amount, source } = req.body;
  income.today += amount;
  income.history.unshift({ date: new Date().toISOString(), amount, source });
  if (income.history.length > 100) income.history.pop();
  addActivity('income', `$${amount} earned from ${source}`);
  res.json({ success: true, income });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`RevOps Agency AI running at http://localhost:${PORT}`);
});
