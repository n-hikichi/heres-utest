// requires
const util = require('util')
const path = require('path')
//const crypto = require('crypto')
const child = require('child_process')
const exec = util.promisify(require('child_process').exec)
const L = require('../util/logger-wrapper')
const dbUtil = require('./db-util')
const hmUtil = require('../util/hm-util')
const apiAuth = require('./api-auth')

/*
const CRYPT_ALGO = 'aes-128-ecb'
const IN_ENCODING = 'base64'
const OUT_ENCODING = 'binary'
const PASS_KEY = '1172177073731675'
*/

// query strings
let SELECT_USER_INFO_INJ =
  'SELECT * from iw_usertbl ' +
  'WHERE mail=$1'

let SELECT_USER_INFO_TOKEN_INJ =
  'SELECT * from iw_usertbl ' +
  'WHERE user_id=$1'

let DELETE_EXPIRED_TELEWORK_DATA_INJ =
  'DELETE FROM iw_workinghourstbl ' +
  'WHERE company_id = $1 ' +
  'AND staff_id = $2 ' +
  'AND linked_date <= $3'

let SELECT_IP_MANAGE_DATA_INJ =
  'SELECT * from iw_ipmanagetbl ' +
  'WHERE company_id=$1'

class LoginAuth {
  // constructor
  constructor() {
    L.sLog.debug('LoginAuth created.')
    //console.log(crypto.getCiphers())
  }

  //
  // authenticate
  //
  // @return
  //   認証成功: ログインしたユーザ情報
  //   認証失敗: null
  //
  async authenticate(accountId, passwd) {
    const query = SELECT_USER_INFO_INJ
    const params = [ accountId ]

    const res = await dbUtil.executeQueryInjection(query, params)
      .catch((err) => {
        return null  // not function return
      })

    // エラー or レスポンスが空の場合は、nullを返す
    if (res === null) {
      L.eLog.error('SQL query error on authenticateByToken')
      return null
    }
    if (hmUtil.isNullorUndefined(res) || res.body.rows.length === 0) {
      return null
    }

    const db_passwd = res.body.rows[0].passwd

    // アカウント停止状態かチェック
    if (db_passwd.indexOf('end') === 0) {
      // DBパスワードの先頭が「end」(アカウント停止状態)
      return {user_id: 'end'}
    }

    // CryptとしてJavaを実行
    let class_path = path.resolve(__dirname + '/../util')
    let java_cmd = 'java -classpath ' + class_path + ' EncDec dec ' + db_passwd
    L.sLog.debug(java_cmd)

    const { stdout, stderr } = await exec(java_cmd)
    if (hmUtil.isNullorUndefined(stderr)) {
      L.eLog.error('Java command error. ' + stderr)
      return null
    }

    if (hmUtil.isNullorUndefined(stdout)) {
      L.sLog.warn('Password None ! - ' + userId)
      return null
    }

    // remove return code
    let dec_pass = stdout.replace(/\r?\n/g, '');
    // compare password
    if (passwd === dec_pass) {
      L.sLog.debug('ID/password Authenticated !')

      const user_info = res.body.rows[0]

      // generate api token
      //const token = apiAuth.generateToken(accountId)
      const token = apiAuth.generateToken(user_info.user_id)

      // return response
      return {
        token: token,
        user_id: user_info.user_id,
        staff_id: user_info.staff_id,
        name: user_info.name,
        company_id: user_info.company_id,
        section_id: user_info.section,
        group_id: user_info.group_id,
        class_id: user_info.class,
        admin_flg: user_info.admin_flg,
        telework_flg: user_info.telework_flg,
        skey: user_info.skey,
        avatar: user_info.avatar,
        input_lead_flg: user_info.input_lead_flg,   // ～Ver2.1：Ver2.2以降未使用になるが、旧バージョンに対応するため残す。(今後折を見て削除)
        linked_wh_flg: user_info.linked_wh_flg,
        attendance_flg: user_info.attendance_flg,
      }
    }
    else {
      L.sLog.warn('Authentication Failed ! - ' + accountId)
      // return null if authentication failed.
      return null
    }

    /* Javascriptのみで実装したいが、以下の方法ではうまく復号できない
    // decrypt password
    let decipher = crypto.createDecipher(CRYPT_ALGO, new Buffer(PASS_KEY))
    let dec = decipher.update(db_passwd, IN_ENCODING, OUT_ENCODING)
    dec += decipher.final(OUT_ENCODING);
    */
  }

