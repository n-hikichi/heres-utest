/**
 * telework.js の単体テスト
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
  aLog: {
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../models/db-util', () => ({
  executeQueryRead: jest.fn(),
  executeQueryWrite: jest.fn(),
}));

jest.mock('../../util/hm-util', () => ({
  formatDate: jest.fn((date, format) => '2025/10/28 12:00:00.000'),
  isNullorUndefined: jest.fn((value) => value === undefined || value === null),
  calcDate: jest.fn((date, num) => '20250927'),
  calcMonth: jest.fn((date, num) => '202510'),
}));

const telework = require('../../models/telework');
const dbUtil = require('../../models/db-util');
const hmUtil = require('../../util/hm-util');

describe('Telework', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('insertTeleworkLog', () => {
    test('正常系: テレワークログを登録できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      // 最新テレワークデータのモック
      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 4, // 勤務終了
          input_date: '20251027',
          input_hour: '1800',
          linked_date: '20251027',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(dbUtil.executeQueryWrite).toHaveBeenCalled();
    });

    test('正常系: 日付区切り文字「.」を含む日付を正しく処理できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025.10.28', // ドット区切り（旧仕様）
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 4,
          input_date: '20251027',
          input_hour: '1800',
          linked_date: '20251027',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
    });

    test('異常系: データ不整合の場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1, // 勤務開始
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      // 最新テレワークデータのモック（勤務開始が続く）
      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1, // 勤務開始
          input_date: '20251028',
          input_hour: '0800',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.mismatch).toBe(true);
      expect(result.status).toBe('Mismatch');
    });

    test('異常系: 入力日時が過去の場合、不整合エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 2,
        date: '2025-10-27', // 過去の日付
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '離席',
        updated: 0,
        linked_date: '20251027',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1,
          input_date: '20251028',
          input_hour: '0900',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.mismatch).toBe(true);
      expect(result.status).toBe('Mismatch');
    });

    test('異常系: 紐づく日付が過去の場合、不整合エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 2,
        date: '2025-10-28',
        time: '12:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '離席',
        updated: 0,
        linked_date: '20251027', // 過去の紐づき日付
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1,
          input_date: '20251028',
          input_hour: '0900',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.mismatch).toBe(true);
      expect(result.status).toBe('Mismatch');
    });

    test('正常系: 直近が「離席」で「着席」を登録できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 3, // 着席
        date: '2025-10-28',
        time: '12:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '着席',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 2, // 離席
          input_date: '20251028',
          input_hour: '1100',
          linked_date: '20251028',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
    });

    test('異常系: 直近が「離席」で「勤務開始」を登録しようとした場合、不整合エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1, // 勤務開始
        date: '2025-10-28',
        time: '12:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '勤務開始',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 2, // 離席
          input_date: '20251028',
          input_hour: '1100',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.mismatch).toBe(true);
    });

    test('異常系: 直近が「離席」で「離席」を登録しようとした場合、不整合エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 2, // 離席
        date: '2025-10-28',
        time: '13:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '離席',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 2, // 離席
          input_date: '20251028',
          input_hour: '1100',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.mismatch).toBe(true);
    });

    test('正常系: 直近が「着席」で「離席」を登録できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 2, // 離席
        date: '2025-10-28',
        time: '12:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '離席',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 3, // 着席
          input_date: '20251028',
          input_hour: '0900',
          linked_date: '20251028',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
    });

    test('異常系: 直近が「着席」で「着席」を登録しようとした場合、不整合エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 3, // 着席
        date: '2025-10-28',
        time: '12:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '着席',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 3, // 着席
          input_date: '20251028',
          input_hour: '0900',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.mismatch).toBe(true);
    });

    test('正常系: 直近が「勤務終了」で「勤務開始」を登録できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1, // 勤務開始
        date: '2025-10-29',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '勤務開始',
        updated: 0,
        linked_date: '20251029',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 4, // 勤務終了
          input_date: '20251028',
          input_hour: '1800',
          linked_date: '20251028',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
    });

    test('異常系: 直近が「勤務終了」で「離席」を登録しようとした場合、不整合エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 2, // 離席
        date: '2025-10-28',
        time: '19:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '離席',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 4, // 勤務終了
          input_date: '20251028',
          input_hour: '1800',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.mismatch).toBe(true);
    });

    test('異常系: selectLatestTeleworkStatusByMemberでエラーが発生した場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockRejectedValue(new Error('DB error'));

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Unknown error (selectLatestTeleworkStatusByMember)');
    });

    test('異常系: executeQueryWriteでエラーが発生した場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 4,
          input_date: '20251027',
          input_hour: '1800',
          linked_date: '20251027',
        }],
      });

      dbUtil.executeQueryWrite.mockRejectedValue(new Error('DB error'));

      const result = await telework.insertTeleworkLog(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Unknown error (insertTeleworkLog)');
    });
  });

  describe('updateTeleworkInputLeadFlg', () => {
    test('正常系: テレワーク入力リードフラグを更新できること', async () => {
      const userId = 'user001';
      const inputLead = true;

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.updateTeleworkInputLeadFlg(userId, inputLead);

      expect(result.error).toBe(false);
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [userId, 1],
        'updateTeleworkInputLeadFlg'
      );
    });

    test('境界値: inputLeadがfalseの場合、0が設定されること', async () => {
      const userId = 'user001';
      const inputLead = false;

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.updateTeleworkInputLeadFlg(userId, inputLead);

      expect(result.error).toBe(false);
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [userId, 0],
        'updateTeleworkInputLeadFlg'
      );
    });
  });

  describe('updateTeleworkFlg', () => {
    test('正常系: テレワークフラグを更新できること', async () => {
      const userId = 'user001';
      const teleworkFlg = true;

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.updateTeleworkFlg(userId, teleworkFlg);

      expect(result.error).toBe(false);
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [userId, 1],
        'updateTeleworkFlg'
      );
    });
  });

  describe('updateLinkedTeleworkFlg', () => {
    test('正常系: テレワーク連携フラグを更新できること', async () => {
      const userId = 'user001';
      const linkedWh = true;

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.updateLinkedTeleworkFlg(userId, linkedWh);

      expect(result.error).toBe(false);
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [userId, 1],
        'updateLinkedTeleworkFlg'
      );
    });
  });

  describe('selectLatestTeleworkStatusByMember', () => {
    test('正常系: メンバーの最新テレワークステータスを取得できること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';

      const mockData = {
        workinghour_id: 'wh001',
        staff_id: 'staff001',
        category: 4,
        input_date: '20251028',
        input_hour: '1800',
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [mockData],
      });

      const result = await telework.selectLatestTeleworkStatusByMember(companyId, memberId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, memberId, '00000000'],
        'selectLatestTeleworkStatusByMember'
      );
    });

    test('異常系: データが存在しない場合、空の結果を返すこと', async () => {
      const companyId = 'company001';
      const memberId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await telework.selectLatestTeleworkStatusByMember(companyId, memberId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('selectTeleworkListByDate', () => {
    test('正常系: 指定日のテレワークリストを取得できること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const date = '202510';

      const mockData = [
        {
          workinghour_id: 'wh001',
          staff_id: 'staff001',
          category: 1,
          input_date: '20251028',
          input_hour: '0900',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await telework.selectTeleworkListByDate(companyId, memberId, date);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
    });

    test('境界値: dateがnullの場合、現在年月のデータを取得すること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const date = null;

      hmUtil.formatDate.mockReturnValue('202510');

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await telework.selectTeleworkListByDate(companyId, memberId, date);

      expect(result.error).toBe(false);
      expect(hmUtil.formatDate).toHaveBeenCalled();
    });
  });

  describe('updateTeleworkLogByWorkinghourId', () => {
    test('正常系: テレワークログを更新できること', async () => {
      const payload = {
        workinghour_id: 'wh001',
        category: 2,
        date: '2025-10-28',
        time: '12:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '外出',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.updateTeleworkLogByWorkinghourId(payload);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
    });

    test('正常系: 日付区切り文字「.」を含む日付を正しく処理できること', async () => {
      const payload = {
        workinghour_id: 'wh001',
        category: 2,
        date: '2025.10.28', // ドット区切り（旧仕様）
        time: '12:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '外出',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.updateTeleworkLogByWorkinghourId(payload);

      expect(result.error).toBe(false);
    });
  });

  describe('deleteTeleworkLogByWorkinghourId', () => {
    test('正常系: テレワークログを削除できること', async () => {
      const workinghourId = 'wh001';

      // スタッフ情報取得のモック
      dbUtil.executeQueryRead
        .mockResolvedValueOnce({
          error: false,
          status: 'OK',
          body: [{
            company_id: 'company001',
            staff_id: 'staff001',
          }],
        })
        .mockResolvedValueOnce({
          error: false,
          status: 'OK',
          body: [{
            category: 4,
          }],
        });

      // 削除のモック
      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.deleteTeleworkLogByWorkinghourId(workinghourId);

      expect(result.error).toBe(false);
      expect(result.body.latest_wh_category).toBe(4);
    });

    test('異常系: スタッフ情報取得でエラーが発生した場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';

      dbUtil.executeQueryRead.mockRejectedValue(new Error('DB error'));

      const result = await telework.deleteTeleworkLogByWorkinghourId(workinghourId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Unknown error (select delete data)');
    });

    test('異常系: 最新データ取得でエラーが発生した場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';

      // スタッフ情報取得は成功
      dbUtil.executeQueryRead.mockResolvedValueOnce({
        error: false,
        status: 'OK',
        body: [{
          company_id: 'company001',
          staff_id: 'staff001',
        }],
      });

      // 削除は成功
      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      // 最新データ取得でエラー
      dbUtil.executeQueryRead.mockRejectedValueOnce(new Error('DB error'));

      const result = await telework.deleteTeleworkLogByWorkinghourId(workinghourId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Unknown error (selectLatestTeleworkStatusByMember)');
    });
  });

  describe('checkTeleworkLogSameDate', () => {
    test('正常系: 同日にテレワークログが存在しない場合、trueを返すこと', async () => {
      const data = {
        company_id: 'company001',
        staff_id: 'staff001',
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await telework.checkTeleworkLogSameDate(data);

      expect(result).toBe(true);
    });

    test('異常系: 同日にテレワークログが存在する場合、falseを返すこと', async () => {
      const data = {
        company_id: 'company001',
        staff_id: 'staff001',
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1,
          input_date: '20251028',
          input_hour: '0900',
        }],
      });

      const result = await telework.checkTeleworkLogSameDate(data);

      expect(result).toBe(false);
    });
  });

  describe('insertHolidayInfo', () => {
    test('正常系: 休暇情報を登録できること', async () => {
      const workinghourId = 'wh001';
      const payload = {
        staff_id: 'staff001',
        category: 91,
        date: '2025-10-28',
        company_id: 'company001',
        comment: '有給休暇',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertHolidayInfo(workinghourId, payload);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
    });
  });

  describe('getTeleworkSeq', () => {
    test('正常系: テレワークシーケンスIDを取得できること', async () => {
      const mockSeqId = 12345;

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{ seq_id: mockSeqId }],
      });

      const result = await telework.getTeleworkSeq();

      expect(result).toBe(mockSeqId);
    });

    test('異常系: シーケンスIDの取得に失敗した場合、nullを返すこと', async () => {
      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await telework.getTeleworkSeq();

      expect(result).toBeNull();
    });

    test('境界値: データが空の場合、nullを返すこと', async () => {
      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await telework.getTeleworkSeq();

      expect(result).toBeNull();
    });
  });

  describe('insertTeleworkLogByMember', () => {
    test('正常系: 旧バージョン対応でテレワークログを登録できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: undefined, // 旧バージョン対応
        linked_date: undefined, // 旧バージョン対応
      };

      // 最新テレワークデータのモック
      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 4,
          input_date: '20251027',
          input_hour: '1800',
          linked_date: '20251027',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLogByMember(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
    });

    test('正常系: 日付区切り文字「.」を含む日付を正しく処理できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025.10.28', // ドット区切り（旧仕様）
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 4,
          input_date: '20251027',
          input_hour: '1800',
          linked_date: '20251027',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLogByMember(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
    });

    test('正常系: 日またぎの勤務データを正しく処理できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 4, // 勤務終了（開始以外）
        date: '2025-10-29', // 翌日
        time: '01:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '勤務終了',
        updated: undefined,
        linked_date: undefined,
      };

      // 最新テレワークデータのモック
      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1,
          input_date: '20251028',
          input_hour: '0900',
          linked_date: '20251028',
        }],
      });

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.insertTeleworkLogByMember(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
    });

    test('異常系: DBエラーの場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryWrite.mockRejectedValue(new Error('DB error'));

      const result = await telework.insertTeleworkLogByMember(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Unknown error (insertTeleworkLogByMember)');
    });
  });

  describe('selectLatestTeleworkStatusListByMember', () => {
    test('正常系: メンバーの最新テレワークステータスリスト（最大4件）を取得できること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';

      const mockData = [
        { workinghour_id: 'wh001', category: 4, input_date: '20251028', input_hour: '1800' },
        { workinghour_id: 'wh002', category: 1, input_date: '20251028', input_hour: '0900' },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await telework.selectLatestTeleworkStatusListByMember(companyId, memberId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(result.body.length).toBeLessThanOrEqual(4);
    });
  });

  describe('selectPrevTeleworkData', () => {
    test('正常系: 前月のテレワークデータを取得できること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const date = '202510';

      hmUtil.calcDate.mockReturnValue('20250930');

      const mockData = [
        { workinghour_id: 'wh001', category: 4, input_date: '20250930', input_hour: '1800' },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await telework.selectPrevTeleworkData(companyId, memberId, date);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(hmUtil.calcDate).toHaveBeenCalledWith('20251001', -1);
    });

    test('境界値: dateがnullの場合、現在年月の前月末日を取得すること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const date = null;

      hmUtil.formatDate.mockReturnValue('202510');
      hmUtil.calcDate.mockReturnValue('20250930');

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await telework.selectPrevTeleworkData(companyId, memberId, date);

      expect(result.error).toBe(false);
      expect(hmUtil.formatDate).toHaveBeenCalled();
      expect(hmUtil.calcDate).toHaveBeenCalled();
    });
  });

  describe('selectNextTeleworkData', () => {
    test('正常系: 翌月のテレワークデータを取得できること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const date = '202510';

      hmUtil.calcMonth.mockReturnValue('20251101');

      const mockData = [
        { workinghour_id: 'wh001', category: 1, input_date: '20251101', input_hour: '0900' },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await telework.selectNextTeleworkData(companyId, memberId, date);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(hmUtil.calcMonth).toHaveBeenCalledWith('20251001', 1);
    });

    test('境界値: dateが空文字列の場合、現在年月の翌月を取得すること', async () => {
      const companyId = 'company001';
      const memberId = 'staff001';
      const date = '';

      hmUtil.formatDate.mockReturnValue('202510');
      hmUtil.calcMonth.mockReturnValue('20251101');

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await telework.selectNextTeleworkData(companyId, memberId, date);

      expect(result.error).toBe(false);
      expect(hmUtil.formatDate).toHaveBeenCalled();
      expect(hmUtil.calcMonth).toHaveBeenCalled();
    });
  });

  describe('insertTeleworkLogForEdit', () => {
    test('正常系: テレワーク編集画面からのログ登録が成功すること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1,
          input_date: '20251028',
          input_hour: '0900',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLogForEdit(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
      expect(result.body.latest_wh_category).toBe(1);
    });

    test('正常系: 日付区切り文字「.」を含む日付を正しく処理できること', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025.10.28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1,
          input_date: '20251028',
          input_hour: '0900',
          linked_date: '20251028',
        }],
      });

      const result = await telework.insertTeleworkLogForEdit(workinghourId, companyId, payload);

      expect(result.error).toBe(false);
    });

    test('異常系: 挿入エラーの場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryWrite.mockRejectedValue(new Error('DB error'));

      const result = await telework.insertTeleworkLogForEdit(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Unknown error (insertTeleworkLogForEdit)');
    });

    test('異常系: 最新データ取得エラーの場合、エラーを返すこと', async () => {
      const workinghourId = 'wh001';
      const companyId = 'company001';
      const payload = {
        staff_id: 'staff001',
        category: 1,
        date: '2025-10-28',
        time: '09:00',
        lat: '35.6812',
        lon: '139.7671',
        comment: '出勤',
        updated: 0,
        linked_date: '20251028',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      dbUtil.executeQueryRead.mockRejectedValue(new Error('DB error'));

      const result = await telework.insertTeleworkLogForEdit(workinghourId, companyId, payload);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Unknown error (selectLatestTeleworkStatusByMember)');
    });
  });

  describe('checkHolidaySameDate', () => {
    test('正常系: 同日に休暇情報が存在しない場合、trueを返すこと', async () => {
      const companyId = 'company001';
      const data = {
        staff_id: 'staff001',
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await telework.checkHolidaySameDate(companyId, data);

      expect(result).toBe(true);
    });

    test('正常系: 同日に勤怠情報（勤務開始等）が存在する場合、trueを返すこと', async () => {
      const companyId = 'company001';
      const data = {
        staff_id: 'staff001',
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 1, // 勤務開始（90未満）
          input_date: '20251028',
          input_hour: '0900',
        }],
      });

      const result = await telework.checkHolidaySameDate(companyId, data);

      expect(result).toBe(true);
    });

    test('異常系: 同日に休暇情報が存在する場合、falseを返すこと', async () => {
      const companyId = 'company001';
      const data = {
        staff_id: 'staff001',
        linked_date: '20251028',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [{
          category: 91, // 休暇（90より大きい）
          input_date: '00000000',
          input_hour: '0000',
        }],
      });

      const result = await telework.checkHolidaySameDate(companyId, data);

      expect(result).toBe(false);
    });
  });

  describe('updateHolidayInfo', () => {
    test('正常系: 休暇情報を更新できること', async () => {
      const payload = {
        workinghour_id: 'wh001',
        category: 91,
        date: '2025-10-28',
        comment: '有給休暇変更',
      };

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.updateHolidayInfo(payload);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['00000000', '0000', '', '', payload.comment]),
        'updateHolidayInfo'
      );
    });
  });

  describe('deleteHolidayInfo', () => {
    test('正常系: 休暇情報を削除できること', async () => {
      const workinghourId = 'wh001';

      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      const result = await telework.deleteHolidayInfo(workinghourId);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(dbUtil.executeQueryWrite).toHaveBeenCalledWith(
        expect.any(String),
        [workinghourId],
        'deleteHolidayInfo'
      );
    });
  });
});
