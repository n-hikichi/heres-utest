/**
 * login-auth.js の単体テスト
 */

// util.promisifyをモックして、Promise化された関数を返す
const mockExecPromise = jest.fn();

// utilモジュールをモック（login-auth.jsがロードされる前に実行される）
jest.mock('util', () => {
  const actualUtil = jest.requireActual('util');
  return {
    ...actualUtil,
    promisify: jest.fn((fn) => {
      // child_process.execの場合のみmockExecPromiseを返す
      // jest.fn()はString()すると'mockConstructor'を含む文字列になる
      if (fn && String(fn).includes('mockConstructor')) {
        return mockExecPromise;
      }
      // その他はオリジナルのpromisifyを使用
      return actualUtil.promisify(fn);
    }),
  };
});

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    // デフォルトの動作（util.promisifyでラップされるため直接は使用されない）
    callback(null, { stdout: '', stderr: '' });
  }),
}));

const util = require('util');
const child_process = require('child_process');

// モックを先に定義
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

jest.mock('../../models/db-util', () => ({
  executeQueryInjection: jest.fn(),
  executeQueryWrite: jest.fn(),
  getEnvironmentType: jest.fn(() => 0),
}));

jest.mock('../../util/hm-util', () => ({
  isNullorUndefined: jest.fn((value) => value === undefined || value === null),
  getIpAddressFromReqHeader: jest.fn(() => '192.168.1.1'),
  checkIpAddressIncludedList: jest.fn(() => true),
}));

jest.mock('../../models/api-auth', () => ({
  generateToken: jest.fn((accountId) => `mock_token_${accountId}`),
  verifyTokenOnLogin: jest.fn(() => true),
  verifyTokenForReissue: jest.fn(() => true),
}));

const loginAuth = require('../../models/login-auth');
const dbUtil = require('../../models/db-util');
const hmUtil = require('../../util/hm-util');
const apiAuth = require('../../models/api-auth');

