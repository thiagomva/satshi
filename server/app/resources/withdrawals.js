var WithdrawalsController = require('../controllers/withdrawalsController.js');
var baseResponse = require('../util/baseResponse.js');

module.exports = function (router) {
    'use strict';
  
    router.route('/')
      .post(function (req, res, next) {
        new WithdrawalsController().create(req.body, req.headers["blockstack-auth-token"], baseResponse(res, next));
      })
      .get(function (req, res, next) {
        new WithdrawalsController().get(req.headers["blockstack-auth-token"], baseResponse(res, next));
      });

    router.route('/check')
      .post(function(req, res, next) {
        new WithdrawalsController().check(req.body, req.headers["blockstack-auth-token"], baseResponse(res, next));
      });

    router.route('/callback')
      .post(function(req, res, next) {
        new WithdrawalsController().callback(req.body, baseResponse(res, next));
      });
  };