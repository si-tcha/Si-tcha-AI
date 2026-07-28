const request = require('supertest');
const app = require('./src/app').default;
const bcrypt = require('bcrypt');

async function test() {
  const res = await request(app).post('/api/auth/register/buyer').send({
    companyName: 'Test Corp',
    phone: '699112233',
    pin: '1234',
  });
  console.log('REAL RES:', res.status, res.body);
  process.exit(0);
}
test();