describe('LoginAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    test('正常系: 正しいID/パスワードで認証が成功すること', async () => {
      const accountId = 'test@example.com';
      const passwd = 'correct_password';

      // DBからのユーザ情報
      const userInfo = {
        user_id: 'user001',
        staff_id: 'staff001',
        name: 'Test User',
        company_id: 'company001',
        section: 'section001',
        group_id: 'group001',
        class: 'class001',
        admin_flg: 1,
        telework_flg: 1,
        skey: 'test_skey',
        avatar: 'avatar.png',
        input_lead_flg: 0,
        linked_wh_flg: 1,
        attendance_flg: 1,
        passwd: 'encrypted_password',
      };

      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [userInfo],
        },
      });

      // child_process.execのモック（パスワード復号化）
      mockExecPromise.mockResolvedValue({ stdout: 'correct_password\n', stderr: '' });

      const result = await loginAuth.authenticate(accountId, passwd);

      expect(result).toBeTruthy();
      expect(result.token).toBe(`mock_token_${userInfo.user_id}`);
      expect(result.user_id).toBe(userInfo.user_id);
      expect(result.staff_id).toBe(userInfo.staff_id);
      expect(result.name).toBe(userInfo.name);
      expect(result.company_id).toBe(userInfo.company_id);
      expect(result.admin_flg).toBe(userInfo.admin_flg);
    });

    test('異常系: アカウントが存在しない場合、nullを返すこと', async () => {
      const accountId = 'nonexistent@example.com';
      const passwd = 'password';

      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [],
        },
      });

      const result = await loginAuth.authenticate(accountId, passwd);

      expect(result).toBeNull();
    });

    test('異常系: DBクエリエラーの場合、nullを返すこと', async () => {
      const accountId = 'test@example.com';
      const passwd = 'password';

      dbUtil.executeQueryInjection.mockRejectedValue(new Error('DB error'));

      const result = await loginAuth.authenticate(accountId, passwd);

      expect(result).toBeNull();
    });

    test('異常系: アカウントが停止状態の場合、user_id:endを返すこと', async () => {
      const accountId = 'test@example.com';
      const passwd = 'password';

      const userInfo = {
        user_id: 'user001',
        passwd: 'end_encrypted_password',
      };

      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [userInfo],
        },
      });

      const result = await loginAuth.authenticate(accountId, passwd);

      expect(result).toEqual({ user_id: 'end' });
    });

    test('異常系: パスワードが一致しない場合、nullを返すこと', async () => {
      const accountId = 'test@example.com';
      const passwd = 'wrong_password';

      const userInfo = {
        user_id: 'user001',
        passwd: 'encrypted_password',
      };

      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [userInfo],
        },
      });

      // child_process.execのモック（パスワード復号化）
      mockExecPromise.mockResolvedValue({ stdout: 'correct_password\n', stderr: '' });

      const result = await loginAuth.authenticate(accountId, passwd);

      expect(result).toBeNull();
    });
  });

  describe('authenticateByToken', () => {
    test('正常系: 有効なトークンで認証が成功すること', async () => {
      const accountId = 'user001';
      const token = 'valid_token';

      const userInfo = {
        user_id: 'user001',
        staff_id: 'staff001',
        name: 'Test User',
        company_id: 'company001',
        section: 'section001',
        group_id: 'group001',
        class: 'class001',
        admin_flg: 1,
        telework_flg: 1,
        skey: 'test_skey',
        avatar: 'avatar.png',
        input_lead_flg: 0,
        linked_wh_flg: 1,
        attendance_flg: 1,
        passwd: 'encrypted_password',
      };

      apiAuth.verifyTokenOnLogin.mockReturnValue(true);
      apiAuth.generateToken.mockImplementation((id) => `mock_token_${id}`);
      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [userInfo],
        },
      });

      const result = await loginAuth.authenticateByToken(accountId, token);

      expect(result).toBeTruthy();
      expect(result.token).toBe(`mock_token_${accountId}`);
      expect(result.user_id).toBe(userInfo.user_id);
      expect(result.staff_id).toBe(userInfo.staff_id);
    });

    test('異常系: トークン検証が失敗した場合、nullを返すこと', async () => {
      const accountId = 'user001';
      const token = 'invalid_token';

      apiAuth.verifyTokenOnLogin.mockReturnValue(false);

      const result = await loginAuth.authenticateByToken(accountId, token);

      expect(result).toBeNull();
    });

    test('異常系: ユーザ情報が取得できない場合、nullを返すこと', async () => {
      const accountId = 'user001';
      const token = 'valid_token';

      apiAuth.verifyTokenOnLogin.mockReturnValue(true);
      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [],
        },
      });

      const result = await loginAuth.authenticateByToken(accountId, token);

      expect(result).toBeNull();
    });

    test('異常系: DBクエリエラーの場合、nullを返すこと', async () => {
      const accountId = 'user001';
      const token = 'valid_token';

      apiAuth.verifyTokenOnLogin.mockReturnValue(true);
      dbUtil.executeQueryInjection.mockRejectedValue(new Error('DB error'));

      const result = await loginAuth.authenticateByToken(accountId, token);

      expect(result).toBeNull();
    });

    test('異常系: アカウントが停止状態の場合、user_id:endを返すこと', async () => {
      const accountId = 'user001';
      const token = 'valid_token';

      const userInfo = {
        user_id: 'user001',
        passwd: 'end_encrypted_password',
      };

      apiAuth.verifyTokenOnLogin.mockReturnValue(true);
      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [userInfo],
        },
      });

      const result = await loginAuth.authenticateByToken(accountId, token);

      expect(result).toEqual({ user_id: 'end' });
    });
  });

  describe('reissueLoginToken', () => {
    test('正常系: トークンの再発行が成功すること', async () => {
      const accountId = 'user001';
      const token = 'old_token';

      apiAuth.verifyTokenForReissue.mockReturnValue(true);
      apiAuth.generateToken.mockReturnValue('new_token');

      const result = await loginAuth.reissueLoginToken(accountId, token);

      expect(result).toBe('new_token');
    });

    test('異常系: トークン検証が失敗した場合、nullを返すこと', async () => {
      const accountId = 'user001';
      const token = 'invalid_token';

      apiAuth.verifyTokenForReissue.mockReturnValue(false);

      const result = await loginAuth.reissueLoginToken(accountId, token);

      expect(result).toBeNull();
    });
  });

  describe('deleteExpiredTeleworkData', () => {
    test('正常系: 期限切れテレワークデータの削除が成功すること', async () => {
      const company_id = 'company001';
      const staff_id = 'staff001';
      const from_date = '20250101';

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await loginAuth.deleteExpiredTeleworkData(company_id, staff_id, from_date);

      expect(result).toBeTruthy();
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [company_id, staff_id, from_date],
        'deleteExpiredTeleworkData'
      );
    });
  });

  describe('ipListGet', () => {
    test('正常系: IP管理情報の取得が成功すること', async () => {
      const company_id = 'company001';
      const ipData = {
        company_id: 'company001',
        enable_flg: 1,
        ip_list: ['192.168.1.0/24_Office', '10.0.0.0/8_VPN'],
      };

      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [ipData],
        },
      });

      const result = await loginAuth.ipListGet(company_id);

      expect(result).toEqual(ipData);
    });

    test('異常系: DBクエリエラーの場合、nullを返すこと', async () => {
      const company_id = 'company001';

      dbUtil.executeQueryInjection.mockRejectedValue(new Error('DB error'));

      const result = await loginAuth.ipListGet(company_id);

      expect(result).toBeNull();
    });

    test('異常系: データが存在しない場合、nullを返すこと', async () => {
      const company_id = 'company001';

      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [],
        },
      });

      const result = await loginAuth.ipListGet(company_id);

      expect(result).toBeNull();
    });
  });

  describe('checkIpAddressAuth', () => {
    let req;

    beforeEach(() => {
      req = {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      };
    });

    test('正常系: IP認証が成功した場合、0を返すこと', async () => {
      const company_id = 'company001';
      const ipData = {
        enable_flg: 1,
        ip_list: ['192.168.1.0/24_Office'],
      };

      hmUtil.getIpAddressFromReqHeader.mockReturnValue('192.168.1.1');
      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [ipData],
        },
      });
      hmUtil.checkIpAddressIncludedList.mockReturnValue(true);

      const result = await loginAuth.checkIpAddressAuth(company_id, req);

      expect(result).toBe(0);
    });

    test('異常系: IP認証が無効の場合、0を返すこと', async () => {
      const company_id = 'company001';
      const ipData = {
        enable_flg: 0,
        ip_list: ['192.168.1.0/24_Office'],
      };

      hmUtil.getIpAddressFromReqHeader.mockReturnValue('192.168.1.1');
      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [ipData],
        },
      });

      const result = await loginAuth.checkIpAddressAuth(company_id, req);

      expect(result).toBe(0);
    });

    test('異常系: IPアドレスがリストに含まれない場合、406を返すこと', async () => {
      const company_id = 'company001';
      const ipData = {
        enable_flg: 1,
        ip_list: ['192.168.1.0/24_Office'],
      };

      hmUtil.getIpAddressFromReqHeader.mockReturnValue('10.0.0.1');
      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [ipData],
        },
      });
      hmUtil.checkIpAddressIncludedList.mockReturnValue(false);

      const result = await loginAuth.checkIpAddressAuth(company_id, req);

      expect(result).toBe(406);
    });

    test('異常系: IPアドレスが取得できない場合、406を返すこと', async () => {
      const company_id = 'company001';

      hmUtil.getIpAddressFromReqHeader.mockReturnValue('');

      const result = await loginAuth.checkIpAddressAuth(company_id, req);

      expect(result).toBe(406);
    });

    test('異常系: IP管理情報が取得できない場合、406を返すこと', async () => {
      const company_id = 'company001';

      hmUtil.getIpAddressFromReqHeader.mockReturnValue('192.168.1.1');
      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [],
        },
      });

      const result = await loginAuth.checkIpAddressAuth(company_id, req);

      expect(result).toBe(406);
    });
  });
});
