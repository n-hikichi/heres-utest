
const L = require('../util/logger-wrapper')
const dbUtil = require('./db-util')

let SELECT_PLACE_LIST_INJ =
  'SELECT * FROM iw_disttbl ' +
  'WHERE company_id=$1 ORDER BY dist_id'


class PlaceList {
  constructor() {
    L.sLog.debug('PlaceList created.')
  }

  async getPlaceList(companyId) {
    const query = SELECT_PLACE_LIST_INJ
    const params = [ companyId ]

    return await dbUtil.executeQueryRead(query, params, 'getPlaceList')
  }

}


module.exports = new PlaceList
