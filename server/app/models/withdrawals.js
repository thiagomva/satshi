const axios = require('axios');
var config = require('nconf');
var Payments = require('./payments');
var WithdrawData = require('../data/withdrawData.js');
var Lock = require('../helpers/lock.js');
var _ = require('underscore');

const lock = new Lock();

class Withdrawals {
    constructor() {
    }

    getCallbackResult(callback, cb) {
        try {
            new WithdrawData().getByExternalsId([callback.id]).then(withdraw => {
                if (withdraw) {
                    this.setWithdrawCallback(withdraw, callback, cb);
                } else {
                    new WithdrawData().getByInvoice(callback.reference).then(withdrawals => {
                        if (withdrawals && withdrawals.length > 0) {
                            var related = null;
                            for (var i = 0; i < withdrawals.length; ++i) {
                                if ((withdrawals[i].status == 'pending' || withdrawals[i].status == 'starting') &&
                                    (withdrawals[i].externalId == callback.id || !withdrawals[i].externalId)) {
                                    related = withdrawals[i];
                                    var previousStatus = withdrawals[i].status;
                                    this.setWithdrawDataToUpdate(related, callback);
                                    related.status = previousStatus;
                                    break;
                                }
                            }
                            if (related) {
                                this.setWithdrawCallback(related, callback, cb);
                            } else {
                                cb(null, false);
                            }
                        } else {
                            cb(null, false);
                        }
                    }).catch(e => cb(e));
                }
            }).catch(e => cb(e));
        } catch(err) {
            cb(err);
        }
    }

    setWithdrawCallback(withdraw, callback, cb) {
        if (withdraw.status != callback.status) {
            withdraw.status = callback.status;
            withdraw.processedDate = this.getProcessedDate(callback);
            withdraw.fee = callback.fee;
            new WithdrawData().update(withdraw.id, withdraw.externalId, withdraw.status, withdraw.invoice, withdraw.amount, withdraw.fee, withdraw.processedDate, null, new Date()).then(() => cb(null, withdraw)).catch(e => cb(e));
        } else {
            cb(null, false);
        }
    }

    getProcessedDate(nodeWithdrawData) {
        if (nodeWithdrawData.status == "confirmed") {
            if (nodeWithdrawData.processed_at) {
                return new Date(parseInt(nodeWithdrawData.processed_at + "000"));
            } else {
                return  new Date();
            }
        } else {
            return null;
        }
    }

    getCheckResult(externalIds, username, cb) {
        new WithdrawData().getByExternalsId(externalIds).then(withdrawals => {
            if (withdrawals && withdrawals.length > 0) {
                var httpConfig = { headers: { Authorization: config.get('OPEN_NODE_API_KEY') } };
                var url = config.get('OPEN_NODE_API_URL') + "v1/withdrawal/";
                var promises = [];
                var _this = this;
                withdrawals.forEach((withdraw) => {
                    promises.push(new Promise (function(resolve,reject) {
                        axios.get(url + withdraw.externalId, httpConfig).then(response => {
                            if (response && response.data && response.data.data) {
                                _this.setWithdrawCallback(withdraw, response.data.data, (e, s) => {
                                    if (e) reject(e);
                                    else resolve();
                                });
                            }
                        }).catch(error => reject(error))})); 
                });
                Promise.all(promises).then(() => cb(null, withdrawals)).catch(e => cb(e));
            }
        }).catch((e) => cb(e));  
    }

