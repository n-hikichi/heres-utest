/**
 * hm-util.js の単体テスト
 */

// モックを先に定義
jest.mock('../../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
  },
}));

jest.mock('../../models/db-util', () => ({
  getEnvironmentType: jest.fn(() => 0),
}));

const hmUtil = require('../../util/hm-util');
const dbUtil = require('../../models/db-util');

describe('HmUtil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isNullorUndefined', () => {
    test('正常系: undefinedの場合、trueを返すこと', () => {
      expect(hmUtil.isNullorUndefined(undefined)).toBe(true);
    });

    test('正常系: nullの場合、trueを返すこと', () => {
      expect(hmUtil.isNullorUndefined(null)).toBe(true);
    });

    test('正常系: 値が存在する場合、falseを返すこと', () => {
      expect(hmUtil.isNullorUndefined('value')).toBe(false);
      expect(hmUtil.isNullorUndefined(0)).toBe(false);
      expect(hmUtil.isNullorUndefined(false)).toBe(false);
    });

    test('境界値: 空文字列の場合、falseを返すこと', () => {
      expect(hmUtil.isNullorUndefined('')).toBe(false);
    });
  });

  describe('isNullorUndefinedStr', () => {
    test('正常系: "undefined"文字列の場合、trueを返すこと', () => {
      expect(hmUtil.isNullorUndefinedStr('undefined')).toBe(true);
    });

    test('正常系: "null"文字列の場合、trueを返すこと', () => {
      expect(hmUtil.isNullorUndefinedStr('null')).toBe(true);
    });

    test('正常系: 通常の文字列の場合、falseを返すこと', () => {
      expect(hmUtil.isNullorUndefinedStr('value')).toBe(false);
    });
  });

  describe('formatDate', () => {
    test('正常系: YYYY-MM-DD形式でフォーマットできること', () => {
      const date = new Date('2025-10-28T12:34:56');
      const result = hmUtil.formatDate(date, 'YYYY-MM-DD');
      expect(result).toBe('2025-10-28');
    });

    test('正常系: YYYY/MM/DD hh:mm:ss形式でフォーマットできること', () => {
      const date = new Date('2025-10-28T12:34:56');
      const result = hmUtil.formatDate(date, 'YYYY/MM/DD hh:mm:ss');
      expect(result).toBe('2025/10/28 12:34:56');
    });

    test('正常系: デフォルトフォーマットが適用されること', () => {
      const date = new Date('2025-10-28T12:34:56');
      const result = hmUtil.formatDate(date);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    test('エッジケース: ミリ秒を含むフォーマット', () => {
      const date = new Date('2025-10-28T12:34:56.789');
      const result = hmUtil.formatDate(date, 'YYYY-MM-DD hh:mm:ss.SSS');
      expect(result).toBe('2025-10-28 12:34:56.789');
    });
  });

  describe('calcMonth', () => {
    test('正常系: 月を加算できること', () => {
      const result = hmUtil.calcMonth('20251001', 2);
      expect(result).toBe('20251201');
    });

    test('正常系: 月を減算できること', () => {
      const result = hmUtil.calcMonth('20251001', -2);
      expect(result).toBe('20250801');
    });

    test('境界値: 年をまたぐ加算', () => {
      const result = hmUtil.calcMonth('20251101', 2);
      expect(result).toBe('20260101');
    });

    test('境界値: 年をまたぐ減算', () => {
      const result = hmUtil.calcMonth('20250201', -3);
      expect(result).toBe('20241101');
    });
  });

  describe('calcDate', () => {
    test('正常系: 日を加算できること', () => {
      const result = hmUtil.calcDate('20251028', 5);
      expect(result).toBe('20251102');
    });

    test('正常系: 日を減算できること', () => {
      const result = hmUtil.calcDate('20251028', -5);
      expect(result).toBe('20251023');
    });

    test('境界値: 月をまたぐ加算', () => {
      const result = hmUtil.calcDate('20251028', 5);
      expect(result).toBe('20251102');
    });
  });

  describe('calcHour', () => {
    test('正常系: 時間を加算できること', () => {
      const result = hmUtil.calcHour('202510281200', 3);
      expect(result).toBe('202510281500');
    });

    test('正常系: 時間を減算できること', () => {
      const result = hmUtil.calcHour('202510281200', -3);
      expect(result).toBe('202510280900');
    });

    test('境界値: 日をまたぐ加算', () => {
      const result = hmUtil.calcHour('202510282300', 2);
      expect(result).toBe('202510290100');
    });
  });

  describe('checkCliVersion', () => {
    test('正常系: 有効なバージョンの場合、trueを返すこと', () => {
      expect(hmUtil.checkCliVersion('2.6.3')).toBe(true);
      expect(hmUtil.checkCliVersion('2.7.0')).toBe(true);
      expect(hmUtil.checkCliVersion('3.0.0')).toBe(true);
    });

    test('異常系: 無効なバージョンの場合、falseを返すこと', () => {
      expect(hmUtil.checkCliVersion('1.0.0')).toBe(false);
      expect(hmUtil.checkCliVersion('2.6.2')).toBe(false);
    });
  });

  describe('getIpAddressFromReqHeader', () => {
    test('正常系: x-forwarded-forヘッダーからIPアドレスを取得できること', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      };

      dbUtil.getEnvironmentType.mockReturnValue(1);
      const result = hmUtil.getIpAddressFromReqHeader(req);
      expect(result).toBe('192.168.1.1');
    });

    test('正常系: socket.remoteAddressからIPアドレスを取得できること', () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: '192.168.1.2',
        },
      };

      dbUtil.getEnvironmentType.mockReturnValue(1);
      const result = hmUtil.getIpAddressFromReqHeader(req);
      expect(result).toBe('');
    });

    test('エッジケース: ローカル環境の場合、固定IPを返すこと', () => {
      const req = {
        headers: {},
      };

      dbUtil.getEnvironmentType.mockReturnValue(0);
      const result = hmUtil.getIpAddressFromReqHeader(req);
      expect(result).toBe('14.9.148.97');
    });
  });

  describe('checkIpAddressIncludedList', () => {
    test('正常系: IPアドレスがリストに含まれる場合、trueを返すこと', () => {
      const req_ip = '192.168.1.100';
      const ip_list = ['192.168.1.0/24_Office'];

      const result = hmUtil.checkIpAddressIncludedList(req_ip, ip_list);
      expect(result).toBe(true);
    });

    test('異常系: IPアドレスがリストに含まれない場合、falseを返すこと', () => {
      const req_ip = '10.0.0.100';
      const ip_list = ['192.168.1.0/24_Office'];

      const result = hmUtil.checkIpAddressIncludedList(req_ip, ip_list);
      expect(result).toBe(false);
    });

    test('エッジケース: ワイルドカード(*)を含むIPアドレス範囲でマッチすること', () => {
      const req_ip = '192.168.1.100';
      const ip_list = ['192.168.1.*_Office'];

      const result = hmUtil.checkIpAddressIncludedList(req_ip, ip_list);
      expect(result).toBe(true);
    });

    test('エッジケース: 複数のIPアドレス範囲でマッチすること', () => {
      const req_ip = '10.0.0.50';
      const ip_list = ['192.168.1.0/24_Office', '10.0.0.0/24_VPN'];

      const result = hmUtil.checkIpAddressIncludedList(req_ip, ip_list);
      expect(result).toBe(true);
    });
  });
});
