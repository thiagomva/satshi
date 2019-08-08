import { UserSession } from 'blockstack'
import { appConfig, server_url } from './constants'
import Axios from 'axios'


export default class ServerManager {

    static withdraw(invoice) {
        return new Promise(function (resolve, reject) {
            ServerManager._post("v1/withdrawals", { invoice: invoice }).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static listWithdrawals() {
        return new Promise(function (resolve, reject) {
            ServerManager._get("v1/withdrawals").then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static pay(broadcastUsername, messageId, amount) {
        return new Promise(function (resolve, reject) {
            ServerManager._post("v1/payments", { broadcastUsername: broadcastUsername, messageId: messageId, amount: amount }).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static checkPayment(broadcastUsername, messageId, username) {
        return new Promise(function (resolve, reject) {
            ServerManager._post("v1/payments/check", { broadcastUsername: broadcastUsername, messageId: messageId, username: username }).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static listPayments() {
        return new Promise(function (resolve, reject) {
            ServerManager._get("v1/payments").then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static setChat(chatId) {
        return new Promise(function (resolve, reject) {
            ServerManager._post("v1/broadcast", { id: chatId }).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static stopChat(chatId) {
        return new Promise(function (resolve, reject) {
            ServerManager._delete("v1/broadcast/" + chatId).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static listLiveBroadcast() {
        return new Promise(function (resolve, reject) {
            ServerManager._get("v1/broadcast").then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static listInactiveStreamers() {
        return new Promise(function (resolve, reject) {
            ServerManager._get("v1/broadcast/streamers").then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static ping(chatId, broadcastUsername) {
        return new Promise(function (resolve, reject) {
            ServerManager._post("v1/broadcast/ping", { id: chatId, username: broadcastUsername }).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static listPendingSyncChat(username) {
        return new Promise(function (resolve, reject) {
            ServerManager._get("v1/broadcast/chat/" + username).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static syncChat(chatId, username) {
        return new Promise(function (resolve, reject) {
            ServerManager._post("v1/broadcast/chat", { id: chatId, username: username }).then(response => resolve(response)).catch((err) => reject(err))
        })
    }

    static _post(route, content) {
        return new Promise(function (resolve, reject) {
            Axios.post(server_url + route, content, ServerManager._getRequestConfig()).then(response => 
                {
                    if (response && response.data) {
                        resolve(response.data)
                    } else {
                        resolve(null)
                    }
                }).catch((err) => reject(err))
        })
    }

    static _delete(route) {
        return new Promise(function (resolve, reject) {
            Axios.delete(server_url + route, ServerManager._getRequestConfig()).then(response => 
                {
                    if (response && response.data) {
                        resolve(response.data)
                    } else {
                        resolve(null)
                    }
                }).catch((err) => reject(err))
        })
    }

    static _get(route) {
        return new Promise(function (resolve, reject) {
            Axios.get(server_url + route, ServerManager._getRequestConfig()).then(response => 
                {
                    if (response && response.data) {
                        resolve(response.data)
                    } else {
                        resolve(null)
                    }
                }).catch((err) => reject(err))
        })
    }

    static _getRequestConfig() {
        const userSession = new UserSession({ appConfig })
        if (userSession.isUserSignedIn()) {
            const { authResponseToken } = userSession.loadUserData()
            var config = { headers: {} }
            config.headers["blockstack-auth-token"] = authResponseToken
            return config
        } else {
            return null
        }
    }
}
