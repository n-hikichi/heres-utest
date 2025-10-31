// requires
const express = require('express');
const router = express.Router();
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const dbUtil = require('../models/db-util')
const apiAuth = require('../models/api-auth')
const whereabouts = require('../models/whereabouts')
const telework = require('../models/telework')
const loginAuth = require('../models/login-auth')

const ROUTE = '/whereabouts'

// use authentication
router.use(apiAuth.verifyToken)

//
// get whereabouts information by company ID
// ※～ver2.5.1
//
router.get('/company/:id', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id
  L.aLog.debug(accessInfo)
  /* ver2.6はver2.5.1以前を許容するが、ver2.6以降は許容しないこと。
  L.sLog.warn('client version error(405) (get whereabouts by cid) (old version)')
  res.sendStatus(405)
  */
  const result = await whereabouts.getWhereaboutsByCompany(req.params.id)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  res.send(result)
})

//
// get whereabouts information by company ID(ver2.6～)
//
router.get('/company/:id/:version', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id +
    '/' + req.params.version
  L.aLog.debug(accessInfo)

    // クライアントが許容バージョンでは無い場合は405を返却
  if (!hmUtil.checkCliVersion(req.params.version)) {
    L.sLog.warn('client version error(405) (get whereabouts by cid)')
    res.sendStatus(405)
    return
  }

  // IP認証
  const res_code = await loginAuth.checkIpAddressAuth(req.params.id, req)
  L.sLog.debug('IP認証結果('+res_code+')')
  if (res_code !== 0) {
    res.sendStatus(res_code)    // IP認証エラーの場合は406
    return
  }

  const result = await whereabouts.getWhereaboutsByCompany(req.params.id)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  res.send(result)
})

//
// get whereabouts information by company ID and member ID
//
router.get('/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/member/' + req.params.mid
  L.aLog.debug(accessInfo)

  const result = await whereabouts.getWhereaboutsByMember(req.params.cid, req.params.mid)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
    res.send(result)
    return
  }

  // 勤怠管理機能利用ユーザの場合、直近勤怠情報を取得する
  let tw_category = 0
  let tw_over_flg = 0
  if (result.body.attendance_flg === 1) {
    const tw_result = await telework.selectLatestTeleworkStatusListByMember(result.body.company_id, result.body.staff_id)
      .catch((err) => {
        return {  // このreturnはresultに代入される
          error: true,
          status: 'Unknown error (get latest telework state)',
        }
      })

    if(tw_result.error) {
      L.aLog.info(JSON.stringify(req.headers))
      L.aLog.info(accessInfo)
      L.eLog.error('Unknown error (get latest telework state) (' + accessInfo + ')')
    }
    else if (tw_result.body.length > 0) {
      tw_category = tw_result.body[0].category
      tw_over_flg = judgeTeleworkingOver(tw_result)
    }
  }
  result.body.latest_wh_category = tw_category
  result.body.teleworking_over_flg = tw_over_flg

  res.send(result)
})

//
// get whereabouts information by company ID and section ID
// ※～ver2.5.1
//
router.get('/company/:cid/section/:sid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/section/' + req.params.sid
  L.aLog.debug(accessInfo)
  /* ver2.6はver2.5.1以前を許容するが、ver2.6以降は許容しないこと。
  L.sLog.warn('client version error(405) (get whereabouts by sid) (old version)')
  res.sendStatus(405)
  return
  */
  const result = await whereabouts.getWhereaboutsBySection(req.params.cid, req.params.sid)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  res.send(result)
})
//
// get whereabouts information by company ID and section ID(ver2.6～)
//
router.get('/company/:cid/section/:sid/:version', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/section/' + req.params.sid +
    '/' + req.params.version
  L.aLog.debug(accessInfo)

    // クライアントが許容バージョンでは無い場合は405を返却
  if (!hmUtil.checkCliVersion(req.params.version)) {
    L.sLog.warn('client version error(405) (get whereabouts by sid)')
    res.sendStatus(405)
    return
  }

  // IP認証
  const res_code = await loginAuth.checkIpAddressAuth(req.params.cid, req)
  L.sLog.debug('IP認証結果('+res_code+')')
  if (res_code !== 0) {
    res.sendStatus(res_code)    // IP認証エラーの場合は406
    return
  }

  const result = await whereabouts.getWhereaboutsBySection(req.params.cid, req.params.sid)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  res.send(result)
})

//
// get whereabouts information by company ID and group ID
// ※～ver2.5.1
//
router.get('/company/:cid/group/:gid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/group/' + req.params.gid
  L.aLog.debug(accessInfo)
  /* ver2.6はver2.5.1以前を許容するが、ver2.6以降は許容しないこと。
  L.sLog.warn('client version error(405) (get whereabouts by gid) (old version)')
  res.sendStatus(405)
  return
  */
  const result = await whereabouts.getWhereaboutsByGroup(req.params.cid, req.params.gid)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  res.send(result)
})
//
// get whereabouts information by company ID and group ID(ver2.6～)
//
router.get('/company/:cid/group/:gid/:version', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/group/' + req.params.gid +
    '/' + req.params.version
  L.aLog.debug(accessInfo)

    // クライアントが許容バージョンでは無い場合は405を返却
  if (!hmUtil.checkCliVersion(req.params.version)) {
    L.sLog.warn('client version error(405) (get whereabouts by gid)')
    res.sendStatus(405)
    return
  }

  // IP認証
  const res_code = await loginAuth.checkIpAddressAuth(req.params.cid, req)
  L.sLog.debug('IP認証結果('+res_code+')')
  if (res_code !== 0) {
    res.sendStatus(res_code)    // IP認証エラーの場合は406
    return
  }

  const result = await whereabouts.getWhereaboutsByGroup(req.params.cid, req.params.gid)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  res.send(result)
})

//
// update whereabouts information
//  ※midは更新を行ったユーザID
//
router.post('/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/member/' + req.params.mid
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }

  // IP認証
  const res_code = await loginAuth.checkIpAddressAuth(req.params.cid, req)
  L.sLog.debug('IP認証結果('+res_code+')')
  if (res_code !== 0) {
    res.sendStatus(res_code)    // IP認証エラーの場合は406
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await whereabouts.updateWhereaboutsByMember(req.params.cid, req.body)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  L.sLog.info('whereabouts update request (company_id: ' + req.params.cid + ', update_userid: ' + req.params.mid + ')(update data: ' + JSON.stringify(req.body) + ')')

  res.send(result)
})

const judgeTeleworkingOver = (data) => {
  let retFlg = 0
  let timeDiff = 9
  if(dbUtil.environmentType === 0) {
    // ローカル環境
    timeDiff = 0
  }
  // 勤務開始してから24時間経過しているかチェック
  for (let i=0; i<data.body.length; i++) {
    if(data.body[i].category === 4) {
      // 先に勤務終了を検出した場合は24時間経過チェックをしない
      break
    }
    const checkDate = hmUtil.calcDate(data.body[i].input_date, 1) + data.body[i].input_hour
    const nowDate = hmUtil.calcHour(hmUtil.formatDate(new Date(), 'YYYYMMDDhhmm'), timeDiff)
    // ★時差として加算している「9」→日本時間への対応。
    // ★日本以外の国からのアクセスにも対応する場合は、修正が必要！！
    if (checkDate < nowDate) {
      // 勤務開始の日時(入力値)が24時間経過
      retFlg = 1
    }
    break
  }
  return retFlg
}

module.exports = router
