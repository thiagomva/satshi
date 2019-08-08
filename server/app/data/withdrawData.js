const Sequelize = require('sequelize');
var DataAccess = require("./dataAccess.js");

class WithdrawData {
    constructor(){
        this.Withdraw = DataAccess.sequelize.define('BroadstackWithdraw', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            username: Sequelize.STRING(50),
            externalId: Sequelize.CHAR(36),
            status: Sequelize.STRING(15),
            amount: Sequelize.FLOAT,
            fee:  Sequelize.FLOAT,
            processedDate: Sequelize.DATE,
            invoice: Sequelize.STRING(1700)
        });
    }
    insert(username, status, amount, invoice, now) {
        var query = "INSERT INTO [BroadstackWithdraw] ([Username],[Status],[Amount],[Invoice],[CreatedAt],[UpdatedAt])";
        query += " VALUES ( :username, :status, :amount, :invoice, :now, :now)";
        query += "; SELECT SCOPE_IDENTITY() AS id;";
        var replacements = {
            username: username,
            status: status,
            amount: amount,
            invoice: invoice,
            now: now
        };
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { raw: true, plain: true, type: Sequelize.QueryTypes.INSERT });
    }
    update(id, externalId, status, invoice, amount, fee, processedDate, statusUpdateRestriction, now) {
        var query = "UPDATE [BroadstackWithdraw] SET [ExternalId] = :externalId, [Status] = :status, [Invoice] = :invoice, [Amount] = :amount,";
        query += " [Fee] = :fee, [ProcessedDate] = :processedDate, [UpdatedAt] = :now WHERE Id = :id ";
        var replacements = {
            externalId: externalId,
            status: status,
            amount: amount,
            invoice: invoice,
            id: id,
            fee: fee,
            processedDate: processedDate,
            now: now
        };
        if (statusUpdateRestriction) {
            query += " AND Status = :statusUpdateRestriction ";
            replacements["statusUpdateRestriction"] = statusUpdateRestriction;
        }
        return DataAccess.sequelize.query(DataAccess.getFormattedRawQuery(query, replacements), { raw: true, plain: true, type: Sequelize.QueryTypes.RAW });
    }
    get(id) {
        return this.Withdraw.findByPk(id);
    }
    getByExternalsId(ids) {
        return this.Withdraw.findOne({ where: {externalId: {[Sequelize.Op.in]: ids}} });
    }
    getByInvoice(invoice) {
        return this.Withdraw.findAll({ where: {invoice: invoice} });
    }
    list(username) {
        return this.Withdraw.findAll({ where: {username: username} });
    }
}

module.exports = WithdrawData;