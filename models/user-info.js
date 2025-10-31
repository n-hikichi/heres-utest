
const util = require('util')
const path = require('path')
const fs = require('fs')
const multer  = require('multer')
//const child = require('child_process')
const AWS = require('aws-sdk')
const s3 = new AWS.S3({'region': 'ap-northeast-1'})
const exec = util.promisify(require('child_process').exec)
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const dbUtil = require('./db-util')

// @Todo 暫定的に定数で定義. 環境変数で定義するように変更する.
//const SERVER_ADDR = 'localhost:3080/uploads/'
//const BUCKET_NAME = 'heresme.micros-america.com'
const BUCKET_NAME = 'heresme.micros-software.com'
const SERVER_ADDR = 'https://s3-ap-northeast-1.amazonaws.com/' + BUCKET_NAME + '/'

const USER_ATTR = ' staff_id, name, name_phonetic, mail, class, section, group_id, company_id, user_id, vieworder, skey, avatar '
let SELECT_USER_INFO_BY_COMPANY_INJ =
  `SELECT ${USER_ATTR} FROM iw_usertbl ` +
  'WHERE company_id=$1'
let SELECT_USER_INFO_INJ =
  `SELECT ${USER_ATTR} FROM iw_usertbl ` +
  'WHERE company_id=$1 AND user_id=$2'
let SELECT_AVATAR_PATH_INJ =
  'SELECT avatar FROM iw_usertbl ' +
  'WHERE company_id=$1 AND user_id=$2'
let UPDATE_AVATAR_PATH_INJ =
  'UPDATE iw_usertbl ' +
  'SET avatar= $1 ' +
  'WHERE company_id=$2 AND user_id=$3'
let SELECT_PASSWD_INJ =
  'SELECT passwd ' +
  'from iw_usertbl ' +
  'WHERE user_id=$1'
let UPDATE_PASSWD_INJ =
  'UPDATE iw_usertbl ' +
  'SET passwd=$2 ' +
  'WHERE user_id=$1'
/*
let UPDATE_CALENDAR_KEY =
  'UPDATE iw_usertbl ' +
  'SET skey=\'$CAL_KEY\' ' +
  'WHERE user_id=\'$USER_ID\''
let SELECT_CALENDAR_KEY =
  'SELECT skey from iw_usertbl ' +
  'WHERE user_id=\'$USER_ID\''
*/

//
// class UserInfo
//
class UserInfo {
  // constructor
  constructor() {
    L.sLog.debug('UserInfo created.')
  }

  //
  // get user information by company
  //
  async getUserInfoByCompany (companyId) {
    const query = SELECT_USER_INFO_BY_COMPANY_INJ
    const params = [ companyId ]

    return await dbUtil.executeQueryRead(query, params, 'getUserInfoByCompany')
  }

  //
  // get user information by user
  //
  // * this method is not used
  //
  async getUserInfoByMember (companyId, userId) {
    const query = SELECT_USER_INFO_INJ
    const params = [ companyId, userId ]

    let result = await dbUtil.executeQueryRead(query, params, 'getUserInfoByMember')
    if (!result.error && result.body.length !== 0) {
      result.body = result.body[0]
    }
    return result
  }

  //
  // get avatar path
  //
  async getAvatarPathByMember (companyId, userId) {
    const query = SELECT_AVATAR_PATH_INJ
    const params = [ companyId, userId ]

    let result = await dbUtil.executeQueryRead(query, params, 'getAvatarPathByMember')
    if (!result.error && result.body.length !== 0) {
      result.body = result.body[0]
    }
    return result
  }

  //
  // change password
  //
  async changePassword (userId, oldpasswd, newpasswd) {
    // check old password
    let collation = await this._checkOldPassword(userId, oldpasswd)
    if (!collation) {
      return {
        error: true,
        status: 'bad oldpasswd'
      }
    }

    //
    // change to new password
    //
    let changed = await this._changeToNewPassword(userId, newpasswd)
    if (!changed) {
      return {
        error: true,
        status: 'failed newpasswd'
      }
    }

    L.sLog.info('password changed completely.')

    return {
      error: false,
      status: 'pw changed',
    }
  }

