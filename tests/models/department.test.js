/**
 * department.js の単体テスト
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

const department = require('../../models/department');
const dbUtil = require('../../models/db-util');

describe('Department', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSectionList', () => {
    test('正常系: 部署リストを取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          section_id: 'section001',
          section_name: '営業部',
          company_id: 'company001',
          vieworder: 1,
        },
        {
          section_id: 'section002',
          section_name: '開発部',
          company_id: 'company001',
          vieworder: 2,
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await department.getSectionList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getSectionList'
      );
    });

    test('境界値: 部署が0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await department.getSectionList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });

    test('異常系: DBエラーの場合、エラー情報を返すこと', async () => {
      const companyId = 'company001';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await department.getSectionList(companyId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('getGroupList', () => {
    test('正常系: グループリストを取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          group_id: 'group001',
          group_name: 'グループA',
          company_id: 'company001',
          vieworder: 1,
        },
        {
          group_id: 'group002',
          group_name: 'グループB',
          company_id: 'company001',
          vieworder: 2,
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await department.getGroupList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getGroupList'
      );
    });

    test('境界値: グループが0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await department.getGroupList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });

    test('異常系: DBエラーの場合、エラー情報を返すこと', async () => {
      const companyId = 'company001';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await department.getGroupList(companyId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('getClassList', () => {
    test('正常系: クラスリストを取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          class_id: 'class001',
          class_name: '正社員',
          company_id: 'company001',
        },
        {
          class_id: 'class002',
          class_name: '契約社員',
          company_id: 'company001',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await department.getClassList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getClassList'
      );
    });

    test('境界値: クラスが0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await department.getClassList(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });

    test('異常系: DBエラーの場合、エラー情報を返すこと', async () => {
      const companyId = 'company001';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await department.getClassList(companyId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('統合テスト', () => {
    test('複数のリスト取得が連続して実行できること', async () => {
      const companyId = 'company001';

      dbUtil.executeQueryRead
        .mockResolvedValueOnce({
          error: false,
          status: 'OK',
          body: [{ section_id: 'section001', section_name: '営業部' }],
        })
        .mockResolvedValueOnce({
          error: false,
          status: 'OK',
          body: [{ group_id: 'group001', group_name: 'グループA' }],
        })
        .mockResolvedValueOnce({
          error: false,
          status: 'OK',
          body: [{ class_id: 'class001', class_name: '正社員' }],
        });

      const sectionResult = await department.getSectionList(companyId);
      const groupResult = await department.getGroupList(companyId);
      const classResult = await department.getClassList(companyId);

      expect(sectionResult.body).toHaveLength(1);
      expect(groupResult.body).toHaveLength(1);
      expect(classResult.body).toHaveLength(1);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledTimes(3);
    });
  });
});
