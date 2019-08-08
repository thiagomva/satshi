var Withdrawals = require('../models/withdrawals.js');
var Error = require('../util/error.js');
var Users = require("../helpers/users");
var Util = require("../util/util.js");
var crypto = require('crypto');
var config = require('nconf');

class WithdrawalsController {
    constructor() {}

    validCallback(json) {
        if (!json) throw new Error(400, 'no body in request');
        if (!json.id) throw new Error(400, 'id is mandatory');
        if (!json.status) throw new Error(400, 'status is mandatory');
        if (!json.hashed_order) throw new Error(400, 'hashed_order is mandatory');
        
        const received = json.hashed_order;
        const calculated = crypto.createHmac('sha256', config.get("OPEN_NODE_API_KEY")).update(json.id).digest('hex');

        if (received != calculated) {
            throw new Error(403, 'Forbidden');
        }
    }

    callback(json, cb) {
        this.validCallback(json);
        new Withdrawals().getCallbackResult(json, cb);
    }

    validWithdraw(json, authToken) {
        if (!json) throw new Error(400, 'no body in request');
        if (!json.invoice) throw new Error(400, 'invoice is mandatory');
        if (!authToken) throw new Error(400, 'authToken is mandatory');
    }

    check(json, authToken, cb) {
        if (!json) throw new Error(400, 'no body in request');
        if (!authToken) throw new Error(400, 'authToken is mandatory');
        if (!json.externalIds || json.externalIds.length == 0) throw new Error(400, 'externalIds is mandatory');
        new Withdrawals().getCheckResult(json.externalIds, Users.GetUser(authToken), cb);
    }

    create(json, authToken, cb) {
        this.validWithdraw(json, authToken);
        var invoice = json.invoice.toLowerCase();
        if (invoice.substring(0, 10) == "lightning:") {
            invoice = invoice.substring(10);
        }
        var invalidMsg = "Invalid invoice.";
        if (invoice.length < 117 || invoice.length > 1700) {
            throw new Error(400, invalidMsg);
        }
        var invoiceNetwork = config.get("OPEN_NODE_INVOICE_NETWORK");
        if (invoice.substring(0, invoiceNetwork.length) != invoiceNetwork || !parseInt(invoice.substring(invoiceNetwork.length, invoiceNetwork.length + 1), 10)) {
            throw new Error(400, invalidMsg);
        }
        var splitPosition = invoice.lastIndexOf('1');
        if (splitPosition < 5) {
            throw new Error(400, invalidMsg);
        }
        var amountPart = invoice.substring(4, splitPosition);
        var multiplier = 1;
        if (amountPart[amountPart.length - 1] == 'm') {
            amountPart = amountPart.substring(0, amountPart.length - 1);
            multiplier = 0.001;
        } else if (amountPart[amountPart.length - 1] == 'u') {
            amountPart = amountPart.substring(0, amountPart.length - 1);
            multiplier = 0.000001;
        } else if (amountPart[amountPart.length - 1] == 'n') {
            amountPart = amountPart.substring(0, amountPart.length - 1);
            multiplier = 0.000000001;
        } else if (amountPart[amountPart.length - 1] == 'p') {
            amountPart = amountPart.substring(0, amountPart.length - 1);
            multiplier = 0.000000000001;
        }
        if (!amountPart || !parseFloat(amountPart, 10)) {
            throw new Error(400, invalidMsg);
        }
        var amount = parseFloat(amountPart, 10) * multiplier;
        if (amount <= 0) {
            throw new Error(400, invalidMsg);
        }
        var data = invoice.substring(splitPosition + 1, invoice.length - 6);
        var checksum = invoice.substring(invoice.length - 6, invoice.length);
        
        var timeStamp = Util.bech32ToInt(data.substring(0, 7));
        var tagData = this.decodeTags(data.substring(7, data.length - 104));
        var expiryTime = 3600;
        for (var i = 0; i < tagData.length; ++i) {
            if (tagData[i] && tagData[i].type == 'x') {
                expiryTime = tagData[i].value;
                break;
            }
        }
        if (timeStamp + expiryTime - 300 < Math.round((new Date()).getTime()/1000)) {
            throw new Error(400, invalidMsg);
        }
        if (!this.verifyChecksum(invoice.substring(0, splitPosition), Util.bech32ToFiveBitArray(data + checksum))) {
            throw new Error(400, invalidMsg);
        }
        new Withdrawals().getCreateResult(invoice, amount, Users.GetUser(authToken), cb);
    }

