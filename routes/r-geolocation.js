// requires
const express = require('express');
const router = express.Router();
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const geolocation = require('../models/geolocation')
const loginAuth = require('../models/login-auth')

const ROUTE = '/geolocations'

//
// post geolocation by company id and member id
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
  L.aLog.debug(JSON.stringify(req.body))

  // IP認証
  const res_code = await loginAuth.checkIpAddressAuth(req.params.cid, req)
  L.sLog.debug('IP認証結果('+res_code+')')
  if (res_code !== 0) {
    res.sendStatus(res_code)    // IP認証エラーの場合は406
    return
  }

  const result = await geolocation.updateGeolocationByMember(req.params.cid, req.params.mid, req.body)
    .catch((err) => {
     return {  // このreturnはresultに代入される
        error: true,
        status: 'Unknown error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.aLog.info(JSON.stringify(req.body))
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }

  res.send(result)
})

//
// get geolocation by company id
//
router.get('/company/:id', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id
  L.aLog.debug(accessInfo)

  const result = await geolocation.getGeolocationByCompany(req.params.id)
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
// get geolocation by company id and section id（未使用）
//
router.get('/company/:cid/section/:sid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/section/' + req.params.sid
  L.aLog.debug(accessInfo)

  const result = await geolocation.getGeolocationBySection(req.params.cid, req.params.sid)
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
// get geolocation by company id and group id（未使用）
//
router.get('/company/:cid/group/:gid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/group/' + req.params.gid
  L.aLog.debug(accessInfo)

  const result = await geolocation.getGeolocationByGroup(req.params.cid, req.params.gid)
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


module.exports = router;
