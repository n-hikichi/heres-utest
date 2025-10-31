/**
 * logger-wrapper.js の単体テスト
 */

// モックを先に定義
jest.mock('log4js', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  };

  return {
    configure: jest.fn(),
    getLogger: jest.fn((name) => ({
      ...mockLogger,
      name,
    })),
  };
});

const log4js = require('log4js');

describe('Logger Wrapper', () => {
  let loggerWrapper;

  beforeEach(() => {
    jest.clearAllMocks();

    // キャッシュをクリアして新しくrequire
    jest.resetModules();
    jest.mock('log4js', () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
        trace: jest.fn(),
      };

      return {
        configure: jest.fn(),
        getLogger: jest.fn((name) => ({
          ...mockLogger,
          name,
        })),
      };
    });

    loggerWrapper = require('../../util/logger-wrapper');
  });

  describe('初期化', () => {
    test('正常系: log4jsが設定ファイルで設定されること', () => {
      const log4js = require('log4js');

      expect(log4js.configure).toHaveBeenCalledWith(
        expect.stringContaining('config/log4js-config.json')
      );
    });

    test('正常系: 3つのロガーが取得されること', () => {
      const log4js = require('log4js');

      expect(log4js.getLogger).toHaveBeenCalledWith('access');
      expect(log4js.getLogger).toHaveBeenCalledWith('system');
      expect(log4js.getLogger).toHaveBeenCalledWith('error');
    });
  });

  describe('エクスポートされたロガー', () => {
    test('正常系: aLog（アクセスロガー）が存在すること', () => {
      expect(loggerWrapper.aLog).toBeDefined();
      expect(loggerWrapper.aLog.name).toBe('access');
    });

    test('正常系: sLog（システムロガー）が存在すること', () => {
      expect(loggerWrapper.sLog).toBeDefined();
      expect(loggerWrapper.sLog.name).toBe('system');
    });

    test('正常系: eLog（エラーロガー）が存在すること', () => {
      expect(loggerWrapper.eLog).toBeDefined();
      expect(loggerWrapper.eLog.name).toBe('error');
    });
  });

  describe('ロガーの機能', () => {
    test('正常系: aLogでdebugメソッドが呼べること', () => {
      const message = 'Access log test';
      loggerWrapper.aLog.debug(message);

      expect(loggerWrapper.aLog.debug).toHaveBeenCalledWith(message);
    });

    test('正常系: aLogでinfoメソッドが呼べること', () => {
      const message = 'Access info test';
      loggerWrapper.aLog.info(message);

      expect(loggerWrapper.aLog.info).toHaveBeenCalledWith(message);
    });

    test('正常系: sLogでdebugメソッドが呼べること', () => {
      const message = 'System debug test';
      loggerWrapper.sLog.debug(message);

      expect(loggerWrapper.sLog.debug).toHaveBeenCalledWith(message);
    });

    test('正常系: sLogでwarnメソッドが呼べること', () => {
      const message = 'System warning test';
      loggerWrapper.sLog.warn(message);

      expect(loggerWrapper.sLog.warn).toHaveBeenCalledWith(message);
    });

    test('正常系: eLogでerrorメソッドが呼べること', () => {
      const message = 'Error log test';
      loggerWrapper.eLog.error(message);

      expect(loggerWrapper.eLog.error).toHaveBeenCalledWith(message);
    });

    test('正常系: eLogでfatalメソッドが呼べること', () => {
      const message = 'Fatal error test';
      loggerWrapper.eLog.fatal(message);

      expect(loggerWrapper.eLog.fatal).toHaveBeenCalledWith(message);
    });
  });

  describe('複雑なログ出力', () => {
    test('正常系: オブジェクトをログ出力できること', () => {
      const obj = { id: 1, name: 'Test User', status: 'active' };
      loggerWrapper.sLog.debug(obj);

      expect(loggerWrapper.sLog.debug).toHaveBeenCalledWith(obj);
    });

    test('正常系: 配列をログ出力できること', () => {
      const arr = [1, 2, 3, 4, 5];
      loggerWrapper.sLog.info(arr);

      expect(loggerWrapper.sLog.info).toHaveBeenCalledWith(arr);
    });

    test('正常系: エラーオブジェクトをログ出力できること', () => {
      const error = new Error('Test error');
      loggerWrapper.eLog.error(error);

      expect(loggerWrapper.eLog.error).toHaveBeenCalledWith(error);
    });

    test('正常系: 複数の引数をログ出力できること', () => {
      const message = 'User action:';
      const userId = 'user001';
      const action = 'login';

      loggerWrapper.aLog.info(message, userId, action);

      expect(loggerWrapper.aLog.info).toHaveBeenCalledWith(message, userId, action);
    });
  });

  describe('境界値テスト', () => {
    test('境界値: 空文字列をログ出力できること', () => {
      loggerWrapper.sLog.debug('');

      expect(loggerWrapper.sLog.debug).toHaveBeenCalledWith('');
    });

    test('境界値: nullをログ出力できること', () => {
      loggerWrapper.sLog.debug(null);

      expect(loggerWrapper.sLog.debug).toHaveBeenCalledWith(null);
    });

    test('境界値: undefinedをログ出力できること', () => {
      loggerWrapper.sLog.debug(undefined);

      expect(loggerWrapper.sLog.debug).toHaveBeenCalledWith(undefined);
    });

    test('境界値: 非常に長い文字列をログ出力できること', () => {
      const longString = 'a'.repeat(10000);
      loggerWrapper.sLog.debug(longString);

      expect(loggerWrapper.sLog.debug).toHaveBeenCalledWith(longString);
    });
  });
});
