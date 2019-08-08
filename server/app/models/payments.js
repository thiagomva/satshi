const axios = require('axios');
var config = require('nconf');
var PaymentData = require('../data/paymentData.js');
var _ = require('underscore');

class Payments {
    constructor() {
    }

    getCallbackResult(callback, cb) {
        try {
            new PaymentData().get(callback.id).then(payment => 
                {
                    this.updatePaymentIfNecessary(payment, callback, cb);
                }).catch(e => cb(e));
        } catch(err) {
            cb(err);
        }
    }

    updatePaymentIfNecessary(payment, nodePaymentData, cb) {
        if (payment.status != nodePaymentData.status) {
            payment.status = nodePaymentData.status;
            payment.paymentDate = this.getPaymentDate(nodePaymentData);
            new PaymentData().update(payment).then(() => cb(null, payment)).catch(e => cb(e));
        } else {
            cb(null, false);
        }
    }

    getPaymentDate(nodePaymentData) {
        if (nodePaymentData.status == "paid") {
            if (nodePaymentData.chain_invoice && nodePaymentData.chain_invoice.settled_at) {
                return new Date(parseInt(nodePaymentData.chain_invoice.settled_at + "000"));
            } else if (nodePaymentData.lightning_invoice && nodePaymentData.lightning_invoice.settled_at) {
                return new Date(parseInt(nodePaymentData.lightning_invoice.settled_at + "000"));
            } else {
                return  new Date();
            }
        } else {
            return null;
        }
    }

    getCreateResult(json, username, cb) {
        var body = {
            description: "Tip for '" + json.broadcastUsername + "'",
            amount: json.amount,
            currency: 'USD',
            callback_url: config.get('OPEN_NODE_PAYMENT_CALLBACK_URL'),
            success_url: config.get('OPEN_NODE_SUCCESS_URL') + json.broadcastUsername +"?handler=openNode&msgId=" + json.messageId 
        };
        var httpConfig = {
            headers: {
                Authorization: config.get('OPEN_NODE_API_KEY')
            }
        };
        try {
            var url = config.get('OPEN_NODE_API_URL') + "v1/charges";
            axios.post(url, body, httpConfig).then(response => {
                var data = response && response.data && response.data.data;
                var payment = {
                    id: data.id, 
                    username: username, 
                    broadcastUsername: json.broadcastUsername, 
                    messageId: msgId,
                    status: data.status, 
                    amount: (data.amount/100000000.0)
                };
                payment.paymentDate = this.getPaymentDate(data);
                new PaymentData().insert(payment).then(() => cb(null, payment)).catch(error => cb(error));
            }).catch(error => cb(error));
        } catch(err) { cb(err); }
    }

    getCheckResult(json, cb) {
        new PaymentData().listPayments(json.username, json.broadcastUsername, null, null, json.messageId).then(payments => {
            if (!payments || payments.length != 1) {
                cb('Payment not found');
            } else {
                var payment = payments[0];
                if (payment.status == "paid" || payment.status == "unpaid") {
                    cb(null, { status: payment.status, amount: payment.amount });
                } else {
                    var httpConfig = {
                        headers: {
                            Authorization: config.get('OPEN_NODE_API_KEY')
                        }
                    };
                    var url = config.get('OPEN_NODE_API_URL') + "v1/charge/";
                    var status = "unpaid";
                    var promises = [];
                    var _this = this;
                    promises.push(new Promise (function(resolve,reject) {
                        axios.get(url + payment.id, httpConfig).then(response => {
                            var data = response && response.data && response.data.data;
                            status = data.status;
                            _this.updatePaymentIfNecessary(payment, data, (e, s) => {
                                if (e) reject(e);
                                else resolve();
                            });
                        }).catch(error => reject(error))})); 
                
                    Promise.all(promises).then(() =>
                    {
                        cb(null, { status: status, amount: payment.amount });
                    }).catch(e => cb(e));
                }
            }
        }).catch(e => cb(e));
    }

    listPaid(username, cb) {
        new PaymentData().listPayments(username, null, null, null, "unpaid", null).then(payments => cb(null, payments)).catch(e => cb(e));
    }

    listPayments(broadcastUsername, cb) {
        new PaymentData().listPayments(null, broadcastUsername, "paid", null, null).then(payments => cb(null, payments)).catch(e => cb(e));
    }
}

module.exports = Payments;