    getCreateResult(invoice, amount, username, cb) {
        new Payments().listPayments(username, (e, p) => {
            if (e) {
                cb(e);
            } else {
                if (!p || p.length == 0) {
                    cb("No value to withdraw.");
                } else {
                    lock.acquire(username).then(() => {
                        new WithdrawData().list(username).then(w => {
                            var amountAvailable = 0;
                            p.forEach(c => amountAvailable += c.amount);
                            var sameInvoice = false;
                            for (var i = 0; i < w.length; ++i) {
                                amountAvailable -= w[i].amount;
                                if (w[i].invoice == invoice) {
                                    sameInvoice = true;
                                }
                            }
                            if (sameInvoice) {
                                lock.release(username);
                                cb("Invoice already used.");
                            } else if (amountAvailable < amount) {
                                lock.release(username);
                                cb("Invalid amount to withdraw.");
                            } else {
                                var withdraw = new WithdrawData();
                                withdraw.status = "starting";
                                withdraw.username = username; 
                                withdraw.amount = amount; 
                                withdraw.invoice = invoice;
                                new WithdrawData().insert(withdraw.username, withdraw.status, withdraw.amount, withdraw.invoice, new Date()).then((result) => {
                                    withdraw.id = result[0];
                                    var body = {
                                        type: 'ln',
                                        address: invoice,
                                        callback_url: config.get('OPEN_NODE_WITHDRAW_CALLBACK_URL')
                                    };
                                    var httpConfig = {
                                        headers: {
                                            Authorization: config.get('OPEN_NODE_API_KEY')
                                        }
                                    };
                                    try {
                                        var url = config.get('OPEN_NODE_API_URL') + "v2/withdrawals";
                                        axios.post(url, body, httpConfig).then(response => {
                                            var data = response && response.data && response.data.data;
                                            this.setWithdrawDataToUpdate(withdraw, data);
                                            new WithdrawData().update(withdraw.id, withdraw.externalId, withdraw.status, withdraw.invoice, withdraw.amount, withdraw.fee, withdraw.processedDate, "starting", new Date()).then(() => {
                                                lock.release(username);
                                                cb(null, {type: 'Withdraw', referenceDate: new Date(), status: withdraw.status, amount: withdraw.amount});
                                            }).catch(error => {
                                                lock.release(username);
                                                cb(error);
                                            });
                                        }).catch(error => {
                                            lock.release(username);
                                            cb(error);
                                        });
                                    } catch(err) { 
                                        lock.release(username);
                                        cb(err); 
                                    }
                                }).catch(error => {
                                    lock.release(username);
                                    cb(error);
                                });
                            }
                        }).catch(err => {
                            lock.release(username);
                            cb(err);
                        });
                    }).catch(err => {
                        lock.release(username);
                        cb(err);
                    });
                }
            }
        });
    }

    setWithdrawDataToUpdate(withdraw, data) {
        withdraw.externalId = data.id;
        withdraw.status = data.status;
        withdraw.invoice = data.reference; 
        withdraw.amount = (data.amount/100000000.0); 
        withdraw.fee = data.fee; 
        withdraw.processedDate = this.getProcessedDate(data); 
    }

    getWithdrawalData(username, cb) {
        new Payments().listPayments(username, (e, p) => {
            if (e) {
                cb(e);
            } else {
                if (!p || p.length == 0) {
                    cb(null, { availableAmount: 0, withdrawalAmount: 0, balance: [] });
                } else {
                    new WithdrawData().list(username).then(w => {
                        var balance = [];
                        var paymentsAmount = 0;
                        var withdrawalAmount = 0;
                        p.forEach(c => {
                            paymentsAmount += c.amount;
                            balance.push({type: 'Payment', referenceDate: c.updatedAt, username: c.username, messageId: c.messageId, status: 'paid', amount: c.amount});
                        });
                        w.forEach(c => {
                            withdrawalAmount += c.amount;
                            balance.push({type: 'Withdraw', referenceDate: c.updatedAt, status: c.status, amount: c.amount});
                        });
                        balance = _.sortBy(balance, 'ReferenceDate').reverse();
                        cb(null, { availableAmount: Math.round((paymentsAmount - withdrawalAmount) * Math.pow(10, 8)) / Math.pow(10, 8), withdrawalAmount: Math.round(withdrawalAmount * Math.pow(10, 8)) / Math.pow(10, 8), balance: balance });
                    }).catch(err => cb(err));
                }
            }
        });
    }
}

module.exports = Withdrawals;