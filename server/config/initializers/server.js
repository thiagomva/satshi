// config/initializers/server.js

var express = require('express');
var path = require('path');
// Local dependecies
var config = require('nconf');

// create the express app
// configure middlewares
var bodyParser = require('body-parser');
var logger = require('winston');
var cors = require('cors');
var app;

var start = function (cb) {
  'use strict';
  // Configure express 
  app = express();
  app.use(cors());
  app.options('*', cors());

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json({ type: '*/*' }));

  logger.info('[SERVER] Initializing routes');
  require('../../app/helpers/authenticationHelper')(app);
  require('../../app/resources/index')(app);
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: typeof(err) === "string" ? err : err.message,
      error: app.get('env') === 'dev' ? err : {}
    });
    next(err);
  });

  app.listen(process.env.PORT || config.get('NODE_PORT'));
  logger.info('[SERVER] Listening on port ' + (process.env.PORT || config.get('NODE_PORT')));

  if (cb) {
    return cb();
  }
};

module.exports = start;

