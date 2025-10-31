// requires
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const dbUtil = require('./db-util')

// query strings
let UPDATE_GEOLOCATION_MEMBER_INJ =
  'UPDATE iw_locatetbl SET ' +
  'latitude=$1, longitude=$2, message=$3, send_time=$4 ' +
  'WHERE company_id=$5 and staff_id=$6'
let UPSERT_GEOLOCATION_MEMBER_INJ =
  'INSERT INTO iw_locatetbl (latitude, longitude, message, send_time, company_id, staff_id) ' +
  'VALUES ($1, $2, $3, $4, $5, $6) ' +
  'ON CONFLICT ON CONSTRAINT iw_locatetbl_pkey ' +
  'DO UPDATE SET latitude=$1, longitude=$2, message=$3, send_time=$4'
let SELECT_GELOCATION_MEMBER_INJ =
  'SELECT * FROM iw_locatetbl ' +
  'WHERE company_id=$1 AND staff_id=$2'
let SELECT_GELOCATION_COMPANY_INJ =
  'SELECT * FROM iw_locatetbl ' +
  'WHERE company_id=$1'
let SELECT_GELOCATION_SECTION_INJ =
  'SELECT * FROM iw_locatetbl ' +
  'WHERE company_id=$1 AND staff_id IN (' +
    'SELECT staff_id FROM iw_usertbl ' +
    'WHERE company_id=$2 AND section=$3 ' +
    'ORDER BY class, user_id' +
    ')'
let SELECT_GELOCATION_GROUP_INJ =
  'SELECT * FROM iw_locatetbl ' +
  'WHERE company_id=$1 AND staff_id IN (' +
    'SELECT staff_id FROM iw_usertbl ' +
    'WHERE company_id=$2 AND group_id=$3 ' +
    'ORDER BY class, user_id' +
    ')'

//
// class Geolocation
//
class Geolocation {
  // constructor
  constructor() {
    L.sLog.debug('Geolocation created.')
  }

  //
  // update geolocation
  //
  async updateGeolocationByMember(companyId, memberId, payload) {
    let lat = ''
    let lon = ''
    if (!hmUtil.isNullorUndefined(payload.lat)) {
      lat = payload.lat.toString()
    }
    if (!hmUtil.isNullorUndefined(payload.lon)) {
      lon = payload.lon.toString()
    }

    //const query = UPDATE_GEOLOCATION_MEMBER_INJ
    const query = UPSERT_GEOLOCATION_MEMBER_INJ
    const params = [
      lat,
      lon,
      payload.msg,
      payload.send_time,
      companyId,
      memberId,
    ]

    return await dbUtil.executeQueryWrite(query, params, 'updateGeolocationByMember')
  }

  //
  // get geolocation by member
  //
  async getGeolocationByMember(companyId, memberId, callback) {
    const query = SELECT_GELOCATION_MEMBER_INJ
    const params = [
      companyId,
      memberId,
    ]

    return await dbUtil.executeQueryRead(query, params, 'getGeolocationByMember')
  }

  //
  // get geolocation by company
  //
  async getGeolocationByCompany(companyId) {
    const query = SELECT_GELOCATION_COMPANY_INJ
    const params = [
      companyId,
    ]

    return await dbUtil.executeQueryRead(query, params, 'getGeolocationByCompany')
  }

  //
  // get geolocation by section
  //
  async getGeolocationBySection(companyId, sectionId) {
    const query = SELECT_GELOCATION_SECTION_INJ
    const params = [
      companyId,
      companyId,
      sectionId,
    ]

    return await dbUtil.executeQueryRead(query, params, 'getGeolocationBySection')
  }

  //
  // get geolocation by group
  //
  async getGeolocationByGroup(companyId, groupId) {
    const query = SELECT_GELOCATION_GROUP_INJ
    const params = [
      companyId,
      companyId,
      sectionId,
    ]

    return await dbUtil.executeQueryRead(query, params, 'getGeolocationByGroup')
  }

}


module.exports = new Geolocation
