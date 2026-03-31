const express = require('express');
const app = express();
app.get('/{*splat}', (req, res, next) => { console.log("HIT SPLAT!"); next(); });
app.get('/api/health', (req, res) => res.send('health'));

// Let's see what matches /api/health
const request = require('http').request;
const server = app.listen(8081, () => {
  const req = request('http://localhost:8081/api/health', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => { console.log('Response:', data); server.close(); });
  });
  req.end();
});
