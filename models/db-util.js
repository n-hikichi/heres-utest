
const { Pool, Client } = require('pg')
const AWS = require('aws-sdk')
const ssm = new AWS.SSM({'region': 'ap-northeast-1'});
//const db_config = require('../config/db-config')
const L = require('../util/logger-wrapper')
const hmUtil = require('../util/hm-util')
const environmentType = 0   // 環境(0:localhost、1:検証or本番)
let db_config = null

class DbUtil {
  // constructor
  constructor() {
    if (db_config !== null) {
      // 接続情報取得済み
      return
    }
    this.getConnectionInfoFromAWS()
    L.sLog.debug('db_config : ' + JSON.stringify(db_config))
  }

  async getConnectionInfoFromAWS() {
    if (environmentType === 0) {
      // localhost用
      db_config = {
        host: 'localhost',
        user: 'imhereadmin',
        password: 'admin555',
        database: "imhere",
        port: "5432"
      }
      return
    }

    var params = {
      Name: 'heresme.db_auth_info',
      WithDecryption: true
    }
    ssm.getParameter(params, (err, data) => {
      if (err) {
        L.eLog.error('failed to get db connection info. (' + err + ')')
      }
      else {
        L.sLog.debug('get db connection info succeeded.')
        L.sLog.debug(data)

        // DB接続情報作成
        let dbAuthInfo = data.Parameter.Value.split(',')
        db_config = {
          host: dbAuthInfo[0],
          user: dbAuthInfo[1],
          password: dbAuthInfo[2],
          database: "imhere",
          port: "5432"
        }
      }
    })
  }

  //
  // execute sql query
  //
  // @param query sql query
  //
  async executeQuery(query) {
    if (db_config === null) {
      L.sLog.warn('get DB connection info again.')
      let ret = this.getConnectionInfoFromAWS()
    }
    const pool = new Pool(db_config)

    L.sLog.debug(`query : '${query}'`)

    const res = await pool.query(query)
      .catch((err) => {
        L.eLog.error(err.stack)
        // このreturnは関数のreturnではない
        return { error: true, body: { rows: [] } }
      })

    await pool.end()

    return res.error ? res : { error: false, body: res }
  }

  //
  // execute sql query and create response
  //
  // @param query sql query
  //
  async executeQueryRead(query, params, funcName) {
    const result = await this.executeQueryInjection(query, params)
      .catch((err) => {
        L.eLog.error(`SQL query error on ${funcName}`)
        L.eLog.error(err)
        return {
          error: true,
        }
      })

    if (result.error) {
      return {
        error: true,
        status: 'SQL query error',
      }
    }

    if (result.body.rows.length === 0) {
      L.sLog.warn('SQL query result rows is empty')
    }
    else {
      L.sLog.debug(`SQL query count : ${result.body.rows.length}`)
    }

    return {
      error: false,
      status: 'OK',
      body: result.body.rows,
    }
  }

  //
  // execute sql query and create response
  //
  // @param query sql query
  //
  async executeQueryWrite(query, params, funcName) {
    const result = await this.executeQueryInjection(query, params)
      .catch((err) => {
        L.eLog.error(`SQL query error on ${funcName}`)
        L.eLog.error(err)
        return {
          error: true,
        }
      })

    if (result.error) {
      return {
        error: true,
        status: 'SQL query error',
      }
    }

    if (result.body.rows.length === 0) {
      L.sLog.warn('SQL query result rows is empty')
    }

    return {
      error: false,
      status: 'OK',
      body: result.body.rowCount,
    }
  }

  //
  // get pool
  //
  beginPool() {
    return new Pool(db_config)
  }

  //
  // remove pool
  //
  async endPool(pool) {
    await pool.end()
  }
  /*
  //
  // execute sql query and create response
  //
  // @param query sql query
  //
  async executeQueryWriteTransaction(query, params, funcName) {
    const pool = new Pool(db_config)

    (async () => {
      // note: we don't try/catch this because if connecting throws an exception
      // we don't need to dispose of the client (it will be undefined)
      const client = await pool.connect()

      try {
        await client.query('BEGIN')
        const { rows } = await client.query(query, params)
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    })()
      .catch((err) => {
        L.eLog.error(`SQL query error on ${funcName} on transaction`)
        L.eLog.error(err.stack)
      })

  }
  */

  //
  // execute sql query
  //
  // @param query sql query
  //
  async executeQueryInjection(query, params) {
    if (db_config === null) {
      L.sLog.warn('get DB connection info again.')
      let ret = this.getConnectionInfoFromAWS()
    }
    const pool = new Pool(db_config)
    L.sLog.debug(`pool created : ${JSON.stringify(pool)}`)

    L.sLog.debug(`!query : ${query} [ ${params} ]`)

    const res = await pool.query(query, params)
      .catch((err) => {
        L.eLog.error(err.stack)
        // このreturnは関数のreturnではない
        return { error: true, body: { rows: [] } }
      })

    await pool.end()

    //L.sLog.debug(`[query result] count: ${res.rowCount} rows: ${JSON.stringify(res.rows)}`)

    return res.error ? res : { error: false, body: res }
  }

  //
  // escape single quotation
  //
  escapeSingleQuote(str) {
    if (hmUtil.isNullorUndefined(str) || str.length === 0) {
      return str
    }
    else {
      return str.replace(/\'/g, '\'\'')
    }
  }

  // getter for environment type
  getEnvironmentType() {
    return environmentType
  }
}


module.exports = new DbUtil

