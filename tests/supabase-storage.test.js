jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ storage: { from: jest.fn() } })),
}));

describe('supabase storage URL normalization', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.STORAGE_PROVIDER = 'supabase';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_0123456789abcdefghijklmnopqrstuvwxyz';
  });

  afterEach(() => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    jest.clearAllMocks();
  });

  test('getClient accepts SUPABASE_URL without protocol', () => {
    process.env.SUPABASE_URL = 'mosque-project.supabase.co';
    const { createClient } = require('@supabase/supabase-js');
    const storage = require('../src/services/supabase-storage');

    storage.getClient();

    expect(createClient).toHaveBeenCalledWith(
      'https://mosque-project.supabase.co/',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false } }),
    );
  });

  test('objectKeyFromPublicUrl supports SUPABASE_URL with surrounding quotes', () => {
    process.env.SUPABASE_URL = '"https://mosque-project.supabase.co"';
    const storage = require('../src/services/supabase-storage');
    const key = storage.objectKeyFromPublicUrl(
      'https://mosque-project.supabase.co/storage/v1/object/public/public-media/path/to/file.jpg',
    );

    expect(key).toBe('path/to/file.jpg');
  });
});
