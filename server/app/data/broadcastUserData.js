const Sequelize = require('sequelize');
var DataAccess = require("./dataAccess.js");

class BroadcastUserData {
    constructor() {
        this.Broadcast = DataAccess.sequelize.define('BroadstackBroadcastUser', {
            broadcastUsername: {
                type: Sequelize.STRING(50),
                primaryKey: true
            },
            id: {
                type: Sequelize.STRING(36),
                primaryKey: true
            },
            username: {
                type: Sequelize.STRING(50),
                primaryKey: true
            },
            chatSync: Sequelize.BOOLEAN
        });
    }
    set(broadcastUsername, id, username, now) {
        var query = "MERGE INTO [BroadstackBroadcastUser] AS T USING (SELECT :broadcastUsername AS BroadcastUsername, :id AS Id, :username AS Username) AS V ON (T.Username = V.Username AND T.Id = V.Id AND T.BroadcastUsername = V.BroadcastUsername) ";
        query += "WHEN NOT MATCHED BY TARGET THEN INSERT (BroadcastUsername, Id, Username, ChatSync, CreatedAt, UpdatedAt) VALUES (V.BroadcastUsername, V.Id, V.Username, 0, :now, :now) ";
        query += "WHEN MATCHED THEN UPDATE SET ChatSync = 0, UpdatedAt = :now;"
        var replacements = {
            username: username,
            id: id,
            broadcastUsername: broadcastUsername,
            now: now
        };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { raw: true, plain: true, type: Sequelize.QueryTypes.UPSERT });
    } 
    chatSync(broadcastUsername, id, username, now) {
        var query = "UPDATE [BroadstackBroadcastUser] SET ChatSync = 1, UpdatedAt = :now WHERE BroadcastUsername = :broadcastUsername AND Username = :username AND Id = :id AND :now >= dateadd(ss, 20, UpdatedAt)";
        var replacements = {
            username: username,
            id: id,
            broadcastUsername: broadcastUsername,
            now: now
        };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { raw: true, plain: true, type: Sequelize.QueryTypes.UPDATE });
    }
}

module.exports = BroadcastUserData;