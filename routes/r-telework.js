// requires
const express = require('express');
const router = express.Router();
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const telework = require('../models/telework');
const e = require('express');

const ROUTE = '/telework'

//
// post telework by company id and member id(Ver2.2～)
//
router.post('/reg/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/reg' +
    '/company/' + req.params.cid +
    '/member/' + req.params.mid       // user_id
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  // 同日に休暇情報が登録済みかチェック
  let isDuplicate = await telework.checkHolidaySameDate(req.params.cid, req.body)
  L.aLog.debug('★同日休暇情報登録チェック結果(' + isDuplicate + ')')
  if (isDuplicate === false) {
    const res_obj = {
      error: true,
      mismatch: true,
      status: 'mismatch telework log',
    }
    res.send(res_obj)
    return
  }

  // workinghours_id作成
  const seq_num = await telework.getTeleworkSeq()
  let id_date = (hmUtil.formatDate(new Date(), 'YYYYMMDDhhmm')).substring(2)
  let seq_id = ('0000' + seq_num).slice(-4)
  const workinghour_id = id_date + seq_id

  const result = await telework.insertTeleworkLog(workinghour_id, req.params.cid, req.body)
  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.aLog.info(JSON.stringify(req.body))
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }
  else {
    result.workinghour_id = workinghour_id
  }

  res.send(result)
})

//
// post telework by company id and member id(～Ver2.1)
//
router.post('/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/member/' + req.params.mid       // user_id
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  // workinghours_id作成
  const seq_num = await telework.getTeleworkSeq()
  let id_date = (hmUtil.formatDate(new Date(), 'YYYYMMDDhhmm')).substring(2)
  let seq_id = ('0000' + seq_num).slice(-4)
  const workinghour_id = id_date + seq_id

  const result = await telework.insertTeleworkLogByMember(workinghour_id, req.params.cid, req.body)
  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.aLog.info(JSON.stringify(req.body))
    L.eLog.error('Unknown error (' + accessInfo + ')')
  }
  else {
    result.workinghour_id = workinghour_id
  }

  res.send(result)
})

