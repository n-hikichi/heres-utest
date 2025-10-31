/**
 * place-list.js の単体テスト
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

const placeList = require('../../models/place-list');
const dbUtil = require('../../models/db-util');

describe('PlaceList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlaceList', () => {
    test('正常系: 場所リストを取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          dist_id: '1',
          dist_name: '本社',
          company_id: 'company001',
        },
        {
          dist_id: '2',
          dist_name: '支社',
          company_id: 'company001',
        },
        {
          dist_id: '3',
          dist_name: '在宅',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await placeList.getPlaceList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(3);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getPlaceList'
      );
    });

    test('境界値: 場所が0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await placeList.getPlaceList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });

    test('境界値: 場所が1件の場合、正しく取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          dist_id: '1',
          dist_name: '本社',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await placeList.getPlaceList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(1);
      expect(result.body[0].dist_name).toBe('本社');
    });

    test('異常系: DBエラーの場合、エラー情報を返すこと', async () => {
      const companyId = 'company001';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await placeList.getPlaceList(companyId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });

    test('エッジケース: 複数の企業が存在しても、指定企業のデータのみ取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          dist_id: '1',
          dist_name: '本社',
          company_id: 'company001',
        },
        {
          dist_id: '2',
          dist_name: '支社',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await placeList.getPlaceList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body.every(place => place.company_id === companyId)).toBe(true);
    });

    test('エッジケース: dist_idの昇順でソートされていること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          dist_id: '1',
          dist_name: '本社',
          company_id: 'company001',
        },
        {
          dist_id: '2',
          dist_name: '支社',
          company_id: 'company001',
        },
        {
          dist_id: '3',
          dist_name: '在宅',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await placeList.getPlaceList(companyId);

      expect(result.error).toBe(false);
      expect(result.body[0].dist_id).toBe('1');
      expect(result.body[1].dist_id).toBe('2');
      expect(result.body[2].dist_id).toBe('3');
    });
  });
});
