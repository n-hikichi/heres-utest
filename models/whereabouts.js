// requires
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const dbUtil = require('./db-util')

// query strings
let SELECT_WHEREABOUTS_COMPANY_INJ =
  'SELECT mt.*, ut.name_phonetic, ut.telework_flg, ut.attendance_flg, ut.vieworder FROM iw_maintbl mt, iw_usertbl ut ' +
  'WHERE mt.company_id=$1 AND mt.user_id=ut.user_id ' +
  'ORDER BY ut.vieworder'
let SELECT_WHEREABOUTS_MEMBER_INJ =
  'SELECT mt.*, ut.name_phonetic, ut.telework_flg, ut.attendance_flg FROM iw_maintbl mt, iw_usertbl ut ' +
  'WHERE mt.company_id=$1 AND mt.user_id=$2 AND mt.user_id=ut.user_id'
let SELECT_WHEREABOUTS_SECTION_INJ =
  'SELECT mt.*, ut.name_phonetic, ut.telework_flg, ut.attendance_flg, ut.vieworder FROM iw_maintbl mt, iw_usertbl ut ' +
  'WHERE mt.user_id IN (' +
    'SELECT ut.user_id FROM iw_usertbl ut ' +
    'WHERE company_id=$1 AND section=$2 ' +
    ') ' +
    'AND mt.user_id=ut.user_id ' +
  'ORDER BY ut.vieworder'
let SELECT_WHEREABOUTS_GROUP_INJ =
  'SELECT mt.*, ut.name_phonetic, ut.telework_flg, ut.attendance_flg, ut.vieworder FROM iw_maintbl mt, iw_usertbl ut ' +
  'WHERE mt.user_id IN (' +
    'SELECT ut.user_id FROM iw_usertbl ut ' +
    'WHERE company_id=$1 AND group_id=$2 ' +
    ') ' +
    'AND mt.user_id=ut.user_id ' +
  'ORDER BY ut.vieworder'
let UPDATE_WHEREABOUTS_MEMBER_INJ =
  'UPDATE iw_maintbl ' +
  'SET state=$1, dist=$2, comment=$3, ret_date=$4, ret_time=$5, move_direct=$6, update_date=$7 ' +
  'WHERE company_id=$8 AND user_id=$9'

//
// class Whereabouts
//
class Whereabouts {
  // constructor
  constructor() {
    L.sLog.debug('Whereabouts created.')
  }

  //
  // get whereabouts information by member
  //
  async getWhereaboutsByMember(companyId, memberId) {
    const query = SELECT_WHEREABOUTS_MEMBER_INJ
    const params = [
      companyId,
      memberId,
    ]

    let result = await dbUtil.executeQueryRead(query, params, 'getWhereaboutsByMember')
    if (!result.error && result.body.length !== 0) {
      result.body = result.body[0]
    }
    return result
  }

  //
  // get whereabouts informations by company
  //
  async getWhereaboutsByCompany(companyId) {
    const query = SELECT_WHEREABOUTS_COMPANY_INJ
    const params = [ companyId ]

    let result = await dbUtil.executeQueryRead(query, params, 'getWhereaboutsByCompany')
    //L.sLog.debug(JSON.stringify(result.body))
    return result
  }

  //
  // get whereabouts information by section
  //
  async getWhereaboutsBySection(companyId, sectionId) {
    const query = SELECT_WHEREABOUTS_SECTION_INJ
    const params = [
      companyId,
      sectionId,
    ]

    return await dbUtil.executeQueryRead(query, params, 'getWhereaboutsBySection')
  }

  //
  // get whereabouts information by group
  //
  //async getWhereaboutsByGroup(companyId, sectionId, groupId, callback) {
  async getWhereaboutsByGroup(companyId, groupId) {
    const query = SELECT_WHEREABOUTS_GROUP_INJ
    const params = [
      companyId,
      groupId,
    ]

    return await dbUtil.executeQueryRead(query, params, 'getWhereaboutsByGroup')
  }

  //
  // update whereabouts information by member
  //
  async updateWhereaboutsByMember(companyId, payload) {
    //const update_date = hmUtil.formatDate(new Date(), 'YYYY/MM/DD hh:mm:ss.SSS')
    const update_date = new Date()
    const query = UPDATE_WHEREABOUTS_MEMBER_INJ
    const ret_date = (payload.ret_date !== '-') ? (payload.ret_date) : null
    const ret_time = (payload.ret_time !== '-') ? (payload.ret_time) : null
    const params = [
      payload.state.toString(),
      payload.dist.toString(),
      payload.comment,
      ret_date,
      ret_time,
      payload.move_direct,
      update_date,
      companyId,
      payload.user_id,
    ]
    const result = await dbUtil.executeQueryWrite(query, params, 'updateWhereaboutsByMember')
    result.update_date = update_date
    return result
  }

}


module.exports = new Whereabouts
