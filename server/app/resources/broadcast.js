var BroadcastController = require('../controllers/broadcastController.js');
var baseResponse = require('../util/baseResponse.js');

module.exports = function (router) {
    'use strict';

    router.route('/chat/:username')
      .get(function (req, res, next) {
        new BroadcastController().chatPending(req.params.username, baseResponse(res, next));
      });

    router.route('/chat')
      .post(function(req, res, next) {
        new BroadcastController().chatSync(req.body, req.headers["blockstack-auth-token"], baseResponse(res, next));
      });

    router.route('/ping')
      .post(function(req, res, next) {
        new BroadcastController().ping(req.body, req.headers["blockstack-auth-token"], baseResponse(res, next));
      });
        
    router.route('/streamers')
      .get(function (req, res, next) {
        new BroadcastController().listInactive(baseResponse(res, next));
      });

    router.route('/:id?')
      .post(function (req, res, next) {
        new BroadcastController().set(req.body, req.headers["blockstack-auth-token"], baseResponse(res, next));
      })
      .delete(function (req, res, next) {
        new BroadcastController().stop(req.params.id, req.headers["blockstack-auth-token"], baseResponse(res, next));
      })
      .get(function (req, res, next) {
        new BroadcastController().list(baseResponse(res, next));
      });
  };