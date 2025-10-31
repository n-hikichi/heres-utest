/**
 * api-auth.js の単体テスト
 */

const jwt = require('jsonwebtoken');
const apiAuth = require('../../models/api-auth');
const authConfig = require('../../config/auth-config');

// ロガーのモック
jest.mock('../../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
  eLog: {
    error: jest.fn(),
  },
  aLog: {
    info: jest.fn(),
  },
}));

describe('ApiAuth', () => {
  describe('generateToken', () => {
    test('正常系: 有効なaccountIdでトークンが生成されること', () => {
      const accountId = 'test_user';
      const token = apiAuth.generateToken(accountId);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // トークンをデコードして内容を検証
      const decoded = jwt.decode(token);
      expect(decoded.id).toBe(accountId);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    test('異常系: accountIdがundefinedの場合、nullを返すこと', () => {
      const token = apiAuth.generateToken(undefined);
      expect(token).toBeNull();
    });

    test('境界値: 空文字列のaccountIdでトークンが生成されること', () => {
      const accountId = '';
      const token = apiAuth.generateToken(accountId);

      expect(token).toBeTruthy();
      const decoded = jwt.decode(token);
      expect(decoded.id).toBe('');
    });

    test('エッジケース: 特殊文字を含むaccountIdでトークンが生成されること', () => {
      const accountId = 'user@example.com';
      const token = apiAuth.generateToken(accountId);

      expect(token).toBeTruthy();
      const decoded = jwt.decode(token);
      expect(decoded.id).toBe(accountId);
    });
  });

  describe('verifyTokenOnLogin', () => {
    test('正常系: 有効なトークンで認証が成功すること', () => {
      const accountId = 'test_user';
      const token = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: 60 * 60 });

      const result = apiAuth.verifyTokenOnLogin(accountId, token);
      expect(result).toBe(true);
    });

    test('異常系: accountIdが一致しない場合、認証が失敗すること', () => {
      const accountId = 'test_user';
      const wrongAccountId = 'wrong_user';
      const token = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: 60 * 60 });

      const result = apiAuth.verifyTokenOnLogin(wrongAccountId, token);
      expect(result).toBe(false);
    });

    test('異常系: 無効なトークンで認証が失敗すること', () => {
      const accountId = 'test_user';
      const invalidToken = 'invalid_token_string';

      const result = apiAuth.verifyTokenOnLogin(accountId, invalidToken);
      expect(result).toBe(false);
    });

    test('異常系: 期限切れのトークンで認証が失敗すること', () => {
      const accountId = 'test_user';
      const expiredToken = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: -1 });

      const result = apiAuth.verifyTokenOnLogin(accountId, expiredToken);
      expect(result).toBe(false);
    });

    test('異常系: 異なるsecretkeyで生成されたトークンで認証が失敗すること', () => {
      const accountId = 'test_user';
      const wrongSecretKey = 'wrong_secret_key';
      const token = jwt.sign({ id: accountId }, wrongSecretKey, { expiresIn: 60 * 60 });

      const result = apiAuth.verifyTokenOnLogin(accountId, token);
      expect(result).toBe(false);
    });

    test('境界値: nullトークンで認証が失敗すること', () => {
      const accountId = 'test_user';
      const result = apiAuth.verifyTokenOnLogin(accountId, null);
      expect(result).toBe(false);
    });
  });

  describe('verifyToken (middleware)', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
      };
      res = {
        sendStatus: jest.fn(),
      };
      next = jest.fn();
    });

    test('正常系: 有効なトークンで次のミドルウェアに進むこと', async () => {
      const accountId = 'test_user';
      const token = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: 60 * 60 });
      req.headers.authorization = `Bearer ${token}`;

      await apiAuth.verifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.sendStatus).not.toHaveBeenCalled();
    });

    test('異常系: authorizationヘッダーがない場合、400を返すこと', async () => {
      await apiAuth.verifyToken(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('異常系: トークンが空の場合、401を返すこと', async () => {
      req.headers.authorization = 'Bearer ';

      await apiAuth.verifyToken(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('異常系: Bearerスキームがない場合、400を返すこと', async () => {
      const accountId = 'test_user';
      const token = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: 60 * 60 });
      req.headers.authorization = token;

      await apiAuth.verifyToken(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('異常系: 無効なトークンで401を返すこと', async () => {
      req.headers.authorization = 'Bearer invalid_token';

      await apiAuth.verifyToken(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('異常系: 期限切れのトークンで401を返すこと', async () => {
      const accountId = 'test_user';
      const expiredToken = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: -1 });
      req.headers.authorization = `Bearer ${expiredToken}`;

      await apiAuth.verifyToken(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('verifyTokenForReissue', () => {
    test('正常系: accountIdが一致する場合、trueを返すこと', () => {
      const accountId = 'test_user';
      const token = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: 60 * 60 });

      const result = apiAuth.verifyTokenForReissue(accountId, token);
      expect(result).toBe(true);
    });

    test('異常系: accountIdが一致しない場合、falseを返すこと', () => {
      const accountId = 'test_user';
      const wrongAccountId = 'wrong_user';
      const token = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: 60 * 60 });

      const result = apiAuth.verifyTokenForReissue(wrongAccountId, token);
      expect(result).toBe(false);
    });

    test('エッジケース: 期限切れのトークンでもdecodeできればtrueを返すこと', () => {
      // verifyTokenForReissueはjwt.decode()を使用しているため、期限切れでもデコード可能
      const accountId = 'test_user';
      const expiredToken = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: -1 });

      const result = apiAuth.verifyTokenForReissue(accountId, expiredToken);
      expect(result).toBe(true);
    });

    test('境界値: nullトークンの場合、エラーが発生すること', () => {
      const accountId = 'test_user';

      // jwt.decode(null)はnullを返すため、エラーが発生する
      expect(() => {
        apiAuth.verifyTokenForReissue(accountId, null);
      }).toThrow();
    });
  });

  describe('_verifyToken (private method)', () => {
    test('正常系: 有効なトークンでtrueを返すこと', () => {
      const accountId = 'test_user';
      const token = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: 60 * 60 });

      const result = apiAuth._verifyToken(token);
      expect(result).toBe(true);
    });

    test('異常系: nullトークンでfalseを返すこと', () => {
      const result = apiAuth._verifyToken(null);
      expect(result).toBe(false);
    });

    test('異常系: 無効なトークンでfalseを返すこと', () => {
      const result = apiAuth._verifyToken('invalid_token');
      expect(result).toBe(false);
    });

    test('異常系: 期限切れのトークンでfalseを返すこと', () => {
      const accountId = 'test_user';
      const expiredToken = jwt.sign({ id: accountId }, authConfig.secretkey, { expiresIn: -1 });

      const result = apiAuth._verifyToken(expiredToken);
      expect(result).toBe(false);
    });
  });
});
