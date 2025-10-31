
const L = require('../util/logger-wrapper')
const dbUtil = require('./db-util')

let SELECT_PRESENCE_STATUS_LIST_INJ =
  'SELECT * FROM iw_statetbl ' +
  'WHERE company_id=$1 ORDER BY state_id'


//
// class PresenceStatus
//
class PresenceStatus {
  constructor() {
    L.sLog.debug('PresenceStatus created.')
  }

  async getPresenceStatusList(companyId) {
    const query = SELECT_PRESENCE_STATUS_LIST_INJ
    const params = [ companyId ]

    return await dbUtil.executeQueryRead(query, params, 'getPresenceStatusList')
  }

}


module.exports = new PresenceStatus

