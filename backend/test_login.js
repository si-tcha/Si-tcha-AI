const fetch = require('node-fetch');
async function test() {
  const res = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+237 690 00 00 00', pin: '1234', role: 'buyer' })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log(data);
}
test();
