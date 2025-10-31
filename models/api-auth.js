// requires
const jwt = require('jsonwebtoken')
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const authConfig = require('../config/auth-config')

const EXPIRES = 60 * 60 * 24 * 5  // 5days

class ApiAuth {
  // constructor
  constructor() {
    L.sLog.debug('ApiAuth created.')
  }

  //
  // generate token
  //
  generateToken(accountId) {
    if (accountId === undefined) {
      return null
    }

    const user = { id: accountId }
    let token = jwt.sign(user, authConfig.secretkey, { expiresIn: EXPIRES })

    return token
  }

  //
  // verify token on login
  //
  verifyTokenOnLogin(accountId, token) {
    L.sLog.debug(`verify token on login ${accountId} : ${token}`)

    try {
      let decoded = jwt.verify(token, authConfig.secretkey)
      if (accountId === decoded.id) {
        L.sLog.debug('token verified : ' + decoded.id)
        return true
      }
      else {
        L.sLog.warn('account id mismatched : ' + decoded.id)
        return false
      }
    }
    catch(err) {
      L.eLog.error('verify token error')
      return false
    }
  }

  //
  // verify token debug
  //
  async verifyToken (req, res, next) {
    //L.sLog.debug(JSON.stringify(req.headers))

    // デバッグ中は無条件でOKとする
    //next()

    // tokenがない場合は、bad request扱いにする
    if (hmUtil.isNullorUndefined(req.headers.authorization)) {
      L.aLog.info(JSON.stringify(req.headers))
      L.eLog.error('no authorization in header.')
      res.sendStatus(400)
      return
    }

    // token抽出
    let token = req.headers.authorization.split(' ')[1]
    if (hmUtil.isNullorUndefined(token) || hmUtil.isNullorUndefinedStr(token)) {
      L.aLog.info(JSON.stringify(req.headers))
      L.eLog.error('no token in request.')
      res.sendStatus(400)
      return
    }

    try {
      let decoded = jwt.verify(token, authConfig.secretkey)
      // @Todo 存在するアカウントかチェックする
      L.sLog.debug('token verified : ' + decoded.id)
      next()
    }
    catch(err) {
      L.eLog.error('verify token error : ' + token)
      res.sendStatus(401)
      return
    }
  }

  //
  // verify token for reissue
  //
  verifyTokenForReissue(accountId, token) {
    L.sLog.debug(`verify token for reissue token ${accountId} : ${token}`)

    let decoded = jwt.decode(token)
    if (accountId === decoded.id) {
      L.sLog.debug('token verified : ' + decoded.id)
      return true
    }
    else {
      L.sLog.warn('account id mismatched : ' + decoded.id)
      return false
    }
  }

  //
  // verify token
  //
  // remark router.use()で使用する場合は、thisがこのクラスを指さないので、本関数をprivate methodとしては使えない
  _verifyToken (token) {
    if (token === null) {
      return false
    }

    try {
      let decoded = jwt.verify(token, authConfig.secretkey)
      // @Todo 存在するアカウントかチェックする
      L.sLog.debug('token verified : ' + decoded.id)
      return true
    }
    catch(err) {
      L.eLog.error('verify token error')
      return false
    }
  }
}


module.exports = new ApiAuth

