const Sequelize = require('sequelize');
var DataAccess = require("./dataAccess.js");

class PaymentData {
    constructor(){
        this.Payment = DataAccess.sequelize.define('BroadstackPayment', {
            id: {
                type: Sequelize.CHAR(36),
                primaryKey: true
            },
            username: Sequelize.STRING(50),
            broadcastUsername: Sequelize.STRING(50),
            messageId: Sequelize.STRING(36),
            status: Sequelize.STRING(15),
            amount: Sequelize.FLOAT,
            paymentDate: Sequelize.DATE
        });
    }
    insert(payment) {
        return this.Payment.create(payment);
    }
    update(payment) {
        return payment.update(payment, { where: { id: payment.id }, fields: payment.changed() });
    }
    get(id) {
        return this.Payment.findByPk(id);
    }
    listPayments(username, broadcastUsername, status, notStatus, messageId) {
        var where = {};
        if (username) {
            where["username"] = username;
        }
        if (broadcastUsername) {
            where["broadcastUsername"] = broadcastUsername;
        }
        if (status) {
            where["status"] = status;
        }
        if (notStatus) {
            where["status"] = {[Sequelize.Op.ne]: notStatus};
        }
        if (messageId) {
            where["messageId"] = messageId;
        }
        return this.Payment.findAll({ where: where });
    }
}

module.exports = PaymentData;