  //
  // upload avatar file
  //
  async uploadAvatar(companyId, userId, avatarFile) {

    // S3にある、アップロード対象ユーザの画像ファイル情報をすべて取得
    let objects = await this._GetListObjectsFromS3Async(companyId, userId)

    let file_path = 'avatar-image/' + companyId + '/' + avatarFile.filename
    let url = SERVER_ADDR + file_path

    // ファイルをS3にアップロード
    //const s3_result = await this._uploadToS3(companyId, userId, avatarFile)
    const s3_result = await this._uploadToS3Async(companyId, avatarFile)
      .catch((err) => {
        L.eLog.error('failed upload to S3.')
        L.eLog.error(err)
        return {
          error: true,
          status: 'Upload S3 error',
        }
      })

    if (s3_result.error) {
      return s3_result
    }

    // 既存の不要ファイルをS3から削除
    // (アップロードしたファイルが元のファイルと拡張子が異なる場合を考慮)
    for (let elm of objects.Contents) {
      if (elm.Key !== file_path) {
        // 既にS3にあるファイルと、アップロードしたファイル名が一致しない場合は削除
        L.sLog.debug('delete file (' + elm.Key + ')')
        await this._DeleteFromS3Async(elm.Key)
      }
    }

    s3_result.error = false
    s3_result.status = 'OK'
    s3_result.body = url

    // urlをデータベースに登録
    // urlは原則変更されないが、将来変更する可能性もあるので、毎回DBに登録する
    const query = UPDATE_AVATAR_PATH_INJ
    const params = [ url, companyId, userId ]

    const db_result = await dbUtil.executeQueryWrite(query, params, 'uploadAvatar')
    if (db_result.error) {
      L.eLog.error('failed update avatar url')
      return db_result
    }

    // 一時ファイルを削除
    // 一時ファイル削除の失敗は、処理失敗扱いとしない
    fs.unlink(avatarFile.path, (err) => {
      if (err) {
        L.sLog.warn('failed to delete tmp avatar file : ' + userId)
        //s3_result.status = 'Delete tmpfile error'
      }
      else {
        L.sLog.debug('delete tmp avatar file : ' + userId)
        //s3_result.status = 'OK'
      }
    })

    // 成功時は、s3登録時の結果をreturnする
    return s3_result
  }

  //
  // delete avatar file
  //
  // @remark
  //  transaction内でS3からの削除も実行する
  async deleteAvatar(companyId, userId) {

    let result = {}

    await (async () => {
      const pool = dbUtil.beginPool()

      // note: we don't try/catch this because if connecting throws an exception
      // we don't need to dispose of the client (it will be undefined)
      const client = await pool.connect()

      try {
        // begin transaction
        await client.query('BEGIN')

        // delete URL from database
        const query = UPDATE_AVATAR_PATH_INJ
        const params = [ null, companyId, userId ]
        // ignore return value
        //const { rows } = await client.query(query, params)
        await client.query(query, params)

        // delete all image file from S3
        // ignore return value
        //const s3_result = await this._DeleteAllFromS3Async(companyId, userId)
        await this._DeleteAllFromS3Async(companyId, userId)

        // do commit if no error occurred
        await client.query('COMMIT')

        result.error = false
        result.status = 'OK'
        result.body = null

        L.sLog.debug('delete avatar finished.')
      }
      catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
      finally {
        client.release()
      }
    })()
      .catch((err) => {
        L.eLog.error(`Error on deleteAvatar transaction`)
        L.eLog.error(err.stack)

        result.error = true
        result.status = 'Delete avatar error'
        result.body = null
      })

    return result
  }

