/**
 * user-info.js の単体テスト
 */

const util = require('util');
const fs = require('fs');

// child_processのexecをコールバック形式でモック
const mockExec = jest.fn();

// グローバルなS3モック（変数名を "mock" で始める必要がある - Jestの制限）
const mockS3Instance = {
  upload: jest.fn(),
  listObjectsV2: jest.fn(),
  deleteObject: jest.fn(),
  deleteObjects: jest.fn(),
};

// モックを先に定義
jest.mock('../../util/logger-wrapper', () => ({
  sLog: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  eLog: {
    error: jest.fn(),
  },
}));

jest.mock('../../models/db-util', () => ({
  executeQueryRead: jest.fn(),
  executeQueryWrite: jest.fn(),
  executeQueryInjection: jest.fn(),
  beginPool: jest.fn(),
  endPool: jest.fn(),
}));

jest.mock('../../util/hm-util', () => ({
  isNullorUndefined: jest.fn((value) => value === undefined || value === null),
}));

jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => mockS3Instance),
  SSM: jest.fn(),
}));

jest.mock('fs', () => ({
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: mockExec,
}));

const userInfo = require('../../models/user-info');
const dbUtil = require('../../models/db-util');
const AWS = require('aws-sdk');

describe('UserInfo', () => {
  let s3Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // mockS3Instanceを直接参照（グローバルモック）
    s3Mock = mockS3Instance;
  });

  describe('getUserInfoByCompany', () => {
    test('正常系: 企業のユーザー情報リストを取得できること', async () => {
      const companyId = 'company001';

      const mockData = [
        {
          staff_id: 'staff001',
          name: 'ユーザー1',
          name_phonetic: 'ユーザー1',
          mail: 'user1@example.com',
          class: 'class001',
          section: 'section001',
          group_id: 'group001',
          company_id: 'company001',
          user_id: 'user001',
          vieworder: 1,
          skey: 'key1',
          avatar: 'https://example.com/avatar1.png',
        },
        {
          staff_id: 'staff002',
          name: 'ユーザー2',
          name_phonetic: 'ユーザー2',
          mail: 'user2@example.com',
          class: 'class001',
          section: 'section002',
          group_id: 'group002',
          company_id: 'company001',
          user_id: 'user002',
          vieworder: 2,
          skey: 'key2',
          avatar: 'https://example.com/avatar2.png',
        },
      ];

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: mockData,
      });

      const result = await userInfo.getUserInfoByCompany(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toHaveLength(2);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId],
        'getUserInfoByCompany'
      );
    });

    test('境界値: ユーザーが0件の場合、空配列を返すこと', async () => {
      const companyId = 'company999';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await userInfo.getUserInfoByCompany(companyId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });

    test('異常系: DBエラーの場合、エラー情報を返すこと', async () => {
      const companyId = 'company001';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: true,
        status: 'SQL query error',
      });

      const result = await userInfo.getUserInfoByCompany(companyId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('SQL query error');
    });
  });

  describe('getUserInfoByMember', () => {
    test('正常系: メンバーのユーザー情報を取得できること', async () => {
      const companyId = 'company001';
      const userId = 'user001';

      const mockData = {
        staff_id: 'staff001',
        name: 'ユーザー1',
        name_phonetic: 'ユーザー1',
        mail: 'user1@example.com',
        class: 'class001',
        section: 'section001',
        group_id: 'group001',
        company_id: 'company001',
        user_id: 'user001',
        vieworder: 1,
        skey: 'key1',
        avatar: 'https://example.com/avatar1.png',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [mockData],
      });

      const result = await userInfo.getUserInfoByMember(companyId, userId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, userId],
        'getUserInfoByMember'
      );
    });

    test('異常系: ユーザーが存在しない場合、空の結果を返すこと', async () => {
      const companyId = 'company001';
      const userId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await userInfo.getUserInfoByMember(companyId, userId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('getAvatarPathByMember', () => {
    test('正常系: メンバーのアバターパスを取得できること', async () => {
      const companyId = 'company001';
      const userId = 'user001';

      const mockData = {
        avatar: 'https://example.com/avatar1.png',
      };

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [mockData],
      });

      const result = await userInfo.getAvatarPathByMember(companyId, userId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual(mockData);
      expect(dbUtil.executeQueryRead).toHaveBeenCalledWith(
        expect.any(String),
        [companyId, userId],
        'getAvatarPathByMember'
      );
    });

    test('異常系: ユーザーが存在しない場合、空の結果を返すこと', async () => {
      const companyId = 'company001';
      const userId = 'nonexistent';

      dbUtil.executeQueryRead.mockResolvedValue({
        error: false,
        status: 'OK',
        body: [],
      });

      const result = await userInfo.getAvatarPathByMember(companyId, userId);

      expect(result.error).toBe(false);
      expect(result.body).toEqual([]);
    });
  });

  describe('changePassword', () => {
    test('正常系: パスワード変更が成功すること', async () => {
      const userId = 'user001';
      const oldpasswd = 'old_password';
      const newpasswd = 'new_password';

      // _checkOldPasswordのモック
      dbUtil.executeQueryInjection
        .mockResolvedValueOnce({
          error: false,
          body: {
            rows: [{ passwd: 'encrypted_old_password' }],
          },
        })
        .mockResolvedValueOnce({
          error: false,
          body: {
            rowCount: 1,
          },
        });

      // child_process.execのモック（復号化・暗号化）
      let callCount = 0;
      mockExec.mockImplementation((cmd, callback) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { stdout: 'old_password\n', stderr: '' });
        } else {
          callback(null, { stdout: 'encrypted_new_password\n', stderr: '' });
        }
      });

      const result = await userInfo.changePassword(userId, oldpasswd, newpasswd);

      expect(result.error).toBe(false);
      expect(result.status).toBe('pw changed');
    });

    test('異常系: 旧パスワードが一致しない場合、エラーを返すこと', async () => {
      const userId = 'user001';
      const oldpasswd = 'wrong_password';
      const newpasswd = 'new_password';

      dbUtil.executeQueryInjection.mockResolvedValue({
        error: false,
        body: {
          rows: [{ passwd: 'encrypted_old_password' }],
        },
      });

      // child_process.execのモック（復号化）
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'correct_old_password\n', stderr: '' });
      });

      const result = await userInfo.changePassword(userId, oldpasswd, newpasswd);

      expect(result.error).toBe(true);
      expect(result.status).toBe('bad oldpasswd');
    });
  });

  describe('uploadAvatar', () => {
    test('正常系: アバターのアップロードが成功すること', async () => {
      const companyId = 'company001';
      const userId = 'user001';
      const avatarFile = {
        filename: 'user001_avatar.png',
        path: '/tmp/upload_12345.png',
        mimetype: 'image/png',
      };

      // S3のlistObjectsV2のモック
      s3Mock.listObjectsV2.mockImplementation((params, callback) => {
        callback(null, { Contents: [] });
      });

      // fsのreadFileのモック
      fs.readFile.mockImplementation((filepath, callback) => {
        callback(null, Buffer.from('fake_image_data'));
      });

      // S3のuploadのモック
      s3Mock.upload.mockImplementation((params, callback) => {
        callback(null, { Location: 'https://s3.amazonaws.com/bucket/avatar.png' });
      });

      // DBのupdateのモック
      dbUtil.executeQueryWrite.mockResolvedValue({
        error: false,
        status: 'OK',
        body: 1,
      });

      // fsのunlinkのモック
      fs.unlink.mockImplementation((filepath, callback) => {
        callback(null);
      });

      const result = await userInfo.uploadAvatar(companyId, userId, avatarFile);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(result.body).toBeDefined();
    });

    test('異常系: S3アップロードが失敗した場合、エラーを返すこと', async () => {
      const companyId = 'company001';
      const userId = 'user001';
      const avatarFile = {
        filename: 'user001_avatar.png',
        path: '/tmp/upload_12345.png',
        mimetype: 'image/png',
      };

      s3Mock.listObjectsV2.mockImplementation((params, callback) => {
        callback(null, { Contents: [] });
      });

      fs.readFile.mockImplementation((filepath, callback) => {
        callback(null, Buffer.from('fake_image_data'));
      });

      s3Mock.upload.mockImplementation((params, callback) => {
        callback(new Error('S3 upload failed'), null);
      });

      const result = await userInfo.uploadAvatar(companyId, userId, avatarFile);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Upload S3 error');
    });
  });

  describe('deleteAvatar', () => {
    test('正常系: アバターの削除が成功すること', async () => {
      const companyId = 'company001';
      const userId = 'user001';

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
          .mockResolvedValueOnce({}), // COMMIT
        release: jest.fn(),
      };

      const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
      };

      dbUtil.beginPool.mockReturnValue(mockPool);

      s3Mock.listObjectsV2.mockImplementation((params, callback) => {
        callback(null, {
          Contents: [
            { Key: 'avatar-image/company001/user001_avatar.png' },
          ],
        });
      });

      s3Mock.deleteObjects.mockImplementation((params, callback) => {
        callback(null, { Deleted: [{ Key: 'avatar-image/company001/user001_avatar.png' }] });
      });

      const result = await userInfo.deleteAvatar(companyId, userId);

      expect(result.error).toBe(false);
      expect(result.status).toBe('OK');
      expect(result.body).toBeNull();
    });

    test('異常系: トランザクション実行中にエラーが発生した場合、ロールバックすること', async () => {
      const companyId = 'company001';
      const userId = 'user001';

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockRejectedValueOnce(new Error('DB error')) // UPDATE (エラー)
          .mockResolvedValueOnce({}), // ROLLBACK
        release: jest.fn(),
      };

      const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
      };

      dbUtil.beginPool.mockReturnValue(mockPool);

      const result = await userInfo.deleteAvatar(companyId, userId);

      expect(result.error).toBe(true);
      expect(result.status).toBe('Delete avatar error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
