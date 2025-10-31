/**
 * db-util.js の単体テスト
 */

const { Pool } = require('pg');

// モックを先に定義
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    end: jest.fn(),
  };
  return {
    Pool: jest.fn(() => mockPool),
    Client: jest.fn(),
  };
});

jest.mock('aws-sdk', () => {
  return {
    SSM: jest.fn(() => ({
      getParameter: jest.fn(),
    })),
  };
});

jest.mock('../../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
  eLog: {
    error: jest.fn(),
  },
}));

jest.mock('../../util/hm-util', () => ({
  isNullorUndefined: jest.fn((value) => value === undefined || value === null),
}));

// モックをrequireより先に設定したので、requireする
const AWS = require('aws-sdk');
const hmUtil = require('../../util/hm-util');

describe('DbUtil', () => {
  let dbUtil;
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();

    // モックプールの参照を取得
    mockPool = new Pool();

    // db-utilを新しくrequire（キャッシュをクリア）
    jest.resetModules();
    jest.mock('pg', () => {
      const mockPoolInstance = {
        query: jest.fn(),
        end: jest.fn(),
      };
      return {
        Pool: jest.fn(() => mockPoolInstance),
        Client: jest.fn(),
      };
    });

    jest.mock('../../util/logger-wrapper', () => ({
      sLog: {
        debug: jest.fn(),
        warn: jest.fn(),
      },
      eLog: {
        error: jest.fn(),
      },
    }));

    jest.mock('../../util/hm-util', () => ({
      isNullorUndefined: jest.fn((value) => value === undefined || value === null),
    }));

    dbUtil = require('../../models/db-util');
  });

  describe('getEnvironmentType', () => {
    test('正常系: 環境タイプを取得できること', () => {
      const result = dbUtil.getEnvironmentType();
      expect(result).toBe(0); // localhost環境
    });
  });

  describe('executeQuery', () => {
    test('正常系: SQLクエリが正常に実行されること', async () => {
      const query = 'SELECT * FROM users';
      const mockResult = {
        rows: [{ id: 1, name: 'Test User' }],
        rowCount: 1,
      };

      const { Pool } = require('pg');
      const mockPoolInstance = new Pool();
      mockPoolInstance.query.mockResolvedValue(mockResult);
      mockPoolInstance.end.mockResolvedValue();

      const result = await dbUtil.executeQuery(query);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockResult);
    });

    test('異常系: SQLクエリエラーの場合、エラーオブジェクトを返すこと', async () => {
      const query = 'INVALID SQL';
      const { Pool } = require('pg');
      const mockPoolInstance = new Pool();

      mockPoolInstance.query.mockRejectedValue(new Error('SQL syntax error'));
      mockPoolInstance.end.mockResolvedValue();

      const result = await dbUtil.executeQuery(query);

      expect(result.error).toBe(true);
      expect(result.body.rows).toEqual([]);
    });
  });

  describe('executeQueryInjection', () => {
    test('正常系: パラメータ付きクエリが正常に実行されること', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = ['user001'];
      const mockResult = {
        rows: [{ id: 'user001', name: 'Test User' }],
        rowCount: 1,
      };

      const { Pool } = require('pg');
      const mockPoolInstance = new Pool();
      mockPoolInstance.query.mockResolvedValue(mockResult);
      mockPoolInstance.end.mockResolvedValue();

      const result = await dbUtil.executeQueryInjection(query, params);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockResult);
    });

    test('異常系: SQLクエリエラーの場合、エラーオブジェクトを返すこと', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = ['invalid'];
      const { Pool } = require('pg');
      const mockPoolInstance = new Pool();

      mockPoolInstance.query.mockRejectedValue(new Error('Query error'));
      mockPoolInstance.end.mockResolvedValue();

      const result = await dbUtil.executeQueryInjection(query, params);

      expect(result.error).toBe(true);
      expect(result.body.rows).toEqual([]);
    });
  });

  describe('executeQueryRead', () => {
    test('正常系: 読み取りクエリが正常に実行されること', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = ['user001'];
      const funcName = 'testFunction';
      const mockResult = {
        error: false,
        body: {
          rows: [{ id: 'user001', name: 'Test User' }],
          rowCount: 1,
        },
      };

      // executeQueryInjectionをモック
      jest.spyOn(dbUtil, 'executeQueryInjection').mockResolvedValue(mockResult);

      const result = await dbUtil.executeQueryRead(query, params, funcName);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(result.body).toEqual(mockResult.body.rows);
    });

    test('正常系: 結果が空の場合、空配列を返すこと', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = ['nonexistent'];
      const funcName = 'testFunction';
      const mockResult = {
        error: false,
        body: {
          rows: [],
          rowCount: 0,
        },
      };

      jest.spyOn(dbUtil, 'executeQueryInjection').mockResolvedValue(mockResult);

      const result = await dbUtil.executeQueryRead(query, params, funcName);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(result.body).toEqual([]);
    });

    test('異常系: SQLクエリエラーの場合、エラーステータスを返すこと', async () => {
      const query = 'INVALID SQL';
      const params = [];
      const funcName = 'testFunction';

      jest.spyOn(dbUtil, 'executeQueryInjection').mockRejectedValue(new Error('SQL error'));

      const result = await dbUtil.executeQueryRead(query, params, funcName);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('executeQueryWrite', () => {
    test('正常系: 書き込みクエリが正常に実行されること', async () => {
      const query = 'UPDATE users SET name = $1 WHERE id = $2';
      const params = ['Updated Name', 'user001'];
      const funcName = 'testFunction';
      const mockResult = {
        error: false,
        body: {
          rows: [],
          rowCount: 1,
        },
      };

      jest.spyOn(dbUtil, 'executeQueryInjection').mockResolvedValue(mockResult);

      const result = await dbUtil.executeQueryWrite(query, params, funcName);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(result.body).toBe(1);
    });

    test('異常系: SQLクエリエラーの場合、エラーステータスを返すこと', async () => {
      const query = 'INVALID SQL';
      const params = [];
      const funcName = 'testFunction';

      jest.spyOn(dbUtil, 'executeQueryInjection').mockRejectedValue(new Error('SQL error'));

      const result = await dbUtil.executeQueryWrite(query, params, funcName);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('beginPool', () => {
    test('正常系: プールが作成されること', () => {
      const pool = dbUtil.beginPool();

      expect(pool).toBeDefined();
      expect(Pool).toHaveBeenCalled();
    });
  });

  describe('endPool', () => {
    test('正常系: プールが終了されること', async () => {
      const { Pool } = require('pg');
      const mockPoolInstance = new Pool();
      mockPoolInstance.end.mockResolvedValue();

      await dbUtil.endPool(mockPoolInstance);

      expect(mockPoolInstance.end).toHaveBeenCalled();
    });
  });

  describe('escapeSingleQuote', () => {
    test('正常系: シングルクォートがエスケープされること', () => {
      const input = "O'Brien";
      const result = dbUtil.escapeSingleQuote(input);

      expect(result).toBe("O''Brien");
    });

    test('正常系: 複数のシングルクォートがエスケープされること', () => {
      const input = "It's a test's case";
      const result = dbUtil.escapeSingleQuote(input);

      expect(result).toBe("It''s a test''s case");
    });

    test('境界値: 空文字列の場合、空文字列を返すこと', () => {
      hmUtil.isNullorUndefined.mockReturnValue(false);
      const input = '';
      const result = dbUtil.escapeSingleQuote(input);

      expect(result).toBe('');
    });

    test('境界値: nullの場合、nullを返すこと', () => {
      hmUtil.isNullorUndefined.mockReturnValue(true);
      const input = null;
      const result = dbUtil.escapeSingleQuote(input);

      expect(result).toBe(null);
    });

    test('境界値: undefinedの場合、undefinedを返すこと', () => {
      hmUtil.isNullorUndefined.mockReturnValue(true);
      const input = undefined;
      const result = dbUtil.escapeSingleQuote(input);

      expect(result).toBe(undefined);
    });

    test('正常系: シングルクォートが含まれない文字列はそのまま返すこと', () => {
      const input = 'normal text';
      const result = dbUtil.escapeSingleQuote(input);

      expect(result).toBe('normal text');
    });
  });
});