  //
  // upload avatar file to S3
  //
  async _uploadToS3Async(companyId, avatarFile) {
    const data = await this._readFilePro(avatarFile.path)
      .catch((err) => {
        throw err
      })

    const bucket = BUCKET_NAME + '/avatar-image'
    const key = companyId + '/' + avatarFile.filename
    let params = {
      ACL: 'public-read',
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: avatarFile.mimetype,
    }

    const s3_result = await this._s3UploadPro(params)
      .catch((err) => {
        throw err
      })

    return {
      error: false,
      status: 'OK',
      body: s3_result,
    }

  }

  //
  // read file by promise
  //
  async _readFilePro(filepath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filepath, (err, data) => {
        if (err) {
          L.sLog.debug('failed read avatar file.')
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }

  //
  // upload file by promise
  //
  async _s3UploadPro(params) {
    return new Promise((resolve, reject) => {
      s3.upload(params, (err, result) => {
        if (err) {
          L.eLog.error('failed to S3 upload. (' + err + ')')
          reject(err)
          return
        }
        L.sLog.debug('upload to S3 succeeded.')
        L.sLog.debug(result)
        resolve(result)
      })
    })
  }

  //
  // delete avatar file from S3(1 file)
  //
  async _DeleteFromS3Async(filePath) {
    let context = this
    let s3_result = null
    await (async () => {
      let params_d = {
        Bucket: BUCKET_NAME,
        Key: filePath,
      }
      L.sLog.debug('profile image delete param: ' + JSON.stringify(params_d))

      // 画像を削除
      s3_result = await context._s3DeleteObjectPro(params_d)
      L.sLog.debug('delete finished : ' + JSON.stringify(s3_result))

    })()
      .catch((err) => {
        throw err
      })

    L.sLog.debug('return result.')

    return {
      error: false,
      status: 'OK',
      body: s3_result || null,
    }
  }

  //
  // delete all avatar file from S3
  //
  async _DeleteAllFromS3Async(companyId, userId) {
    let context = this
    let s3_result = null
    let objects = await this._GetListObjectsFromS3Async(companyId, userId)
    await (async () => {
      let keys = []
      for (let elm of objects.Contents) {
        keys.push({
          Key: elm.Key,
        })
      }

      let params_d = {
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: keys,
        },
      }
      L.sLog.debug('profile image delete param : ' + JSON.stringify(params_d))

      // 画像を削除
      s3_result = await context._s3DeleteObjectsPro(params_d)
      L.sLog.debug('delete finished : ' + JSON.stringify(s3_result))

    })()
      .catch((err) => {
        L.sLog.debug('delete error')
        throw err
      })

    L.sLog.debug('return result.')

    return {
      error: false,
      status: 'OK',
      body: s3_result || null,
    }
  }

  //
  // get avatar files info from S3
  //
  async _GetListObjectsFromS3Async(companyId, userId) {
    let objects = null
    const prefix = 'avatar-image/' + companyId + '/' + userId

    let context = this
    await (async () => {
      let params_l = {
        Bucket: BUCKET_NAME,
        Prefix: prefix,
      }

      // メンバ画像リストを取得
      objects = await context._s3ListObjectsPro(params_l)
      L.sLog.debug('get list objects from S3 : ' + JSON.stringify(objects.Contents))
    })()
    .catch((err) => {
      L.sLog.debug('failed to get list objects from S3.')
      throw err
    })
    return objects
  }

  //
  // list S3 objects by promise
  //
  async _s3ListObjectsPro(params) {
    return new Promise((resolve, reject) => {
      s3.listObjectsV2(params, (err, result) => {
        if (err) {
          L.eLog.error('failed to get list objects from S3. (' + err + ')')
          reject(err)
          return
        }
        L.sLog.debug('get list objects from S3 succeeded.')
        L.sLog.debug(result)
        resolve(result)
      })
    })
  }

  //
  // delete S3 object by promise
  //
  async _s3DeleteObjectPro(params) {
    return new Promise((resolve, reject) => {
      s3.deleteObject(params, (err, result) => {
        if (err) {
          L.eLog.error('failed to S3 delete. (' + err + ')')
          reject(err)
          return
        }
        L.sLog.debug('delete from S3 succeeded.')
        L.sLog.debug(result)
        resolve(result)
      })
    })
  }

  //
  // delete S3 objects by promise
  //
  async _s3DeleteObjectsPro(params) {
    return new Promise((resolve, reject) => {
      s3.deleteObjects(params, (err, result) => {
        if (err) {
          L.eLog.error('failed to S3 delete. (' + err + ')')
          reject(err)
          return
        }
        L.sLog.debug('delete from S3 succeeded.')
        L.sLog.debug(result)
        resolve(result)
      })
    })
  }

  //
  // check old password
  //
  async _checkOldPassword(userId, oldpasswd) {
    const query = SELECT_PASSWD_INJ
    const params = [
      userId,
    ]
    const res = await dbUtil.executeQueryInjection(query, params, '_checkOldPassword')

    if (res.error) {
      return false
    }

    const db_passwd = res.body.rows[0].passwd

    const class_path = path.resolve(__dirname + '/../util')
    const java_cmd = 'java -classpath ' + class_path + ' EncDec dec ' + db_passwd
    L.sLog.debug(java_cmd)

    const { stdout, stderr } = await exec(java_cmd)
    if (hmUtil.isNullorUndefined(stderr)) {
      L.eLog.error('Java command error. ' + stderr)
      return false
    }

    if (hmUtil.isNullorUndefined(stdout)) {
      L.sLog.warn('Password None ! - ' + userId)
      return false
    }

    // remove return code
    let dec_pass = stdout.replace(/\r?\n/g, '');
    //console.log(dec_pass)
    // compare password
    if (oldpasswd === dec_pass) {
      L.sLog.debug('success - Old Password Collated !')
      return true
    }
    else {
      L.sLog.warn('Password Collation failed ! - ' + userId)
      return false
    }

  }

  //
  // change to new password
  //
  async _changeToNewPassword(userId, newpasswd) {
    let class_path = path.resolve(__dirname + '/../util')
    let java_cmd = 'java -classpath ' + class_path + ' EncDec enc ' + newpasswd
    L.sLog.debug(java_cmd)

    //const { stdout, stderr } = await exec(java_cmd)
    const { stdout, stderr } = await exec(java_cmd)
    if (hmUtil.isNullorUndefined(stderr)) {
      L.eLog.error('Java command error. ' + stderr)
      return false
    }

    if (hmUtil.isNullorUndefined(stdout)) {
      L.sLog.warn('Password None ! - ' + userId)
      return false
    }

    // remove return code
    let new_pw = stdout.replace(/\r?\n/g, '');
    L.sLog.debug('new passwd : ' + new_pw)

    const query = UPDATE_PASSWD_INJ
    const params = [
      userId,
      new_pw,
    ]
    const res = await dbUtil.executeQueryInjection(query, params, '_changeToNewPassword')

    if (res.error) {
      return false
    }
    else {
      return true  // パスワード変更成功
    }

  }

  /* カレンダー機能は削除
  //
  // get calendar key
  //
  async getCalendarKey (companyId, userId) {
    let query = SELECT_CALENDAR_KEY
      .replace('$USER_ID', userId)

    const res = await dbUtil.executeQuery(query)

    if (res.error) {
      L.sLog.error(`failed get calendar key - ${userId}`)
      // if get key failed return null
      return null
    }
    else {
      // return calendar key
      return res.body.rows[0]
    }
  }

  //
  // set calendar key
  //
  async setCalendarKey (companyId, userId, key) {
    let query = UPDATE_CALENDAR_KEY
      .replace('$USER_ID', userId)
      .replace('$CAL_KEY', key)
    const res = await dbUtil.executeQuery(query)
    if (res.error) {
      L.sLog.error(`failed update calendar key - ${userId} : ${key}`)
      return false
    }
    else {
      return true
    }
  }
  */
}

module.exports = new UserInfo
