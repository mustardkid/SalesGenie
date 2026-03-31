const express = require('express');
const app = express();
app.get('/api/health', (req, res) => res.send('health'));
app.get('/api/debug-fs', (req, res) => res.send('debug'));
app.get('/{*splat}', (req, res) => res.send('splat'));

const request = require('http').request;
const server = app.listen(8081, () => {
  const req = request('http://localhost:8081/api/debug-fs', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => { console.log('Response:', data); server.close(); });
  });
  req.end();
});
