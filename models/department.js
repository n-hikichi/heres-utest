// requires
const L = require('../util/logger-wrapper')
const dbUtil = require('./db-util')

// query strings
let SELECT_SECTION_INJ =
  'SELECT * FROM iw_sectiontbl ' +
  'WHERE company_id=$1 ' +
  'ORDER BY section_id, vieworder'
let SELECT_GROUP_INJ =
  'SELECT * FROM iw_grouptbl ' +
  'WHERE company_id=$1 ORDER BY group_id, vieworder'
let SELECT_CLASS_INJ =
  'SELECT * FROM iw_classtbl ' +
  'WHERE company_id=$1 ORDER BY class_id'

//
// class Departments
//
class Department {
  // constructor
  constructor() {
    L.sLog.debug('Department created.')
  }

  //
  // get section list
  //
  async getSectionList(companyId) {
    const query = SELECT_SECTION_INJ
    const params = [ companyId ]

    return await dbUtil.executeQueryRead(query, params, 'getSectionList')
  }

  //
  // get group list
  //
  async getGroupList(companyId) {
    const query = SELECT_GROUP_INJ
    const params = [ companyId ]

    return await dbUtil.executeQueryRead(query, params, 'getGroupList')
  }

  //
  // get class list
  //
  async getClassList(companyId) {
    const query = SELECT_CLASS_INJ
    const params = [ companyId ]

    return await dbUtil.executeQueryRead(query, params, 'getClassList')
  }

}


module.exports = new Department
