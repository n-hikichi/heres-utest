/**
 * whereabouts.js の単体テスト
 */

// モックを先に定義
jest.mock('../../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
  eLog: {
    error: jest.fn(),
  },
}));

jest.mock('../../models/db-util', () => ({
  executeQueryRead: jest.fn(),
  executeQueryWrite: jest.fn(),
}));

jest.mock('../../util/hm-util', () => ({
  formatDate: jest.fn((date, format) => '2025/01/01 12:00:00.000'),
}));

const whereabouts = require('../../models/whereabouts');
const dbUtil = require('../../models/db-util');

describe('Whereabouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWhereaboutsByMember', () => {
    test('正常系: メンバーの在席情報を取得できること', async () => {
      const companyId = 'company001';
      const memberId = 'user001';

      const mockData = {
        user_id: 'user001',
        company_id: 'company001',
        state: '1',
        dist: '本社',
        comment: '会議中',
        ret_date: '20250101',
        ret_time: '1500',
        move_direct: '北',
        name_phonetic: 'テストユーザー',
        telework_flg: 0,
        attendance_flg: 1,
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [mockData],
      });

      const result = await whereabouts.getWhereaboutsByMember(companyId, memberId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, memberId],
        'getWhereaboutsByMember'
      );
    });

    test('異常系: メンバーが存在しない場合、空の結果を返すこと', async () => {
      const companyId = 'company001';
      const memberId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await whereabouts.getWhereaboutsByMember(companyId, memberId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });

    test('異常系: DBエラーの場合、エラー情報を返すこと', async () => {
      const companyId = 'company001';
      const memberId = 'user001';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await whereabouts.getWhereaboutsByMember(companyId, memberId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('getWhereaboutsByCompany', () => {
    test('正常系: 企業の全在席情報を取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          user_id: 'user001',
          company_id: 'company001',
          state: '1',
          dist: '本社',
          name_phonetic: 'ユーザー1',
          telework_flg: 0,
          attendance_flg: 1,
          vieworder: 1,
        },
        {
          user_id: 'user002',
          company_id: 'company001',
          state: '2',
          dist: '支社',
          name_phonetic: 'ユーザー2',
          telework_flg: 1,
          attendance_flg: 1,
          vieworder: 2,
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await whereabouts.getWhereaboutsByCompany(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getWhereaboutsByCompany'
      );
    });

    test('境界値: データが0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await whereabouts.getWhereaboutsByCompany(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('getWhereaboutsBySection', () => {
    test('正常系: 部署の在席情報を取得できること', async () => {
      const companyId = 'company001';
      const sectionId = 'section001';

      const mockData = [
        {
          user_id: 'user001',
          company_id: 'company001',
          state: '1',
          dist: '本社',
          name_phonetic: 'ユーザー1',
          telework_flg: 0,
          attendance_flg: 1,
          vieworder: 1,
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await whereabouts.getWhereaboutsBySection(companyId, sectionId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, sectionId],
        'getWhereaboutsBySection'
      );
    });

    test('異常系: 部署が存在しない場合、空の結果を返すこと', async () => {
      const companyId = 'company001';
      const sectionId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await whereabouts.getWhereaboutsBySection(companyId, sectionId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('getWhereaboutsByGroup', () => {
    test('正常系: グループの在席情報を取得できること', async () => {
      const companyId = 'company001';
      const groupId = 'group001';

      const mockData = [
        {
          user_id: 'user001',
          company_id: 'company001',
          state: '1',
          dist: '本社',
          name_phonetic: 'ユーザー1',
          telework_flg: 0,
          attendance_flg: 1,
          vieworder: 1,
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await whereabouts.getWhereaboutsByGroup(companyId, groupId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, groupId],
        'getWhereaboutsByGroup'
      );
    });
  });

  describe('updateWhereaboutsByMember', () => {
    test('正常系: 在席情報を更新できること', async () => {
      const companyId = 'company001';
      const payload = {
        user_id: 'user001',
        state: 1,
        dist: '本社',
        comment: '会議中',
        ret_date: '20250101',
        ret_time: '1500',
        move_direct: '北',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await whereabouts.updateWhereaboutsByMember(companyId, payload);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(result.update_date).toBeDefined();
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [
          payload.state.toString(),
          payload.dist.toString(),
          payload.comment,
          payload.ret_date,
          payload.ret_time,
          payload.move_direct,
          expect.any(Date),
          companyId,
          payload.user_id,
        ],
        'updateWhereaboutsByMember'
      );
    });

    test('境界値: ret_dateとret_timeが"-"の場合、nullに変換されること', async () => {
      const companyId = 'company001';
      const payload = {
        user_id: 'user001',
        state: 1,
        dist: '本社',
        comment: '',
        ret_date: '-',
        ret_time: '-',
        move_direct: '',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await whereabouts.updateWhereaboutsByMember(companyId, payload);

      expect(result.error).toBe(false);
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [
          payload.state.toString(),
          payload.dist.toString(),
          payload.comment,
          null,
          null,
          payload.move_direct,
          expect.any(Date),
          companyId,
          payload.user_id,
        ],
        'updateWhereaboutsByMember'
      );
    });

    test('異常系: 更新対象が存在しない場合、エラーを返すこと', async () => {
      const companyId = 'company001';
      const payload = {
        user_id: 'nonexistent',
        state: 1,
        dist: '本社',
        comment: '',
        ret_date: '-',
        ret_time: '-',
        move_direct: '',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await whereabouts.updateWhereaboutsByMember(companyId, payload);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });
});
