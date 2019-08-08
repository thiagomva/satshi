var Broadcast = require('../models/broadcast.js');
var Error = require('../util/error.js');
var Users = require("../helpers/users");

class BroadcastController {
    constructor() {}
    
    baseValidation(json, authToken) {
        if (!json) throw new Error(400, 'no body in request');
        if (!json.id) throw new Error(400, 'id is mandatory');
        if (!authToken) throw new Error(400, 'authToken is mandatory');
    }

    set(json, authToken, cb) {
        this.baseValidation(json, authToken);
        new Broadcast().set(json.id, Users.GetUser(authToken), cb);
    }

    stop(id, authToken, cb) {
        if (!id) throw new Error(400, 'id is mandatory');
        if (!authToken) throw new Error(400, 'authToken is mandatory');
        new Broadcast().stop(id, Users.GetUser(authToken), cb);
    }

    chatSync(json, authToken, cb) {
        this.baseValidation(json, authToken);
        new Broadcast().chatSync(json.id, Users.GetUser(authToken), json.username, cb);
    }

    ping(json, authToken, cb) {
        this.baseValidation(json, authToken);
        if (!json.username) throw new Error(400, 'username is mandatory');
        new Broadcast().ping(json.id, json.username, Users.GetUser(authToken), cb);
    }

    chatPending(username, cb) {
        if (!username) throw new Error(400, 'username is mandatory');
        new Broadcast().chatPending(username, cb);
    }

    list(cb) {
        new Broadcast().list(cb);
    }

    listInactive(cb) {
        new Broadcast().listInactive(cb);
    }
}

module.exports = BroadcastController;