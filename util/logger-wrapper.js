'use strict';

let log4js = require('log4js')

log4js.configure(__dirname + '/../config/log4js-config.json')

const aLogger = log4js.getLogger('access')
const sLogger = log4js.getLogger('system')
const eLogger = log4js.getLogger('error')

module.exports = {
  aLog: aLogger,
  sLog: sLogger,
  eLog: eLogger,
}

