/**
 * app.js の単体テスト
 */

const request = require('supertest');

// モックを先に定義
jest.mock('../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  eLog: {
    error: jest.fn(),
  },
  aLog: {
    info: jest.fn(),
  },
}));

// ルーターのモック
jest.mock('../routes/r-login', () => {
  const express = require('express');
  const router = express.Router();
  router.post('/', (req, res) => {
    res.json({ status: 'OK', message: 'Login route' });
  });
  return router;
});

jest.mock('../routes/r-userinfo', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'User info route' });
  });
  return router;
});

jest.mock('../routes/r-whereabouts', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Whereabouts route' });
  });
  return router;
});

jest.mock('../routes/r-department', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Department route' });
  });
  return router;
});

jest.mock('../routes/r-geolocation', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Geolocation route' });
  });
  return router;
});

jest.mock('../routes/r-place', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Place route' });
  });
  return router;
});

jest.mock('../routes/r-presence-status', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Presence status route' });
  });
  return router;
});

jest.mock('../routes/r-telework', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Telework route' });
  });
  return router;
});

const app = require('../app');
const L = require('../util/logger-wrapper');

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本設定', () => {
    test('正常系: アプリケーションが正常に起動すること', () => {
      expect(app).toBeDefined();
    });

    test('正常系: Expressアプリケーションであること', () => {
      expect(typeof app).toBe('function');
      expect(app).toHaveProperty('listen');
      expect(app).toHaveProperty('use');
    });
  });

  describe('ミドルウェア設定', () => {
    test('正常系: JSONボディパーサーが動作すること', async () => {
      const response = await request(app)
        .post('/heresme_be/login')
        .send({ username: 'test', password: 'test' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBeLessThan(500);
    });

    test('正常系: CORSが有効であること', async () => {
      const response = await request(app)
        .get('/heresme_be/userinfo')
        .set('Origin', 'http://example.com');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('正常系: Cache-Controlヘッダーが設定されること', async () => {
      const response = await request(app)
        .get('/heresme_be/userinfo');

      expect(response.headers['cache-control']).toMatch(/no-cache/);
    });
  });

  describe('ルーティング', () => {
    test('正常系: /heresme_be/login ルートが動作すること', async () => {
      const response = await request(app)
        .post('/heresme_be/login')
        .send({});

      expect(response.status).toBeLessThan(500);
    });

    test('正常系: /heresme_be/userinfo ルートが動作すること', async () => {
      const response = await request(app)
        .get('/heresme_be/userinfo');

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('status');
    });

    test('正常系: /heresme_be/whereabouts ルートが動作すること', async () => {
      const response = await request(app)
        .get('/heresme_be/whereabouts');

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('status');
    });

    test('正常系: /heresme_be/departments ルートが動作すること', async () => {
      const response = await request(app)
        .get('/heresme_be/departments');

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('status');
    });

    test('正常系: /heresme_be/geolocations ルートが動作すること', async () => {
      const response = await request(app)
        .get('/heresme_be/geolocations');

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('status');
    });

    test('正常系: /heresme_be/placelist ルートが動作すること', async () => {
      const response = await request(app)
        .get('/heresme_be/placelist');

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('status');
    });

    test('正常系: /heresme_be/presencestatus ルートが動作すること', async () => {
      const response = await request(app)
        .get('/heresme_be/presencestatus');

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('status');
    });

    test('正常系: /heresme_be/telework ルートが動作すること', async () => {
      const response = await request(app)
        .get('/heresme_be/telework');

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('OPTIONSリクエスト', () => {
    test('正常系: OPTIONSリクエストに204で応答すること', async () => {
      const response = await request(app)
        .options('/heresme_be/login');

      expect(response.status).toBe(204);
    });
  });

  describe('エラーハンドリング', () => {
    test('異常系: 存在しないルートに対して404エラーを返すこと', async () => {
      const response = await request(app)
        .get('/nonexistent-route');

      expect(response.status).toBe(404);
    });

    test('異常系: 存在しないAPIエンドポイントに対して404エラーを返すこと', async () => {
      const response = await request(app)
        .get('/heresme_be/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('静的ファイル', () => {
    test('正常系: 静的ファイルのミドルウェアが設定されていること', async () => {
      // publicディレクトリからの静的ファイル配信をテスト
      const response = await request(app)
        .get('/favicon.ico');

      // 404または200（ファイルが存在する場合）
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('リクエストヘッダーのログ', () => {
    test('正常系: リクエストヘッダーがログに記録されること', async () => {
      await request(app)
        .get('/heresme_be/userinfo')
        .set('User-Agent', 'test-agent');

      expect(L.sLog.debug).toHaveBeenCalled();
    });
  });

  describe('Content-Type処理', () => {
    test('正常系: JSON Content-Typeを正しく処理すること', async () => {
      const response = await request(app)
        .post('/heresme_be/login')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBeLessThan(500);
    });

    test('正常系: URLエンコードされたContent-Typeを処理すること', async () => {
      const response = await request(app)
        .post('/heresme_be/login')
        .send('key=value')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('セキュリティヘッダー', () => {
    test('正常系: Cache-Controlヘッダーが適切に設定されること', async () => {
      const response = await request(app)
        .get('/heresme_be/userinfo');

      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['cache-control']).toContain('private');
      expect(response.headers['cache-control']).toContain('no-cache');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['cache-control']).toContain('must-revalidate');
    });
  });

  describe('アプリケーション設定', () => {
    test('正常系: ビューエンジンが設定されていること', () => {
      expect(app.get('view engine')).toBe('pug');
    });

    test('正常系: viewsディレクトリが設定されていること', () => {
      const viewsPath = app.get('views');
      expect(viewsPath).toBeDefined();
      expect(viewsPath).toContain('views');
    });
  });

  describe('モジュールエクスポート', () => {
    test('正常系: appがエクスポートされていること', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
    });

    test('正常系: appが複数回requireしても同じインスタンスであること', () => {
      const app1 = require('../app');
      const app2 = require('../app');

      expect(app1).toBe(app2);
    });
  });
});
