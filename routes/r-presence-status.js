
const express = require('express');
const router = express.Router();
const presenceStatusList = require('../models/presence-status')
const L = require('../util/logger-wrapper')

const ROUTE = '/presencestatus'

router.get('/company/:id', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id
  L.aLog.debug(accessInfo)

  const result = await presenceStatusList.getPresenceStatusList(req.params.id)
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


module.exports = router
