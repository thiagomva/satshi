const Sequelize = require('sequelize');
var DataAccess = require("./dataAccess.js");

class BroadcastData {
    constructor() {
        this.Broadcast = DataAccess.sequelize.define('BroadstackBroadcast', {
            username: {
                type: Sequelize.STRING(50),
                primaryKey: true
            },
            id: {
                type: Sequelize.STRING(36),
                primaryKey: true
            },
            statusDate: Sequelize.DATE,
            chatSync: Sequelize.BOOLEAN,
            isPriority: Sequelize.BOOLEAN
        });
    }
    stop(username, id, now) {
        var query = "UPDATE [BroadstackBroadcast] SET StatusDate = NULL, UpdatedAt = :now WHERE Username = :username AND Id = :id ";
        var replacements = {
            username: username,
            id: id,
            now: now
        };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { raw: true, plain: true, type: Sequelize.QueryTypes.UPDATE });
    }
    insertOrUpdateStatus(username, id, now) {
        var query = "MERGE INTO [BroadstackBroadcast] AS T USING (SELECT :username AS Username, :id AS Id) AS V ON (T.Username = V.Username AND T.Id = V.Id) ";
        query += "WHEN NOT MATCHED BY TARGET THEN INSERT (Username, Id, StatusDate, ChatSync, IsPriority, CreatedAt, UpdatedAt) VALUES (V.Username, V.Id, :now, 0, 0, :now, :now) ";
        query += "WHEN MATCHED THEN UPDATE SET StatusDate = :now, UpdatedAt = :now;"
        var replacements = {
            username: username,
            id: id,
            now: now
        };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { raw: true, plain: true, type: Sequelize.QueryTypes.UPSERT });
    }
    chatSync(username, id, now) {
        var query = "UPDATE [BroadstackBroadcast] SET ChatSync = 1, UpdatedAt = :now WHERE Username = :username AND Id = :id ";
        query += "AND NOT EXISTS(SELECT 1 FROM [BroadstackBroadcastUser] u WHERE u.BroadcastUsername = :username AND u.Id = :id AND u.ChatSync = 0);"; 
        var replacements = {
            username: username,
            id: id,
            now: now
        };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { raw: true, plain: true, type: Sequelize.QueryTypes.UPDATE });
    }
    getCurrent(username) {
        return this.Broadcast.findOne({ where: { username: username }, order: [['updatedAt', 'DESC']], limit: 1 });
    }
    get(username, id) {
        return this.Broadcast.findOne({ where: { username: username, id: id }});
    }
    listPendingSync(username) {
        var query = "SELECT b.Id AS id, u.Username AS username FROM [BroadstackBroadcast] AS b with(nolock) ";
        query += "LEFT JOIN [BroadstackBroadcastUser] AS u with(nolock) ON u.BroadcastUsername = b.Username AND u.Id = b.Id ";
        query += "WHERE b.Username = :username AND b.ChatSync = 0 AND (u.ChatSync = 0 OR u.BroadcastUsername IS NULL) ORDER BY b.Id";
        var replacements = { username: username };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { type: Sequelize.QueryTypes.SELECT });
    }
    listActive(lastStatusTime) {
        return this.Broadcast.findAll({ where: { statusDate: {[Sequelize.Op.gte]: lastStatusTime} } });
    }
    listInactive(consideringStatusDate, priority) {
        var query = "SELECT TOP 12 b.Username AS username, MAX(b.UpdatedAt) AS updatedAt FROM [BroadstackBroadcast] AS b with(nolock) ";
        query += "WHERE b.IsPriority = :priority AND (b.StatusDate < :statusDate OR b.StatusDate IS NULL) ";
        query += "AND NOT EXISTS (SELECT 1 FROM [BroadstackBroadcast] AS b2 with(nolock) WHERE b2.Username = b.Username AND b2.StatusDate >= :statusDate) ";
        query += "GROUP BY b.Username ORDER BY MAX(b.UpdatedAt) DESC";
        var replacements = { statusDate: consideringStatusDate, priority: priority };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { type: Sequelize.QueryTypes.SELECT });
    }
}

module.exports = BroadcastData;