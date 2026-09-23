import net from 'net';

const regions = [
  'aws-0-ap-south-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-us-west-1.pooler.supabase.com',
];

regions.forEach((host) => {
  const socket = new net.Socket();
  socket.setTimeout(3000);
  socket.on('connect', () => {
    console.log(`[FOUND REGION!] Reachable Pooler Host: ${host}:6543`);
    socket.destroy();
  });
  socket.on('timeout', () => {
    socket.destroy();
  });
  socket.on('error', () => {
    socket.destroy();
  });
  socket.connect(6543, host);
});