    decodeTags(tagData) {
        var decodedTags = [];
        this.extractTags(tagData).forEach(tag => decodedTags.push(this.decodeTag(tag.type, tag.length, tag.data)));
        return decodedTags;
    }
    
    extractTags(str) {
        var tags = [];
        while (str.length > 0) {
            var type = str.charAt(0);
            var dataLength = Util.bech32ToInt(str.substring(1, 3));
            var data = str.substring(3, dataLength + 3);
            tags.push({
                'type': type,
                'length': dataLength,
                'data': data
            });
            str = str.substring(3 + dataLength, str.length);
        }
        return tags;
    }
    
    decodeTag(type, length, data) {
        switch (type) {
            case 'p':
                if (length !== 52) break; // A reader MUST skip over a 'p' field that does not have data_length 52
                return {
                    'type': type,
                    'length': length,
                    'description': 'payment_hash',
                    'value': Util.byteArrayToHexString(Util.fiveBitArrayTo8BitArray(Util.bech32ToFiveBitArray(data)))
                };
            case 'd':
                return {
                    'type': type,
                    'length': length,
                    'description': 'description',
                    'value': Util.bech32ToUTF8String(data)
                };
            case 'n':
                if (length !== 53) break; // A reader MUST skip over a 'n' field that does not have data_length 53
                return {
                    'type': type,
                    'length': length,
                    'description': 'payee_public_key',
                    'value': Util.byteArrayToHexString(Util.fiveBitArrayTo8BitArray(Util.bech32ToFiveBitArray(data)))
                };
            case 'h':
                if (length !== 52) break; // A reader MUST skip over a 'h' field that does not have data_length 52
                return {
                    'type': type,
                    'length': length,
                    'description': 'description_hash',
                    'value': data
                };
            case 'x':
                return {
                    'type': type,
                    'length': length,
                    'description': 'expiry',
                    'value': Util.bech32ToInt(data)
                };
            case 'c':
                return {
                    'type': type,
                    'length': length,
                    'description': 'min_final_cltv_expiry',
                    'value': Util.bech32ToInt(data)
                };
            case 'f':
                var version = Util.bech32ToFiveBitArray(data.charAt(0))[0];
                if (version < 0 || version > 18) break; // a reader MUST skip over an f field with unknown version.
                data = data.substring(1, data.length);
                return {
                    'type': type,
                    'length': length,
                    'description': 'fallback_address',
                    'value': {
                        'version': version,
                        'fallback_address': data
                    }
                };
            case 'r':
                data = Util.fiveBitArrayTo8BitArray(Util.bech32ToFiveBitArray(data));
                var pubkey = data.slice(0, 33);
                var shortChannelId = data.slice(33, 41);
                var feeBaseMsat = data.slice(41, 45);
                var feeProportionalMillionths = data.slice(45, 49);
                var cltvExpiryDelta = data.slice(49, 51);
                return {
                    'type': type,
                    'length': length,
                    'description': 'routing_information',
                    'value': {
                        'public_key': Util.byteArrayToHexString(pubkey),
                        'short_channel_id': Util.byteArrayToHexString(shortChannelId),
                        'fee_base_msat': Util.byteArrayToInt(feeBaseMsat),
                        'fee_proportional_millionths': Util.byteArrayToInt(feeProportionalMillionths),
                        'cltv_expiry_delta': Util.byteArrayToInt(cltvExpiryDelta)
                    }
                };
            default:
            // reader MUST skip over unknown fields
        }
    }

    polymod(values) {
        var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
        var chk = 1;
        values.forEach((value) => {
            var b = (chk >> 25);
            chk = (chk & 0x1ffffff) << 5 ^ value;
            for (var i = 0; i < 5; i++) {
                if (((b >> i) & 1) === 1) {
                    chk ^= GEN[i];
                } else {
                    chk ^= 0;
                }
            }
        });
        return chk;
    }
    
    expand(str) {
        var array = [];
        for (var i = 0; i < str.length; i++) {
            array.push(str.charCodeAt(i) >> 5);
        }
        array.push(0);
        for (var i = 0; i < str.length; i++) {
            array.push(str.charCodeAt(i) & 31);
        }
        return array;
    }
    
    verifyChecksum(hrp, data) {
        hrp = this.expand(hrp);
        var all = hrp.concat(data);
        return this.polymod(all) === 1;
    }

    get(authToken, cb) {
        if (!authToken) throw new Error(400, 'authToken is mandatory');
        new Withdrawals().getWithdrawalData(Users.GetUser(authToken), cb);
    }
}

module.exports = WithdrawalsController;