const request = require('supertest');
const { db, migrateAndSeed, teardown, extractCsrf } = require('./setup');
const app = require('../src/app');

beforeAll(async () => {
  await migrateAndSeed();
}, 30000);

afterAll(async () => {
  await teardown();
});

/** Log in with an agent and return it (cookies persisted). */
async function loginAs(username, password) {
  const agent = request.agent(app);
  const loginPage = await agent.get('/login');
  const token = extractCsrf(loginPage.text);
  await agent
    .post('/login')
    .type('form')
    .send({ _csrf: token, username, password })
    .expect(302);
  return agent;
}

describe('Authentication & RBAC', () => {
  test('unauthenticated dashboard redirects to /login', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('wrong password does not authenticate', async () => {
    const agent = request.agent(app);
    const page = await agent.get('/login');
    const token = extractCsrf(page.text);
    const res = await agent.post('/login').type('form').send({ _csrf: token, username: 'admin', password: 'wrong' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('admin can log in and reach the dashboard', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const res = await agent.get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ড্যাশবোর্ড');
  });

  test('viewer cannot access user management', async () => {
    await db('users').insert({
      name: 'Viewer', username: 'viewer1', role: 'viewer', is_active: true,
      password_hash: require('bcryptjs').hashSync('Viewer@123', 10),
    });
    const agent = await loginAs('viewer1', 'Viewer@123');
    const res = await agent.get('/users');
    expect(res.status).toBe(403);
  });
});

describe('Member creation', () => {
  test('admin can create a member and see it listed', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const form = await agent.get('/members/new');
    const token = extractCsrf(form.text);
    const create = await agent
      .post('/members')
      .type('form')
      .send({ _csrf: token, name: 'পরীক্ষা সদস্য', phone: '01799999999', gender: 'male', status: 'active', monthly_payment: 'false' });
    expect(create.status).toBe(302);

    const list = await agent.get('/members');
    expect(list.text).toContain('পরীক্ষা সদস্য');

    const row = await db('members').where({ name: 'পরীক্ষা সদস্য' }).first();
    expect(row).toBeTruthy();
    expect(row.id_no).toBe('0001'); // auto-generated
  });
});

describe('Collection creation updates totals', () => {
  test('a collection increases the collection total', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const member = await db('members').first();
    const form = await agent.get('/collections/new');
    const token = extractCsrf(form.text);
    const before = Number((await db('collections').sum('amount as s'))[0].s || 0);
    const res = await agent
      .post('/collections')
      .type('form')
      .send({ _csrf: token, member_id: member.id, amount: '1234.50', date: '2026-05-10', purpose: 'টেস্ট' });
    expect(res.status).toBe(302);
    const after = Number((await db('collections').sum('amount as s'))[0].s || 0);
    expect(after - before).toBeCloseTo(1234.5, 2);
  });
});
