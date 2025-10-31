var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cors = require('cors');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
const L = require('./util/logger-wrapper');

let login = require('./routes/r-login');
let userinfo = require('./routes/r-userinfo');
let whereabouts = require('./routes/r-whereabouts');
let department = require('./routes/r-department');
let geolocation = require('./routes/r-geolocation');
let place = require('./routes/r-place');
let presencestatus = require('./routes/r-presence-status');
let telework = require('./routes/r-telework');

//var member = require('./routes/member');
//var group = require('./routes/group');
//var section = require('./routes/section');
//var memberInfo = require('./routes/member-info');
//var indexRouter = require('./routes/index');
//var usersRouter = require('./routes/users');

var app = express();
app.use(cors())

// view engine setup
// @Todo viewは使わないので削除したいが、なぜか'No default engine'エラーが発生する
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());

// header print
app.use(function(req, res, next) {
  L.sLog.debug('app.js print ' + JSON.stringify(req.headers))
  next()
})

/* @Todo この方法ではダメだった corsライブラリを使ってみる
app.options(function(req, res, next) {
  L.sLog.debug('response to OPTION')
  L.sLog.debug(JSON.stringify(res.headers))
  res.sendStatus(200)
})
*/

//app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// enable static contents
app.use(express.static('static'));
//app.use('/', indexRouter);
//app.use('/users', usersRouter);

app.use(function (req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  next()
})

L.sLog.info(JSON.stringify(process.env.npm_package_name))

const RP = '/heresme_be'

// Web API routers
app.use(RP + '/login', login);
app.use(RP + '/userinfo', userinfo);
app.use(RP + '/whereabouts', whereabouts);
app.use(RP + '/departments', department);
app.use(RP + '/geolocations', geolocation);
app.use(RP + '/placelist', place);
app.use(RP + '/presencestatus', presencestatus);
app.use(RP + '/telework', telework);

//app.use('/member', member);
//app.use('/company', memberInfo);
//app.use('/grouplist', group);
//app.use('/sectionlist', section);

// allow Cross-Origin-Resource-Sharing
/* @Todo この方法ではダメだったので corsライブラリを使う
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})
*/

app.options(function(req, res, next) {
  L.sLog.debug('response to OPTION')
  res.sendStatus(200)
})

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
