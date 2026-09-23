import dns from 'dns';
import net from 'net';

const hostname = 'db.oerufjhuhbphmxjklanq.supabase.co';
const poolerHost = 'aws-0-ap-south-1.pooler.supabase.com';

console.log('Resolving DNS for hostnames...');

dns.lookup(hostname, { all: true }, (err, addresses) => {
  console.log('Direct Host IPs:', err ? err.message : addresses);
});

dns.lookup(poolerHost, { all: true }, (err, addresses) => {
  console.log('Pooler Host IPs:', err ? err.message : addresses);
});

const socket = new net.Socket();
socket.setTimeout(5000);
socket.on('connect', () => {
  console.log('Successfully connected to direct host on port 5432!');
  socket.destroy();
});
socket.on('timeout', () => {
  console.log('Connection timed out on port 5432');
  socket.destroy();
});
socket.on('error', (err) => {
  console.log('Connection error on port 5432:', err.message);
});
socket.connect(5432, hostname);