//
// get telework status by company id and member id (1data)
//
router.get('/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/member/' + req.params.mid     // staff_id
  L.aLog.debug(accessInfo)

  const result = await telework.selectLatestTeleworkStatusByMember(req.params.cid, req.params.mid)
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
// get telework status list by company id and member id (max 4data) (Ver2.1～2.2)
// ※テレワーク送信ダイアログに直近勤務データを複数表示する場合に使用
//
router.get('/company/:cid/member/:mid/list', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/member/' + req.params.mid     // staff_id
  L.aLog.debug(accessInfo)

  const result = await telework.selectLatestTeleworkStatusListByMember(req.params.cid, req.params.mid)
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
// post telework input lead flg(～Ver2.1)
// ※旧バージョンからの要求に対応するため、残しておく。
//
router.post('/inputlead', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/inputlead'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await telework.updateTeleworkInputLeadFlg(req.body.userId, req.body.inputLead)
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
// post telework flg
//
router.post('/flg', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/flg'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await telework.updateTeleworkFlg(req.body.userId, req.body.telework_flg)
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
// post linked telework flg
//
router.post('/linked', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/linked'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await telework.updateLinkedTeleworkFlg(req.body.userId, req.body.linked_wh_flg)
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
// get telework list by company id and member id and date
//
router.get('/company/:cid/member/:mid/date/:date', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/member/' + req.params.mid +
    '/date/' + req.params.date
  L.aLog.debug(accessInfo)

  // 指定年月の勤務時間データを取得
  const result = await telework.selectTeleworkListByDate(req.params.cid, req.params.mid, req.params.date)
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
  
  // 指定年月以前の最後の勤務時間データを取得(更新データチェック用)
  // (引数にはユーザ指定の年月を指定する))
  const result_prevdata = await telework.selectPrevTeleworkData(req.params.cid, req.params.mid, req.params.date)
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

  if (result_prevdata.body.length > 0) {
    // データあり
    result.body.unshift(result_prevdata.body[0])
  }

  // 指定年月以降の最初の勤務時間データを取得(更新データチェック用)
  // (引数にはユーザ指定の年月を指定する))
  const result_nextdata = await telework.selectNextTeleworkData(req.params.cid, req.params.mid, req.params.date)
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
    return
  }
  else if (result_nextdata.body.length > 0) {
    // データあり
    result.body.push(result_nextdata.body[0])
  }

  res.send(result)
})

//
// get teleworking user list
//
/*router.get('/company/:cid/teleworking', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.cid +
    '/teleworking'
  L.aLog.debug(accessInfo)

  const result = await telework.selectTeleworkingUserList(req.params.cid)
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
})*/

//
// edit telework by workinghour id(Ver2.2～テレワーク編集)
//
router.post('/edit/company/:cid/', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/edit' +
    '/company/' + req.params.cid
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  let result = null
  if (hmUtil.isNullorUndefined(req.body.workinghour_id)) {
    // idが無い場合は登録
    // workinghours_id作成
    const seq_num = await telework.getTeleworkSeq()
    let id_date = (hmUtil.formatDate(new Date(), 'YYYYMMDDhhmm')).substring(2)
    let seq_id = ('0000' + seq_num).slice(-4)
    const workinghour_id = id_date + seq_id

    result = await telework.insertTeleworkLogForEdit(workinghour_id, req.params.cid, req.body)
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
    else {
      result.workinghour_id = workinghour_id
      result.latest_wh_category = result.body.latest_wh_category
    }
  }
  else {
    // idがある場合は更新
    result = await telework.updateTeleworkLogByWorkinghourId(req.body)
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
  }

  res.send(result)
})

//
// update telework by workinghour id(～Ver2.1)
//
router.post('/update', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/update'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await telework.updateTeleworkLogByWorkinghourId(req.body)
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
// delete telework by workinghour id
//
router.post('/delete', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/delete'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await telework.deleteTeleworkLogByWorkinghourId(req.body.id)
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
// post holiday info by company id and staff id
//
router.post('/holiday', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/holiday'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  let workinghour_id = ''
  let result = null
  if (hmUtil.isNullorUndefined(req.body.workinghour_id)) {
    // workinghours_id未設定 → 登録

    // 同日に勤怠情報が登録済みかチェック
    let isDuplicate = await telework.checkTeleworkLogSameDate(req.body)
    L.aLog.debug('★同日勤怠情報登録チェック結果(' + isDuplicate + ')')
    if (isDuplicate === false) {
      const res_obj = {
        error: true,
        mismatch: true,
        status: 'mismatch telework log',
      }
      res.send(res_obj)
      return
    }

    // workinghour_id作成
    const seq_num = await telework.getTeleworkSeq()
    let id_date = (hmUtil.formatDate(new Date(), 'YYYYMMDDhhmm')).substring(2)
    let seq_id = ('0000' + seq_num).slice(-4)
    workinghour_id = id_date + seq_id

    // 休暇情報登録
    result = await telework.insertHolidayInfo(workinghour_id, req.body)
      .catch((err) => {
        return {
          error: true,
          mismatch: false,
          status: 'Unknown error',
        }
      })

    if(result.error) {
      L.aLog.info(JSON.stringify(req.headers))
      L.aLog.info(accessInfo)
      L.aLog.info(JSON.stringify(req.body))
      L.eLog.error('Unknown error(insertHolidayInfo) (' + accessInfo + ')')
    }
    else {
      result.workinghour_id = workinghour_id
    }
  }
  else {
    // 休暇情報更新
    result = await telework.updateHolidayInfo(req.body)
      .catch((err) => {
        return {
          error: true,
          mismatch: false,
          status: 'Unknown error',
        }
      })

    if(result.error) {
      L.aLog.info(JSON.stringify(req.headers))
      L.aLog.info(accessInfo)
      L.aLog.info(JSON.stringify(req.body))
      L.eLog.error('Unknown error(updateHolidayInfo) (' + accessInfo + ')')
    }
  }

  res.send(result)
})

//
// delete holiday info
//
router.post('/holiday/delete', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/holiday/delete'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await telework.deleteHolidayInfo(req.body.id)
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

module.exports = router
