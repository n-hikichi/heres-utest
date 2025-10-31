// requires
const express = require('express');
const router = express.Router();
const multer  = require('multer')
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const apiAuth = require('../models/api-auth')
const userinfo = require('../models/user-info')

const ROUTE = '/userinfo'

// use authentication
router.use(apiAuth.verifyToken)

//
// get member information by company id
//
router.get('/company/:id', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id
  L.aLog.debug(accessInfo)

  const result = await userinfo.getUserInfoByCompany(req.params.id)
    .catch((err) => {
      return {
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
// change password
//
router.post('/passwd', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/passwd'
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }
  L.aLog.debug(JSON.stringify(req.body))

  const result = await userinfo.changePassword(req.body.userId, req.body.oldpasswd, req.body.newpasswd)
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
// get avatar information
//
router.get('/avatar/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/avatar/company/' + req.params.cid + '/member/' + req.params.mid
  L.aLog.debug(accessInfo)

  const result = await userinfo.getAvatarPathByMember(req.params.cid, req.params.mid)
    .catch((err) => {
      return {
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
// upload avatar image
//
router.post('/avatar/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/avatar/company/' + req.params.cid + '/member/' + req.params.mid
  L.aLog.debug(accessInfo)

  // postデータがない場合は、bad request扱いにする
  if (hmUtil.isNullorUndefined(req.body)) {
    res.sendStatus(400)
    return
  }

  // working directoryに一時保存
  let storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'static/uploads/')
    },
    filename: function (req, file, cb) {
      let ext = _getFileExtention(file.originalname)
      cb(null, req.params.mid + '.' + ext)
    }
  })
  
  let upload = multer({ storage: storage }).single('avatar-img')

  upload(req, res, async (err) => {
    L.aLog.debug(req.file)
    if (err) {
      L.aLog.info(JSON.stringify(req.headers))
      L.aLog.info(accessInfo)
      L.eLog.error(err.message + '\n' + err.stack)
      const resobj = {
        error: true,
        status: 'error in upload function',
      }
      res.send(resobj)
      return
    }

    const result = await userinfo.uploadAvatar(req.params.cid, req.params.mid, req.file)
      .catch((err) => {
        return {
          error: true,
          status: 'Upload S3 error',
        }
      })

    if(result.error) {
      L.aLog.info(JSON.stringify(req.headers))
      L.aLog.info(accessInfo)
      L.eLog.error('failed upload to S3. (' + accessInfo + ')')
    }

    res.send(result)
  })
})

//
// delete avatar image
//
router.delete('/avatar/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/avatar/company/' + req.params.cid + '/member/' + req.params.mid
  L.aLog.debug(accessInfo)

  const result = await userinfo.deleteAvatar(req.params.cid, req.params.mid)
    .catch((err) => {
      return {
        error: true,
        status: 'Delete Avatar error',
      }
    })

  if(result.error) {
    L.aLog.info(JSON.stringify(req.headers))
    L.aLog.info(accessInfo)
    L.eLog.error('failed delete avatar file. (' + accessInfo + ')')
  }

  res.send(result)
})

/*
//
// get calendar key
//
router.get('/calendar/key/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/calendar/key/company/' + req.params.cid + '/member/' + req.params.mid
  L.aLog.debug(accessInfo)

  let result = await userinfo.getCalendarKey(req.params.cid, req.params.mid)
  res.send(result)
})

//
// set calendar key
//
router.post('/calendar/key/company/:cid/member/:mid', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/calendar/key/company/' + req.params.cid + '/member/' + req.params.mid
  L.aLog.debug(accessInfo)
  L.aLog.debug(JSON.stringify(req.body))

  const result = await userinfo.setCalendarKey(req.params.cid, req.params.mid, req.body.calendarKey)
  res.send(result)
})
*/

//
// upload avatar image
//
const _getFileExtention = (filename) => {
  let wk = filename.split('.')
  return wk[wk.length - 1]
}


module.exports = router
