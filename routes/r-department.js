// requires
const express = require('express');
const router = express.Router();
const L = require('../util/logger-wrapper')
const apiAuth = require('../models/api-auth')
const department = require('../models/department')

const ROUTE = '/departments'

// use authentication
router.use(apiAuth.verifyToken)

//
// get sections by company id
//
router.get('/company/:id/section', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id +
    '/section'
  L.aLog.debug(accessInfo)

  const result = await department.getSectionList(req.params.id)
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
// get groups by company id
//
router.get('/company/:id/group', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id +
    '/group'
  L.aLog.debug(accessInfo)

  const result = await department.getGroupList(req.params.id)
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
// get class by company id
//
router.get('/company/:id/class', async (req, res, next) => {
  let accessInfo =
    req.method + ' ' + ROUTE +
    '/company/' + req.params.id +
    '/class'
  L.aLog.debug(accessInfo)

  const result = await department.getClassList(req.params.id)
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
