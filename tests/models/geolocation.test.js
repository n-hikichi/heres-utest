/**
 * geolocation.js の単体テスト
 */

// モックを先に定義
jest.mock('../../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
  },
}));

jest.mock('../../models/db-util', () => ({
  executeQueryRead: jest.fn(),
  executeQueryWrite: jest.fn(),
}));

jest.mock('../../util/hm-util', () => ({
  isNullorUndefined: jest.fn((value) => value === undefined || value === null),
}));

const geolocation = require('../../models/geolocation');
const dbUtil = require('../../models/db-util');
const hmUtil = require('../../util/hm-util');

describe('Geolocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateGeolocationByMember', () => {
    test('正常系: 位置情報を更新できること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const payload = {
        lat: 35.6812,
        lon: 139.7671,
        msg: '東京駅付近',
        send_time: '2025-10-28 12:00:00',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await geolocation.updateGeolocationByMember(companyId, memberId, payload);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [
          payload.lat.toString(),
          payload.lon.toString(),
          payload.msg,
          payload.send_time,
          companyId,
          memberId,
        ],
        'updateGeolocationByMember'
      );
    });

    test('境界値: 緯度経度がnullの場合、空文字列に変換されること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const payload = {
        lat: null,
        lon: null,
        msg: 'メッセージのみ',
        send_time: '2025-10-28 12:00:00',
      };

      hmUtil.isNullorUndefined.mockImplementation((value) => value === null || value === undefined);

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await geolocation.updateGeolocationByMember(companyId, memberId, payload);

      expect(result.error).toBe(false);
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [
          '',
          '',
          payload.msg,
          payload.send_time,
          companyId,
          memberId,
        ],
        'updateGeolocationByMember'
      );
    });

    test('境界値: 緯度経度がundefinedの場合、空文字列に変換されること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const payload = {
        msg: 'メッセージのみ',
        send_time: '2025-10-28 12:00:00',
      };

      hmUtil.isNullorUndefined.mockImplementation((value) => value === null || value === undefined);

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await geolocation.updateGeolocationByMember(companyId, memberId, payload);

      expect(result.error).toBe(false);
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [
          '',
          '',
          payload.msg,
          payload.send_time,
          companyId,
          memberId,
        ],
        'updateGeolocationByMember'
      );
    });

    test('異常系: 更新が失敗した場合、エラーを返すこと', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const payload = {
        lat: 35.6812,
        lon: 139.7671,
        msg: 'メッセージ',
        send_time: '2025-10-28 12:00:00',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await geolocation.updateGeolocationByMember(companyId, memberId, payload);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('getGeolocationByMember', () => {
    test('正常系: メンバーの位置情報を取得できること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';

      const mockData = {
        company_id: 'company001',
        staff_id: 'staff001',
        latitude: '35.6812',
        longitude: '139.7671',
        message: '東京駅付近',
        send_time: '2025-10-28 12:00:00',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [mockData],
      });

      const result = await geolocation.getGeolocationByMember(companyId, memberId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([mockData]);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, memberId],
        'getGeolocationByMember'
      );
    });

    test('異常系: メンバーの位置情報が存在しない場合、空配列を返すこと', async () => {
      const companyId = 'company001';
      const memberId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await geolocation.getGeolocationByMember(companyId, memberId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('getGeolocationByCompany', () => {
    test('正常系: 企業の全位置情報を取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          company_id: 'company001',
          staff_id: 'staff001',
          latitude: '35.6812',
          longitude: '139.7671',
          message: '東京駅付近',
          send_time: '2025-10-28 12:00:00',
        },
        {
          company_id: 'company001',
          staff_id: 'staff002',
          latitude: '34.6937',
          longitude: '135.5023',
          message: '大阪駅付近',
          send_time: '2025-10-28 12:05:00',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await geolocation.getGeolocationByCompany(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getGeolocationByCompany'
      );
    });

    test('境界値: データが0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await geolocation.getGeolocationByCompany(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('getGeolocationBySection', () => {
    test('正常系: 部署の位置情報を取得できること', async () => {
      const companyId = 'company001';
      const sectionId = 'section001';

      const mockData = [
        {
          company_id: 'company001',
          staff_id: 'staff001',
          latitude: '35.6812',
          longitude: '139.7671',
          message: '東京駅付近',
          send_time: '2025-10-28 12:00:00',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await geolocation.getGeolocationBySection(companyId, sectionId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, companyId, sectionId],
        'getGeolocationBySection'
      );
    });

    test('異常系: 部署が存在しない場合、空配列を返すこと', async () => {
      const companyId = 'company001';
      const sectionId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await geolocation.getGeolocationBySection(companyId, sectionId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('getGeolocationByGroup', () => {
    test('正常系: グループの位置情報を取得できること', async () => {
      const companyId = 'company001';
      const groupId = 'group001';

      const mockData = [
        {
          company_id: 'company001',
          staff_id: 'staff001',
          latitude: '35.6812',
          longitude: '139.7671',
          message: '東京駅付近',
          send_time: '2025-10-28 12:00:00',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await geolocation.getGeolocationByGroup(companyId, groupId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, companyId, expect.any(String)],
        'getGeolocationByGroup'
      );
    });

    test('異常系: グループが存在しない場合、空配列を返すこと', async () => {
      const companyId = 'company001';
      const groupId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await geolocation.getGeolocationByGroup(companyId, groupId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });
});
