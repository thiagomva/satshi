var PaymentsController = require('../controllers/paymentsController.js');
var baseResponse = require('../util/baseResponse.js');

module.exports = function (router) {
    'use strict';
  
    router.route('/')
      .post(function (req, res, next) {
        new PaymentsController().create(req.body, req.headers["blockstack-auth-token"], baseResponse(res, next));
      })
      .get(function (req, res, next) {
        new PaymentsController().listPaid(req.headers["blockstack-auth-token"], baseResponse(res, next));
      });

    router.route('/check')
      .post(function(req, res, next) {
        new PaymentsController().check(req.body, baseResponse(res, next));
      });

    router.route('/callback')
      .post(function(req, res, next) {
        new PaymentsController().callback(req.body, baseResponse(res, next));
      });
  };