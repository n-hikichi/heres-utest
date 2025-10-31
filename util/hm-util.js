const moment = require('moment')
const range_check = require('range_check')
const { sLog } = require('../util/logger-wrapper')
const L = require('../util/logger-wrapper')
const dbUtil = require('../models/db-util')
const CLI_VER_LIST = ['2.6.3', '2.7.0', '3.0.0']
class HmUtil {
  //
  // isNullorUndefined
  //
  isNullorUndefined (value) {
    return (value === undefined || value === null)
  }

  //
  // isNullorUndefinedStr
  //
  isNullorUndefinedStr (value) {
    return (value === 'undefined' || value === 'null')
  }

  //
  // format date
  //
  formatDate (date, format) {
    if (!format) format = 'YYYY-MM-DD hh:mm:ss'

    format = format.replace(/YYYY/g, date.getFullYear())
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2))
    format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2))
    format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2))
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2))
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2))
    if (format.match(/S/g)) {
      let milliSeconds = ('00' + date.getMilliseconds()).slice(-3)
      let length = format.match(/S/g).length
      for (var i = 0; i < length; i++) {
        format = format.replace(/S/, milliSeconds.substring(i, i + 1))
      }
    }

    return format
  }

  //
  // Calculate month
  // [IN]  month : YYYYMMDD形式
  //       num   : 加算値
  // [OUT] YYYYMMDD形式
  calcMonth (month, num) {
    let tmp_date = ''
    if (num > 0) {
      tmp_date = moment(month, 'YYYYMMDD').add(num, 'M').format('YYYYMMDD')
    }
    else {
      tmp_date = moment(month, 'YYYYMMDD').subtract(-num, 'M').format('YYYYMMDD')
    }
    return tmp_date
  }

  //
  // Calculate date
  // [IN]  date  : YYYYMMDD形式
  //       num   : 加算値
  // [OUT] YYYYMMDD形式
  calcDate (date, num) {
    let tmp_date = ''
    if (num > 0) {
      tmp_date = moment(date, 'YYYYMMDD').add(num, 'd').format('YYYYMMDD')
    }
    else {
      tmp_date = moment(date, 'YYYYMMDD').subtract(-num, 'd').format('YYYYMMDD')
    }
    return tmp_date
  }

  //
  // Calculate hour
  // [IN]  datetime  : YYYYMMDDhhmm形式
  //       num       : 加算値(0～23)
  // [OUT] YYYYMMDDhhmm形式
  calcHour (date, num) {
    let tmp_date = ''
    if (num > 0) {
      tmp_date = moment(date, 'YYYYMMDDHHmm').add(num, 'h').format('YYYYMMDDHHmm')
    }
    else {
      tmp_date = moment(date, 'YYYYMMDDHHmm').subtract(-num, 'h').format('YYYYMMDDHHmm')
    }
    return tmp_date
  }

  //
  // check client version
  // [IN]  version  : クライアントのバージョン番号
  // [OUT] チェック結果(true/false)
  checkCliVersion (version) {
    return (CLI_VER_LIST.indexOf(version) !== -1)
  }

  //
  // get ip address form request
  // [IN]  req  : リクエスト情報
  // [OUT] 取得したIPアドレス(空文字の場合は取得失敗)
  getIpAddressFromReqHeader (req) {
    let ip = ''
    const envType = dbUtil.getEnvironmentType()
    L.sLog.debug('IPアドレス取得 環境(' + envType + ')')
    if(envType === 1) {
      // 検証or本番環境の場合、リクエスト情報からIPアドレスを取得
      let req_ip_str = ''
      if (req.headers['x-forwarded-for']) {
        req_ip_str = req.headers['x-forwarded-for']
      }
      else if (req.socket && req.socket.remoteAddress) {
        req_ip_str = req.socket.remoteAddress
      }

      if (req_ip_str !== '') {
        let pos = req_ip_str.indexOf(',')
        if(pos >= 0) {
          ip = req_ip_str.substring(0, pos)
        }
      }
    }
    else {
      // y.jin local環境
      ip = '14.9.148.97'
    }
    return ip
  }

  //
  // check ip address included in list
  // [IN]  req_ip  : チェック対象のIPアドレス
  //       ip_list : IPアドレスリスト(「IPアドレス_名称」の形式)
  // [OUT] チェック結果(true : 含まれる、false : 含まれない)
  checkIpAddressIncludedList (req_ip, ip_list) {
    let check_ret = false
    for (let ip_data of ip_list) {
      L.sLog.debug('IPアドレスチェック 許可IP(' + ip_data + ')')
      let pos = ip_data.indexOf('_')
      let range = ip_data.substring(0, pos)

      // ワイルドカード(*)を含む場合、CIDR表記に変換
      let conv_range = ''
      if (range.indexOf('*') >= 0) {
        const range_array = range.split('.')
        let cidr = 32
        for (let i=0; i<range_array.length; i++) {
          if (i > 0) {
            conv_range += '.'
          }
          if (range_array[i] !== '*') {
            conv_range += range_array[i]
            continue
          }
          cidr -= 8
          conv_range += '0'    // *を0に置き換える
        }
        if(cidr < 32) {
          // CIDRが算出されている場合(*が１つ以上ある)
          conv_range += "/" + cidr;
        }
        L.sLog.debug('  「*」をCIDR表記に変換(' + conv_range + ')')
      }
      else {
        conv_range = range
      }

      check_ret = range_check.inRange(req_ip, conv_range)
      if (check_ret) {
        // IPアドレスがリストに含まれる
        break
      }
    }
    return check_ret
  }
}

module.exports = new HmUtil
