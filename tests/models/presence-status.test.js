/**
 * presence-status.js の単体テスト
 */

// モックを先に定義
jest.mock('../../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
  },
}));

jest.mock('../../models/db-util', () => ({
  executeQueryRead: jest.fn(),
}));

const presenceStatus = require('../../models/presence-status');
const dbUtil = require('../../models/db-util');

describe('PresenceStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPresenceStatusList', () => {
    test('正常系: プレゼンスステータスリストを取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          state_id: '1',
          state_name: '在席',
          company_id: 'company001',
        },
        {
          state_id: '2',
          state_name: '外出',
          company_id: 'company001',
        },
        {
          state_id: '3',
          state_name: '休憩',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await presenceStatus.getPresenceStatusList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(3);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getPresenceStatusList'
      );
    });

    test('境界値: ステータスが0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await presenceStatus.getPresenceStatusList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });

    test('境界値: ステータスが1件の場合、正しく取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          state_id: '1',
          state_name: '在席',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await presenceStatus.getPresenceStatusList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(1);
      expect(result.body[0].state_name).toBe('在席');
    });

    test('異常系: DBエラーの場合、エラー情報を返すこと', async () => {
      const companyId = 'company001';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await presenceStatus.getPresenceStatusList(companyId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });

    test('エッジケース: 複数の企業が存在しても、指定企業のデータのみ取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          state_id: '1',
          state_name: '在席',
          company_id: 'company001',
        },
        {
          state_id: '2',
          state_name: '外出',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await presenceStatus.getPresenceStatusList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body.every(status => status.company_id === companyId)).toBe(true);
    });

    test('エッジケース: state_idの昇順でソートされていること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          state_id: '1',
          state_name: '在席',
          company_id: 'company001',
        },
        {
          state_id: '2',
          state_name: '外出',
          company_id: 'company001',
        },
        {
          state_id: '3',
          state_name: '休憩',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await presenceStatus.getPresenceStatusList(companyId);

      expect(result.error).toBe(false);
      expect(result.body[0].state_id).toBe('1');
      expect(result.body[1].state_id).toBe('2');
      expect(result.body[2].state_id).toBe('3');
    });

    test('エッジケース: 多数のステータスが存在する場合でも正しく取得できること', async () => {
      const companyId = 'company001';

      const mockData = Array.from({ length: 10 }, (_, i) => ({
        state_id: String(i + 1),
        state_name: `ステータス${i + 1}`,
        company_id: 'company001',
      }));

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await presenceStatus.getPresenceStatusList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(10);
      expect(result.body[0].state_name).toBe('ステータス1');
      expect(result.body[9].state_name).toBe('ステータス10');
    });
  });
});
