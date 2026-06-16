const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  try {
    let url = req.url.split('?')[0];
    url = decodeURIComponent(url);
    let f = path.join('.', url);
    if (f === '.' || f === '.\\') f = './慢境-酒店UI设计.html';

    const c = fs.readFileSync(f);
    const ext = path.extname(f).slice(1);
    const types = { 'html': 'text/html;charset=utf-8', 'css': 'text/css', 'js': 'text/javascript', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(c);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3457, '0.0.0.0', () => console.log('OK'));
