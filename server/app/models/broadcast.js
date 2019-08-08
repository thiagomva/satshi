var BroadcastData = require('../data/broadcastData.js');
var BroadcastUserData = require('../data/broadcastUserData.js');

class Broadcast {
    constructor() {
    }

    set(id, username, cb) {
        new BroadcastData().insertOrUpdateStatus(username, id, new Date()).then(result => cb(null, null)).catch(err => cb(err));
    }

    stop(id, username, cb) {
        new BroadcastData().stop(username, id, new Date()).then(result => cb(null, null)).catch(err => cb(err));
    }

    chatSync(id, broadcastUsername, username, cb) {
        new BroadcastData().getCurrent(broadcastUsername).then(current =>
        {
            var now = new Date();
            var shouldTryFinish = !current || current.id != id; 
            if (username) {
                new BroadcastUserData().chatSync(broadcastUsername, id, username, now).then(result =>
                {
                    if (shouldTryFinish) {
                        new BroadcastData().chatSync(broadcastUsername, id, new Date()).then(r => cb(null, null)).catch(err => cb(err));
                    } else {
                        cb(null, null);
                    }
                }).catch(err => cb(err));
            } else if (shouldTryFinish) {
                new BroadcastData().chatSync(broadcastUsername, id, new Date()).then(r => cb(null, null)).catch(err => cb(err));
            } else {
                cb(null, null);
            }
        }).catch(err => cb(err));
    }

    ping(id, broadcastUsername, username, cb) {
        new BroadcastUserData().set(broadcastUsername, id, username, new Date()).then(result => cb(null, null)).catch(err => cb(err));
    }

    chatPending(username, cb) {
        new BroadcastData().listPendingSync(username).then(broadcasts =>
        {
            var result = [];
            if (broadcasts && broadcasts.length > 0) {
                var id = broadcasts[0].id;
                var entity = { id: id, usernames: [] };
                for (var i = 0; i < broadcasts.length; ++i) {
                    if (id != broadcasts[i].id) {
                        result.push(entity);
                        id = broadcasts[i].id;
                        entity = { id: id, usernames: [] };
                    }
                    if (broadcasts[i].username) {
                        entity.usernames.push(broadcasts[i].username);
                    }
                }
                result.push(entity);
            }
            cb(null, result);
        }).catch(err => cb(err));
    }

    getTimeLimitToBeLive() {
        return new Date((new Date()).getTime() - (5 * 60 * 1000)); 
    }

    list(cb) {
        new BroadcastData().listActive(this.getTimeLimitToBeLive()).then(broadcasts => 
        {
            var result = [];
            if (broadcasts) {
                for (var i = 0; i < broadcasts.length; ++i) {
                    var shouldAdd = true;
                    for (var j = 0; j < result.length; ++j) {
                        if (result[j][0] == broadcasts[i].username) {
                            shouldAdd = false;
                            if (result[j][2] < broadcasts[i].statusDate) {
                                result[j][1] = broadcasts[i].id;
                                result[j][2] = broadcasts[i].statusDate;
                            }
                            break;
                        }
                    }
                    if (shouldAdd) {
                        result.push([broadcasts[i].username, broadcasts[i].id, broadcasts[i].statusDate]);
                    }
                }
            }
            cb(null, result);
        }).catch(err => cb(err));
    }

    listInactive(cb) {
        new BroadcastData().listInactive(this.getTimeLimitToBeLive(), true).then(broadcasts => 
        {
            var result = [];
            if (broadcasts) {
                for (var i = 0; i < broadcasts.length; ++i) {
                    result.push([broadcasts[i].username, broadcasts[i].updatedAt]);
                }
            }
            if (result.length < 12) {
                new BroadcastData().listInactive(this.getTimeLimitToBeLive(), false).then(inactives => 
                {
                    if (inactives) {
                        for (var i = 0; i < inactives.length; ++i) {
                            result.push([inactives[i].username, inactives[i].updatedAt]);
                            if (result.length == 12) {
                                break;
                            }
                        }
                    }
                    cb(null, result);
                }).catch(err => cb(err));
            } else {
                cb(null, result);
            }
        }).catch(err => cb(err));
    }
}

module.exports = Broadcast;