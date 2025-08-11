import http from 'node:http';
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Portal dev server is up ✅\n');
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
