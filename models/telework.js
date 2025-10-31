// requires
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const dbUtil = require('./db-util')

// constant
const TELEWORK_DATA_INITIAL = 0     // テレワークデータ変更有無：変更なし
const TELEWORK_DATA_UPDATED = 1     // テレワークデータ変更有無：変更あり
const TELEWORK_CATEGORY_START = 1   // 勤務種別：勤務開始
const TELEWORK_CATEGORY_LEAVE = 2   // 勤務種別：離席
const TELEWORK_CATEGORY_SEATED = 3  // 勤務種別：着席
const TELEWORK_CATEGORY_END = 4     // 勤務種別：勤務終了
const TELEWORK_CATEGORIZED_HOLIDAY = 90   // 勤務種別：休暇(90番台判定用)
const HOLIDAY_INPUT_DATE = '00000000' // 入力した年月日(休暇情報の場合)
const HOLIDAY_INPUT_HOUR = '0000'     // 入力した時分(休暇情報の場合)

// query strings
let INSERT_TELEWORK_MEMBER_INJ =
  'INSERT INTO iw_workinghourstbl ' +
  '(staff_id, category, input_date, input_hour, insert_date, latitude, longitude, company_id, message,' +
  ' workinghour_id, updated, update_date, linked_date) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,' +
  ' $10, $11, $12, $13)'
let UPDATE_TELEWORK_INPUT_LEAD_INJ =
  'UPDATE iw_usertbl SET ' +
  'input_lead_flg=$2 ' +
  'WHERE user_id=$1'
let UPDATE_TELEWORK_FLG_INJ =
  'UPDATE iw_usertbl SET ' +
  'telework_flg=$2 ' +
  'WHERE user_id=$1'
let UPDATE_LINKED_TELEWORK_INJ =
  'UPDATE iw_usertbl SET ' +
  'linked_wh_flg=$2 ' +
  'WHERE user_id=$1'
let SELECT_TELEWORK_LATEST_INJ =
  'SELECT * ' +
  'FROM iw_workinghourstbl ' +
  'WHERE company_id=$1 AND staff_id=$2 AND input_date <> $3 ' +
  'ORDER BY linked_date desc, input_date desc, input_hour desc LIMIT 4'
let SELECT_TELEWORK_LIST_INJ =
  'SELECT * ' +
  'FROM iw_workinghourstbl ' +
  'WHERE company_id=$1 AND staff_id=$2 AND linked_date like $3 ' +
  'ORDER BY linked_date, input_date, input_hour'
let SELECT_PREV_TELEWORK_DATA_INJ =
  'SELECT * ' +
  'FROM iw_workinghourstbl ' +
  'WHERE company_id=$1 AND staff_id=$2 AND linked_date <= $3 ' +
  'ORDER BY linked_date desc, input_date desc, input_hour desc LIMIT 1'
let SELECT_NEXT_TELEWORK_DATA_INJ =
  'SELECT * ' +
  'FROM iw_workinghourstbl ' +
  'WHERE company_id=$1 AND staff_id=$2 AND linked_date >= $3 ' +
  'ORDER BY linked_date, input_date, input_hour LIMIT 1'
/*let SELECT_TELEWORKING_USER_LIST_INJ =
  'SELECT wh1.staff_id ' +
  'FROM iw_workinghourstbl AS wh1 ' +
  'INNER JOIN (' +
    'SELECT staff_id, MAX(input_date||input_hour) AS maxDate ' +
    'FROM iw_workinghourstbl WHERE company_id=$1 GROUP BY staff_id) AS wh2 ' +
  'ON wh1.staff_id = wh2.staff_id AND (wh1.input_date||wh1.input_hour) = wh2.maxDate ' +
  'WHERE category <> $2'*/
let UPDATE_TELEWORK_INJ =
  'UPDATE iw_workinghourstbl SET ' +
  'input_date=$1, ' +
  'input_hour=$2 ,' +
  'latitude=$3, ' +
  'longitude=$4, ' +
  'message=$5, ' +
  'updated=$6, ' +
  'update_date=$7, ' +
  'category=$8 ' +
  'WHERE workinghour_id=$9'
let DELETE_TELEWORK_INJ =
  'DELETE FROM iw_workinghourstbl ' +
  'WHERE workinghour_id=$1'
let SELECT_SEQ_INJ =
  'SELECT nextval($1) as seq_id'