  //
  // authenticate by token
  //
  // @return
  //   認証成功: ログインしたユーザ情報
  //   認証失敗: null
  //
  //async authenticateByToken(accountId, token, callback) {
  async authenticateByToken(accountId, token) {
    const token_verified = apiAuth.verifyTokenOnLogin(accountId, token)

    if (token_verified) {
      // ユーザ情報を取得
      const query = SELECT_USER_INFO_TOKEN_INJ
      const params = [ accountId ]

      const res = await dbUtil.executeQueryInjection(query, params)
        .catch((err) => {
          return null  // not function return
        })

      // エラー or レスポンスが空の場合は、nullを返す
      if (res === null) {
        L.eLog.error('SQL query error on authenticateByToken')
        return null
      }
      if (hmUtil.isNullorUndefined(res) || res.body.rows.length === 0) {
        return null
      }

      const user_info = res.body.rows[0]

      // アカウント停止状態かチェック
      if (user_info.passwd.indexOf('end') === 0) {
        // DBパスワードの先頭が「end」(アカウント停止状態)
        return {user_id: 'end'}
      }

      // generate new api token
      const token = apiAuth.generateToken(accountId)

      // return response
      return {
        token: token,
        user_id: user_info.user_id,
        staff_id: user_info.staff_id,
        name: user_info.name,
        company_id: user_info.company_id,
        section_id: user_info.section,
        group_id: user_info.group_id,
        class_id: user_info.class,
        admin_flg: user_info.admin_flg,
        telework_flg: user_info.telework_flg,
        skey: user_info.skey,
        avatar: user_info.avatar,
        input_lead_flg: user_info.input_lead_flg,   // ～Ver2.1：Ver2.2以降未使用になるが、旧バージョンに対応するため残す。(今後折を見て削除)
        linked_wh_flg: user_info.linked_wh_flg,
        attendance_flg: user_info.attendance_flg,
      }
    }
    else {
      L.eLog.error('Login Token Authentication Failed ! - ' + accountId)
      return null
    }
  }

  //
  // reissue login token
  //
  // @return
  //   認証成功: 新しいトークン
  //   認証失敗: null
  //
  async reissueLoginToken(accountId, token) {
    // 新しいトークン発行
    const result = apiAuth.verifyTokenForReissue(accountId, token)
    if (result) {
      const new_token = apiAuth.generateToken(accountId)
      return new_token
    }
    else {
      L.eLog.error('Reissue Login Token Failed ! - ' + accountId)
      return null
    }
  }

  //
  // delete expired telework data
  //
  // @return
  //   (結果は判定しない)
  //
  //async deleteExpiredTeleworkData(company_id, staff_id, from_date) {
  async deleteExpiredTeleworkData(company_id, staff_id, from_date) {
    const query = DELETE_EXPIRED_TELEWORK_DATA_INJ
    const params = [ company_id, staff_id, from_date ]

    return await dbUtil.executeQueryWrite(query, params, 'deleteExpiredTeleworkData')
  }

  //
  // get IP manage data
  //
  // @return
  //   IP管理情報
  //
  async ipListGet(company_id) {
    L.sLog.debug('[ipListGet] start (' + company_id + ')')
    let data = null
    const query = SELECT_IP_MANAGE_DATA_INJ
    const params = [ company_id ]

    const res = await dbUtil.executeQueryInjection(query, params)
      .catch((err) => {
        return null  // not function return
      })
      L.sLog.debug('SQL実行結果(' + JSON.stringify(res) + ')')
    if (res === null) {
      L.eLog.error('ip manage data get error.')
    }
    else if (hmUtil.isNullorUndefined(res) || res.body.rows.length === 0) {
      L.eLog.error('ip manage data no data.')
    }
    else {
      data = res.body.rows[0]
      L.sLog.debug('[ipListGet] ret data (' + JSON.stringify(data) + ')')
    }
    return data
  }

  //
  // check ip address auth
  // (r-whereabouts.jsにも同一処理あり)
  // [IN]  company_id : 企業ID
  //       req        : リクエスト情報
  // [OUT] 結果コード(0 : 認証OK、406 : 認証NG)
  async checkIpAddressAuth (company_id, req) {
    let result_code = 0
    const req_ip = hmUtil.getIpAddressFromReqHeader(req)
    L.sLog.debug('[checkIpAddressAuth] 企業ID(' + company_id + ') リクエスト元IP('+req_ip+')')
    if (req_ip !== '') {
      // IP管理情報を取得
      const ip_manage_data = await this.ipListGet(company_id)
      if (ip_manage_data !== null) {
        L.sLog.debug('[checkIpAddressAuth] IP情報取得OK(' + JSON.stringify(ip_manage_data) + ')')
        if (ip_manage_data.enable_flg === 1) {
          // IPアドレス認証が有効の場合
          // IPアドレスがリストに含まれるかチェック
          let check_result = hmUtil.checkIpAddressIncludedList(req_ip, ip_manage_data.ip_list)
          if (check_result !== true) {
            // 含まれない場合
            L.sLog.warn('ip address certification error.(' + JSON.stringify(req.headers) + ')')
            result_code = 406
          }
        }
      }
      else {
        // IP管理情報が取得できない
        L.sLog.warn('ip manage data get error.(' + JSON.stringify(req.headers) + ')')
        result_code = 406
      }
    }
    else {
      // IPアドレスが取得できない
      L.sLog.warn('ip address get error.(' + JSON.stringify(req.headers) + ')')
      result_code = 406
    }
    return result_code
  }
}

module.exports = new LoginAuth
