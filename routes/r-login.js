// requires
const express = require('express');
const router = express.Router();
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const loginAuth = require('../models/login-auth')
//const telework = require('../models/telework')

const ROUTE = '/login'

//
// login authentication
//
// @return authentication token
//
router.post('/', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE
  L.aLog.debug(accessInfo)
  L.aLog.debug(JSON.stringify(req.body))

  // クライアントが許容バージョンでは無い場合は405を返却
  // ※req.body.versionが未設定(ver2.5.1以前)の場合を許容するのはver2.6時点のみ。
  //   以降の開発では、req.body.versionが未設定の場合はバージョンエラーとする。
  if (!hmUtil.isNullorUndefined(req.body.version) &&
      !hmUtil.checkCliVersion(req.body.version)) {
    L.sLog.warn('client version error(405)')
    res.sendStatus(405)
    return
  }

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body.accountId) ||
      hmUtil.isNullorUndefined(req.body.passwd)) {
    L.sLog.warn('no post data(400)')
    res.sendStatus(400)
    return
  }

  const result = await loginAuth.authenticate(req.body.accountId, req.body.passwd)
  if (result === null) {
    // 認証に失敗した場合は、401:Unauthorizedをレスポンスする
    L.aLog.info(accessInfo)
    L.sLog.warn('account unauthorized.(401) (' + JSON.stringify(req.body) + ')')
    res.sendStatus(401)
  }
  else if (result.user_id === 'end') {
    // アカウント停止の場合は、404:Suspendedをレスポンスする
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.sLog.warn('account suspended.(404) (' + JSON.stringify(req.body) + ')')
    res.sendStatus(404)
  }
  else {
    // アカウント認証に成功した場合、IP認証を行う
    const res_code = await loginAuth.checkIpAddressAuth(result.company_id, req)
    L.sLog.debug('IP認証結果('+res_code+')')
    if (res_code !== 0) {
      res.sendStatus(res_code)
      return
    }

    L.sLog.debug(result)
    L.sLog.info('login ok. (accountId:' + req.body.accountId + ', user_id:' + result.user_id + ')')

    // 保存期間を超過した勤務時間データを削除(結果は判定しない)
    let from_date = getExpiredDate()
    await loginAuth.deleteExpiredTeleworkData(result.company_id, result.staff_id, from_date)

    const res_obj = {
      error: false,
      status: 'OK',
      body: result
    }
    res.send(res_obj)
  }
})

//
// login authentication by token
//
// @return authentication new token
//         null if failed authentication
//
router.post('/token', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE + '/token'
  L.aLog.debug(accessInfo)
  L.aLog.debug(JSON.stringify(req.body))

  // クライアントが許容バージョンでは無い場合は405を返却
  // ※req.body.versionが未設定(ver2.5.1以前)の場合を許容するのはver2.6時点のみ。
  //   以降の開発では、req.body.versionが未設定の場合はバージョンエラーとする。
  if (!hmUtil.isNullorUndefined(req.body.version) &&
      !hmUtil.checkCliVersion(req.body.version)) {
    L.sLog.warn('client version error(405)')
    res.sendStatus(405)
    return
  }

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body.accountId) ||
      hmUtil.isNullorUndefined(req.headers.authorization)) {
    L.sLog.warn('no post data(400)')
    res.sendStatus(400)
    return
  }

  // token抽出
  // split "Bearer " from header string
  let token = req.headers.authorization.split(' ')[1]
  if (hmUtil.isNullorUndefined(token)) {
    L.sLog.warn('no post data(400)')
    res.sendStatus(400)
    return
  }

  const result = await loginAuth.authenticateByToken(req.body.accountId, token)
  if (result === null) {
    // 認証に失敗した場合は、401:Unauthorizedをレスポンスする
    L.aLog.info(accessInfo)
    L.sLog.warn('account unauthorized.(401) (' + JSON.stringify(req.body) + ')')
    res.sendStatus(401)
  }
  else if (result.user_id === 'end') {
    // アカウント停止の場合は、404:Suspendedをレスポンスする
    L.aLog.info(accessInfo)
    L.sLog.warn('account suspended.(' + JSON.stringify(req.body) + ')')
    res.sendStatus(404)
  }
  else {
    // アカウント認証に成功した場合、IP認証を行う
    const res_code = await loginAuth.checkIpAddressAuth(result.company_id, req)
    L.sLog.debug('IP認証結果(token) ('+res_code+')')
    if (res_code !== 0) {
      res.sendStatus(res_code)
      return
    }

    L.sLog.info('token login ok. (company_id:' + result.company_id + ', user_id:' + result.user_id + ')')

    // 保存期間を超過した勤務時間データを削除(結果は判定しない)
    let from_date = getExpiredDate()
    await loginAuth.deleteExpiredTeleworkData(result.company_id, result.staff_id, from_date)

    const res_obj = {
      error: false,
      status: 'OK',
      body: result
    }
    res.send(res_obj)
  }
})

//
// reissue token
//
// @return authentication new token
//         null if failed authentication
//
router.post('/token/reissue', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE + '/token'
  L.aLog.debug(accessInfo)
  L.aLog.debug(JSON.stringify(req.body))

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body.accountId) ||
      hmUtil.isNullorUndefined(req.headers.authorization)) {
    L.sLog.warn('no post data(400)')
    res.sendStatus(400)
    return
  }

  // token抽出
  let token = req.headers.authorization.split(' ')[1]
  if (hmUtil.isNullorUndefined(token)) {
    L.sLog.warn('no token(400)')
    res.sendStatus(400)
    return
  }

  const result = await loginAuth.reissueLoginToken(req.body.accountId, token)
  if (result === null) {
    // 認証に失敗した場合は、401:Unauthorizedをレスポンスする
    L.aLog.info(accessInfo)
    L.sLog.warn('token unauthorized.(401) (' + JSON.stringify(req.body) + ')')
    res.sendStatus(401)
  }
  else {
    const res_obj = {
      error: false,
      status: 'OK',
      body: result
    }
    res.send(res_obj)
  }
})

const getExpiredDate = () => {
  let date = hmUtil.calcMonth(hmUtil.formatDate(new Date(), 'YYYYMMDD'), -60)
  date = hmUtil.calcDate(date, -1)
  return date
}

module.exports = router;