let SELECT_STAFF_INFO_FROM_WORKINGID_INJ =
  'SELECT company_id, staff_id ' +
  'FROM iw_workinghourstbl ' +
  'WHERE workinghour_id=$1'
let SELECT_TELEWORK_ON_SAME_DATE_INJ =
  'SELECT category, input_date, input_hour ' +
  'FROM iw_workinghourstbl ' +
  'WHERE company_id=$1 AND staff_id=$2 AND linked_date = $3 ' +
  'ORDER BY input_date, input_hour LIMIT 1'

//
// class Telework
//
class Telework {
  // constructor
  constructor() {
    L.sLog.debug('Telework created.')
  }

  //
  // insert telework information(Ver2.2～)
  // ※TeleworkLogダイアログ、テレワーク連動送信ダイアログからの登録
  //
  // @return true: success
  //         false: failed
  async insertTeleworkLog(workinghourId, companyId, payload) {
    const insert_date = hmUtil.formatDate(new Date(), 'YYYY/MM/DD hh:mm:ss.SSS')
    let tmp_date = ''
    if(~payload.date.indexOf('-')) {
      tmp_date = payload.date.replace(/\-/g, '')
    }
    else if(~payload.date.indexOf('.')) {
      // 旧仕様(日付区切り文字「.」)に対応
      tmp_date = payload.date.replace(/\./g, '')
    }
    const input_date = tmp_date
    const input_hour = payload.time.replace(':', '')

    // 直近に入力した勤務データを取得
    const latest_result = await this.selectLatestTeleworkStatusByMember(companyId, payload.staff_id)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        mismatch: false,
        status: 'Unknown error (selectLatestTeleworkStatusByMember)',
      }
    })
    if (latest_result.error) {
      L.eLog.error('Unknown error(selectLatestTeleworkStatusByMember)')
      return latest_result
    }

    // 登録するデータと直近データの整合性チェック(すれ違い考慮)
    let mismatch_flg = 0;
    let linked_date = payload.linked_date
    if ((input_date + input_hour) <= (latest_result.body.input_date + latest_result.body.input_hour)) {
      // 入力日時チェック(登録するデータの方が過去の場合はNG)
      mismatch_flg = 1
    }
    if (latest_result.body.linked_date > linked_date) {
      // 紐づく日付の前後関係チェック(登録するデータの方が過去の場合はNG)
      mismatch_flg = 1
    }
    else {
      switch (latest_result.body.category) {
        case TELEWORK_CATEGORY_START:
          // 直近の勤務種別が「勤務開始」
          if (payload.category === TELEWORK_CATEGORY_START ||
              payload.category === TELEWORK_CATEGORY_SEATED) {
            // 登録するデータの勤務種別が「勤務開始」「着席」
            mismatch_flg = 1
          }
          break
        case TELEWORK_CATEGORY_LEAVE:
          // 直近の勤務種別が「離席」
          if (payload.category === TELEWORK_CATEGORY_START ||
              payload.category === TELEWORK_CATEGORY_LEAVE) {
            // 登録するデータの勤務種別が「勤務開始」「離席」
            mismatch_flg = 1
          }
          break
        case TELEWORK_CATEGORY_SEATED:
          // 直近の勤務種別が「着席」
          if (payload.category === TELEWORK_CATEGORY_START ||
              //payload.category === TELEWORK_CATEGORY_LEAVE ||
              payload.category === TELEWORK_CATEGORY_SEATED) {
            // 登録するデータの勤務種別が「勤務開始」「着席」
            mismatch_flg = 1
          }
          break
        case TELEWORK_CATEGORY_END:
          // 直近の勤務種別が「勤務終了」
          if (payload.category === TELEWORK_CATEGORY_LEAVE ||
              payload.category === TELEWORK_CATEGORY_SEATED ||
              payload.category === TELEWORK_CATEGORY_END) {
            // 登録するデータの勤務種別が「離席」「着席」「勤務終了」
            mismatch_flg = 1
          }
          /*else {
            if (linked_date === latest_result.body.linked_date) {
              // 登録するデータの勤務種別が「勤務開始」で、紐づく年月日が直近と同じ
              mismatch_flg = 1
            }
          }*/
          break
        default:
          break
      }
    }
    if (mismatch_flg === 1) {
      // 不整合
      return {
        error: true,
        mismatch: true,
        status: 'Mismatch',
      }
    }

    const query = INSERT_TELEWORK_MEMBER_INJ
    const params = [
      payload.staff_id,
      payload.category.toString(),
      input_date,
      input_hour,
      insert_date,
      payload.lat,
      payload.lon,
      companyId,
      payload.comment,
      workinghourId,
      payload.updated,
      insert_date,
      linked_date
    ]

    const ins_result = await dbUtil.executeQueryWrite(query, params, 'insertTeleworkLog')
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        mismatch: false,
        status: 'Unknown error (insertTeleworkLog)',
      }
    })
    if (ins_result.error) {
      L.eLog.error('Unknown error(insertTeleworkLog)')
    }
    return ins_result
  }

  //
  // insert telework information(～Ver2.1)
  //
  // @return true: success
  //         false: failed
  async insertTeleworkLogByMember(workinghourId, companyId, payload) {
    const insert_date = hmUtil.formatDate(new Date(), 'YYYY/MM/DD hh:mm:ss.SSS')
    let tmp_date = ''
    if(~payload.date.indexOf('-')) {
      tmp_date = payload.date.replace(/\-/g, '')
    }
    else if(~payload.date.indexOf('.')) {
      // 旧仕様(日付区切り文字「.」)に対応
      tmp_date = payload.date.replace(/\./g, '')
    }
    const input_date = tmp_date
    const input_hour = payload.time.replace(':', '')

    // 旧バージョン対応(～ver2.0)
    // (更新有無フラグ)
    let updated = payload.updated
    if (hmUtil.isNullorUndefined(updated)) {
      updated = TELEWORK_DATA_INITIAL
    }
    // (紐づく年月日)
    let linked_date = payload.linked_date
    if (hmUtil.isNullorUndefined(linked_date)) {
      // 直近に入力した勤務データを取得
      const latest_result = await this.selectLatestTeleworkStatusByMember(companyId, payload.staff_id)
      .catch((err) => {
        return {  // このreturnはresultに代入される
          error: true,
          status: 'Unknown error',
        }
      })
      if (latest_result.error) {
        L.eLog.error('Unknown error(select latest data)')
        return latest_result
      }

      if (payload.category !== TELEWORK_CATEGORY_START &&
          input_date !== latest_result.body.linked_date) {
        // 入力した勤務データの種別が「勤務開始」以外で、
        // 入力した年月日が、直前勤務データの紐づく年月日と一致しない場合(日またぎの勤務データ)

        // 直前の勤務データの紐づけ年月日を設定
        linked_date = latest_result.body.linked_date
      }
      else {
        // 入力した年月日を設定
        linked_date = input_date
      }
    }

    const query = INSERT_TELEWORK_MEMBER_INJ
    const params = [
      payload.staff_id,
      payload.category.toString(),
      input_date,
      input_hour,
      insert_date,
      payload.lat,
      payload.lon,
      companyId,
      payload.comment,
      workinghourId,
      updated,
      insert_date,
      linked_date
    ]

    const ins_result = await dbUtil.executeQueryWrite(query, params, 'insertTeleworkLogByMember')
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        mismatch: false,
        status: 'Unknown error (insertTeleworkLogByMember)',
      }
    })
    if (ins_result.error) {
      L.eLog.error('Unknown error(insertTeleworkLogByMember)')
    }
    return ins_result
  }

  //
  // update telework input lead flg(～Ver2.1)
  //
  // @return true: success
  //         false: failed
  async updateTeleworkInputLeadFlg(userId, inputLead) {
    let inputLeadFlg = 0
    if(inputLead) {
      inputLeadFlg = 1
    }
    const query = UPDATE_TELEWORK_INPUT_LEAD_INJ
    const params = [ userId, inputLeadFlg ]

    return await dbUtil.executeQueryWrite(query, params, 'updateTeleworkInputLeadFlg')
  }

  //
  // update telework flg
  //
  // @return true: success
  //         false: failed
  async updateTeleworkFlg(userId, tekeworkFlg) {
    let updVal = 0
    if(tekeworkFlg) {
      updVal = 1
    }
    const query = UPDATE_TELEWORK_FLG_INJ
    const params = [ userId, updVal ]

    return await dbUtil.executeQueryWrite(query, params, 'updateTeleworkFlg')
  }

  //
  // update linked telework flg
  //
  // @return true: success
  //         false: failed
  async updateLinkedTeleworkFlg(userId, linkedWh) {
    let linkedWhFlg = 0
    if(linkedWh) {
      linkedWhFlg = 1
    }
    const query = UPDATE_LINKED_TELEWORK_INJ
    const params = [ userId, linkedWhFlg ]

    return await dbUtil.executeQueryWrite(query, params, 'updateLinkedTeleworkFlg')
  }

  //
  // select latest telework data by member_id(staff_id) (1data)
  //
  async selectLatestTeleworkStatusByMember(companyId, memberId) {
    const query = SELECT_TELEWORK_LATEST_INJ
    const params = [ companyId, memberId, '00000000' ]

    let result = await dbUtil.executeQueryRead(query, params, 'selectLatestTeleworkStatusByMember')
    if (!result.error && result.body.length !== 0) {
       // 選択されるレコードは1以下のため、配列から選択して返す
      result.body = result.body[0]
    }
    //L.sLog.debug('★[selectLatestTeleworkStatusByMember]' + JSON.stringify(result))
    return result
  }

  //
  // select latest telework list by member_id(staff_id) (max 4data) (Ver2.1～2.2)
  //
  async selectLatestTeleworkStatusListByMember(companyId, memberId) {
    const query = SELECT_TELEWORK_LATEST_INJ
    const params = [ companyId, memberId, '00000000' ]

    let result = await dbUtil.executeQueryRead(query, params, 'selectLatestTeleworkStatusListByMember')
    return result
  }

  //
  // select telework list by member_id(staff_id), date
  //
  async selectTeleworkListByDate(companyId, memberId, date) {
    let disp_date = ''
    if (date === null || date === '') {
      // 表示対象年月が未指定の場合は、現在年月を指定
      disp_date = hmUtil.formatDate(new Date(), 'YYYYMM') + '%'
    }
    else {
      disp_date = date + '%'
    }

    const query = SELECT_TELEWORK_LIST_INJ
    const params = [ companyId, memberId, disp_date ]

    let result = await dbUtil.executeQueryRead(query, params, 'selectTeleworkDataByDate')
    return result
  }

  async selectPrevTeleworkData(companyId, memberId, date) {
    let disp_date = ''
    if (date === null || date === '') {
      // 表示対象年月が未指定の場合は、現在年月の前月月末日を取得
      disp_date = hmUtil.calcDate(hmUtil.formatDate(new Date(), 'YYYYMM') + '01', -1)
    }
    else {
      // 表示対象年月が指定ありの場合は、指定年月の前月月末日を取得
      disp_date = hmUtil.calcDate(date + '01', -1)
    }

    const query = SELECT_PREV_TELEWORK_DATA_INJ
    const params = [ companyId, memberId, disp_date ]

    let result = await dbUtil.executeQueryRead(query, params, 'selectPrevTeleworkData')
    return result
  }

  async selectNextTeleworkData(companyId, memberId, date) {
    let disp_date = ''
    if (date === null || date === '') {
      // 表示対象年月が未指定の場合は、現在年月の翌月を取得
      disp_date = hmUtil.calcMonth(hmUtil.formatDate(new Date(), 'YYYYMM') + '01', 1)
    }
    else {
      // 表示対象年月が指定ありの場合は、指定年月の翌月を取得
      disp_date = hmUtil.calcMonth(date + '01', 1)
    }

    const query = SELECT_NEXT_TELEWORK_DATA_INJ
    const params = [ companyId, memberId, disp_date ]

    let result = await dbUtil.executeQueryRead(query, params, 'selectNextTeleworkData')
    return result
  }

  //
  // select telework start user list
  //
  /*async selectTeleworkingUserList(companyId) {
    const query = SELECT_TELEWORKING_USER_LIST_INJ
    const params = [ companyId, TELEWORK_CATEGORY_END ]

    let result = await dbUtil.executeQueryRead(query, params, 'selectTeleworkingUserList')
    return result
  }*/

  //
  // insert telework information
  // ※テレワーク編集画面からの登録
  //
  // @return true: success
  //         false: failed
  async insertTeleworkLogForEdit(workinghourId, companyId, payload) {
    const insert_date = hmUtil.formatDate(new Date(), 'YYYY/MM/DD hh:mm:ss.SSS')
    let tmp_date = ''
    if(~payload.date.indexOf('-')) {
      tmp_date = payload.date.replace(/\-/g, '')
    }
    else if(~payload.date.indexOf('.')) {
      // 旧仕様(日付区切り文字「.」)に対応
      tmp_date = payload.date.replace(/\./g, '')
    }
    const input_date = tmp_date
    const input_hour = payload.time.replace(':', '')

    const query = INSERT_TELEWORK_MEMBER_INJ
    const params = [
      payload.staff_id,
      payload.category.toString(),
      input_date,
      input_hour,
      insert_date,
      payload.lat,
      payload.lon,
      companyId,
      payload.comment,
      workinghourId,
      payload.updated,
      insert_date,
      payload.linked_date
    ]

    const ins_result = await dbUtil.executeQueryWrite(query, params, 'insertTeleworkLogForEdit')
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        mismatch: false,
        status: 'Unknown error (insertTeleworkLogForEdit)',
      }
    })
    if (ins_result.error) {
      L.eLog.error('Unknown error(insertTeleworkLogForEdit)')
      return ins_result
    }

    // 最も新しい勤務データを取得
    const latest_result = await this.selectLatestTeleworkStatusByMember(companyId, payload.staff_id)
    .catch((err) => {
      return {  // このreturnはresultに代入される
        error: true,
        mismatch: false,
        status: 'Unknown error (selectLatestTeleworkStatusByMember)',
      }
    })
    if (latest_result.error) {
      L.eLog.error('Unknown error(selectLatestTeleworkStatusByMember)')
      return latest_result
    }
    ins_result.body = {
      latest_wh_category: latest_result.body.category
    }

    return ins_result
  }

  //
  // update telework information
  //
  // @return true: success
  //         false: failed
  async updateTeleworkLogByWorkinghourId(payload) {
    // テレワークデータ更新
    const update_date = hmUtil.formatDate(new Date(), 'YYYY/MM/DD hh:mm:ss.SSS')
    let tmp_date = ''
    if(~payload.date.indexOf('-')) {
      tmp_date = payload.date.replace(/\-/g, '')
    }
    else if(~payload.date.indexOf('.')) {
      // 旧仕様(日付区切り文字「.」)に対応
      tmp_date = payload.date.replace(/\./g, '')
    }
    const input_date = tmp_date
    const input_hour = payload.time.replace(':', '')

    const upd_query = UPDATE_TELEWORK_INJ
    const upd_params = [
      input_date,
      input_hour,
      payload.lat,
      payload.lon,
      payload.comment,
      TELEWORK_DATA_UPDATED,      // 変更有無：1(変更あり)
      update_date,
      payload.category,
      payload.workinghour_id
    ]

    return await dbUtil.executeQueryWrite(upd_query, upd_params, 'updateTeleworkLogByWorkinghourId')
  }

  //
  // delete telework information
  //
  // @return true: success
  //         false: failed
  async deleteTeleworkLogByWorkinghourId(workinghour_id) {
    // working_idからユーザ情報取得
    let query = SELECT_STAFF_INFO_FROM_WORKINGID_INJ
    let params = [workinghour_id]
    let staff_info = await dbUtil.executeQueryRead(query, params, 'selectStaffInfoFromWorkingId')
      .catch((err) => {
        return {  // このreturnはresultに代入される
          error: true,
          mismatch: false,
          status: 'Unknown error (select delete data)',
        }
      })
    if (staff_info.error) {
      L.eLog.error('Unknown error(select delete data)')
      return staff_info
    }

    // テレワークデータ削除
    query = DELETE_TELEWORK_INJ
    params = [workinghour_id]
    const del_result = await dbUtil.executeQueryWrite(query, params, 'deleteleworkLogByWorkinghourId')

    // 最も新しい勤務データを取得
    if (del_result.body !== 0) {
      const latest_result = await this.selectLatestTeleworkStatusByMember(staff_info.body[0].company_id, staff_info.body[0].staff_id)
      .catch((err) => {
        return {  // このreturnはresultに代入される
          error: true,
          mismatch: false,
          status: 'Unknown error (selectLatestTeleworkStatusByMember)',
        }
      })
      if (latest_result.error) {
        L.eLog.error('Unknown error(select latest data)')
        return latest_result
      }

      del_result.body = {
        latest_wh_category: latest_result.body.category
      }
    }
    return del_result
  }

  //
  // check telework log on same day (休暇情報登録時チェック用)
  //
  async checkTeleworkLogSameDate(data) {
    L.aLog.debug('★[checkTeleworkLogSameDate] start')
    const query = SELECT_TELEWORK_ON_SAME_DATE_INJ
    const params = [ data.company_id, data.staff_id, data.linked_date ]
    let result = await dbUtil.executeQueryRead(query, params, 'checkTeleworkLogSameDate')
    if (!result.error && result.body.length !== 0) {
      L.aLog.debug('★  検索結果[' + JSON.stringify(result.body) + ']')
      // 同日の勤怠情報が存在
      L.aLog.debug('★  →同日データあり')
      return false
    }
    L.aLog.debug('★  →同日データなし')
    return true
  }

    //
  // check holiday on same day (勤怠情報登録時チェック用)
  //
  async checkHolidaySameDate(company_id, data) {
    L.aLog.debug('★[checkHolidaySameDate] start')
    const query = SELECT_TELEWORK_ON_SAME_DATE_INJ
    const params = [ company_id, data.staff_id, data.linked_date ]
    let result = await dbUtil.executeQueryRead(query, params, 'checkHolidaySameDate')
    if (!result.error && result.body.length !== 0) {
      L.aLog.debug('★  検索結果[' + JSON.stringify(result.body) + ']')
      if (result.body[0].category > TELEWORK_CATEGORIZED_HOLIDAY) {
        // 同日に登録済みの休暇情報が存在する(勤務開始/離席/着席/終了は登録可)
        L.aLog.debug('★  →同日データあり')
        return false
      }
    }
    L.aLog.debug('★  →同日データなし')
    return true
  }
 
  //
  // insert holiday info
  //
  // @return true: success
  //         false: failed
  async insertHolidayInfo(workinghourId, payload) {
    const insert_date = hmUtil.formatDate(new Date(), 'YYYY/MM/DD hh:mm:ss.SSS')
    let tmp_date = ''
    if(~payload.date.indexOf('-')) {
      tmp_date = payload.date.replace(/\-/g, '')
    }

    const query = INSERT_TELEWORK_MEMBER_INJ
    const params = [
      payload.staff_id,
      payload.category,
      HOLIDAY_INPUT_DATE,
      HOLIDAY_INPUT_HOUR,
      insert_date,
      '',
      '',
      payload.company_id,
      payload.comment,
      workinghourId,
      payload.updated,
      insert_date,
      payload.linked_date
    ]

    return await dbUtil.executeQueryWrite(query, params, 'insertHolidayInfo')
  }

  //
  // update holiday info
  //
  // @return true: success
  //         false: failed
  async updateHolidayInfo(payload) {
    const update_date = hmUtil.formatDate(new Date(), 'YYYY/MM/DD hh:mm:ss.SSS')
    let tmp_date = ''
    if(~payload.date.indexOf('-')) {
      tmp_date = payload.date.replace(/\-/g, '')
    }

    const upd_query = UPDATE_TELEWORK_INJ
    const upd_params = [
      HOLIDAY_INPUT_DATE,
      HOLIDAY_INPUT_HOUR,
      '',
      '',
      payload.comment,
      TELEWORK_DATA_UPDATED,      // 変更有無：1(変更あり)
      update_date,
      payload.category,
      payload.workinghour_id
    ]

    return await dbUtil.executeQueryWrite(upd_query, upd_params, 'updateHolidayInfo')
  }

  //
  // delete holiday info
  //
  // @return true: success
  //         false: failed
  async deleteHolidayInfo(workinghour_id) {
    const query = DELETE_TELEWORK_INJ
    const params = [workinghour_id]
    return await dbUtil.executeQueryWrite(query, params, 'deleteHolidayInfo')
  }

  //
  // get telework sequence id
  //
  // @return id (4 bytes)
  //         null : failed
  async getTeleworkSeq() {
    const seq_query = SELECT_SEQ_INJ
    const seq_params = ['iw_workinghours_seq']
    let result = await dbUtil.executeQueryRead(seq_query, seq_params, 'selectWorkingHoursSeq')
    if (result.error || result.body.length === 0) {
      return null
    }
    return result.body[0].seq_id
  }
}

module.exports = new Telework

