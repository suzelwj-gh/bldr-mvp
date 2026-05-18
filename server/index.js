const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'BLDR is running', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`BLDR server running on port ${PORT}`);
});

module.exports = app;