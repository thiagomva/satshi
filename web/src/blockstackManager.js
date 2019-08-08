import {  
    UserSession,
    getFile,
    putFile,
    deleteFile,
    lookupProfile,
    Person
} from 'blockstack'
import { signECDSA, verifyECDSA } from 'blockstack/lib/encryption'
import { getPublicKeyFromPrivate } from 'blockstack/lib/keys'
import { appConfig } from './constants'
import ServerManager from './serverManager'

const publicKeyFile = "publicKey.json"
const currentInfoFile = "currentInfo.json"
const chatsIdFile = "chatsId.json"

export default class BlockstackManager {

    static signMessage (message) {
        const userSession = new UserSession({ appConfig })
        const { appPrivateKey } = userSession.loadUserData()
        return signECDSA(appPrivateKey, message)
    }

    static verifySignature (message, username, signature) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._getPublicKey(username).then((publicKey) =>
            {
                if (publicKey) {
                    var isValid = false
                    try {
                        isValid = verifyECDSA(message, publicKey, signature)
                    } catch {}
                    resolve(isValid)
                } else {
                    resolve(null)
                }
            }).catch((err) => reject(err))
        })
    }

    static getLoggedUsername() {
        const userSession = new UserSession({ appConfig })
        if (userSession.isUserSignedIn()) {
            return userSession.loadUserData().username
        } else {
            return null
        }
    }

    static getPendingChats (broadcastUsername) {
        return new Promise(function (resolve, reject) {
            ServerManager.listPendingSyncChat(broadcastUsername).then((response) =>
            {
                if (!response || response.length === 0) {
                    resolve([])
                } else {
                    
                    var promises = []
                    for (var i = 0; i < response.length; ++i) {
                        promises.push(BlockstackManager._getNotSyncChat(broadcastUsername, response[i].id, response[i].usernames))
                    }
                    Promise.all(promises).then((result) => 
                    {
                        var messages = []
                        var promisesSync = []
                        var username = BlockstackManager.getLoggedUsername()
                        for (var i = 0; i < result.length; ++i) {
                            if (result[i]) {
                                if (username === broadcastUsername) {
                                    promisesSync.push(BlockstackManager._syncChat(result[i], broadcastUsername, response[i].id, response[i].usernames))
                                } else {
                                    for (var j = 0; j < result[i].length; ++j) {
                                        messages.push(result[i][j])
                                    }
                                }
                            }
                        }
                        if (promisesSync.length === 0) {
                            BlockstackManager.sortChat(messages)
                            resolve(messages)
                        } else {
                            Promise.all(promisesSync).then((chatMessages) => 
                            {
                                for (var i = 0; i < chatMessages.length; ++i) {
                                    for (var j = 0; j < chatMessages[i].length; ++j) {
                                        messages.push(chatMessages[i][j])
                                    }
                                }
                                BlockstackManager.sortChat(messages)
                                resolve(messages)
                            }).catch((err) => reject(err))
                        }
                    }).catch((err) => reject(err))
                }
            }).catch((err) => reject(err))
        })
    }

    static _getNotSyncChat (broadcastUsername, chatId, usernames) {
        return new Promise(function (resolve, reject) {
            if (!usernames || usernames.length === 0) {
                resolve([])
            } else {                
                BlockstackManager._getChat(broadcastUsername, chatId).then((chatMessages) => 
                {
                    var promises = []
                    for (var i = 0; i < usernames.length; ++i) {
                        promises.push(BlockstackManager._getUserNotSyncMessages(chatMessages, broadcastUsername, chatId, usernames[i]))
                    }
                    Promise.all(promises).then((result) =>
                    {
                        var messages = []
                        for (var i = 0; i < result.length; ++i) {
                            if (result[i]) {
                                for (var j = 0; j < result[i].length; ++j) {
                                    messages.push(result[i][j])
                                }
                            }
                        }
                        resolve(messages)
                    }).catch((err) => reject(err))
                }).catch((err) => reject(err))
            }
        })
    }

    static _getUserNotSyncMessages (chatSyncedMessages, broadcastUsername, chatId, username) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._getPublicFile(`${broadcastUsername}.${chatId}.json`, username).then((userMessages) => 
            {
                var newMessages = []
                var promises = []
                if (userMessages && userMessages.length > 0) {
                    for (var i = 0; i < userMessages.length; ++i) {
                        var shouldAdd = true
                        for (var j = 0; j < chatSyncedMessages.length; ++j) {
                            if (BlockstackManager.getMessageId(chatSyncedMessages[j]) === BlockstackManager.getMessageId(userMessages[i])) {
                                shouldAdd = false
                                break
                            }
                        }
                        if (shouldAdd) {
                            if (BlockstackManager.getPaymentStatus(userMessages[i]) === 1) {
                                userMessages[i][5] = 2
                            } 
                            newMessages.push(userMessages[i])
                            promises.push(BlockstackManager._getPublicKey(BlockstackManager.getUsername(userMessages[i])))
                        }
                    }
                    if (promises.length > 0) {
                        Promise.all(promises).then((result) =>
                        {
                            var messages = []
                            for (var i = 0; i < result.length; ++i) {
                                if (result[i] && BlockstackManager._isValidSignature(newMessages[i], broadcastUsername, result[i])) {
                                    messages.push(newMessages[i])
                                }
                            }
                            resolve(messages)
                        }).catch((err) => reject(err))
                    } else {
                        resolve([])
                    }
                }
            }).catch((err) => reject(err))
        })
    }

    static _syncChat (chatMessages, broadcastUsername, chatId, usernames) {
        return new Promise(function (resolve, reject) {
            if (chatMessages.length > 0) {
                var promises = []
                var paidMessages = []
                var savedMessages = []
                for (var i = 0; i < chatMessages.length; ++i) {
                    if (BlockstackManager.getPaymentStatus(chatMessages[i]) === 2) {
                        paidMessages.push(chatMessages[i])
                        promises.push(ServerManager.checkPayment(broadcastUsername, BlockstackManager.getMessageId(chatMessages[i]), BlockstackManager.getUsername(chatMessages[i])))
                    } else {
                        savedMessages.push(chatMessages[i])
                    }
                }
                if (promises.length > 0) {
                    Promise.all(promises).then((result) =>
                    {
                        var usernamesNotServerSync = []
                        for (var i = 0; i < result.length; ++i) {
                            if (result[i].status === "paid") {
                                paidMessages[i][6] = result[i].amount
                                paidMessages[i][5] = 1
                            } else if (result[i].status === "unpaid") {
                                paidMessages[i][5] = 0
                            } else {
                                usernamesNotServerSync.push(BlockstackManager.getUsername(paidMessages[i]))
                            }
                            savedMessages.push(paidMessages[i])
                        }
                        BlockstackManager._saveSyncChat(savedMessages, chatId, usernames, usernamesNotServerSync).then(() => resolve(savedMessages)).catch((err) => reject(err))
                    }).catch((err) => reject(err))
                } else {
                    BlockstackManager._saveSyncChat(savedMessages, chatId, usernames, []).then(() => resolve(savedMessages)).catch((err) => reject(err))
                }
            } else {
                ServerManager.syncChat(chatId, null).then(() => resolve(chatMessages)).catch((err) => reject(err))
            }
        })
    }

    static _saveSyncChat (chatMessages, chatId, usernames, usernamesNotServerSync) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._saveChat(chatId, chatMessages).then(() =>
            {
                if (!usernames || usernames.length === 0) {
                    ServerManager.syncChat(chatId, null).then(() => resolve(chatMessages)).catch((err) => reject(err))
                } else {
                    var promises = []
                    for (var i = 0; i < usernames.length; ++i) {
                        var shouldSync = true
                        for (var j = 0; j < usernamesNotServerSync.length; ++j) {
                            if (usernamesNotServerSync[j] === usernames[i]) {
                                shouldSync = false
                                break
                            }
                        }
                        if (shouldSync) {
                            promises.push(ServerManager.syncChat(chatId, usernames[i]))
                        }
                    }
                    if (promises.length > 0) {
                        Promise.all(promises).then(() => resolve(chatMessages)).catch((err) => reject(err))
                    } else {
                        resolve(chatMessages)
                    }
                }
            }).catch((err) => reject(err))
        })
    }

    static getUserProfile (username) {
        return new Promise(function (resolve, reject) {
            var storedUserData = window && window["userBlockstackData"] && window["userBlockstackData"].getProfile ? window["userBlockstackData"].getProfile(username) : null
            if (storedUserData) {
                resolve(storedUserData)
            } else {
                lookupProfile(username).then((profile) => 
                {
                    if (profile) {
                        var person = new Person(profile)
                        var userData = { username: username, name: person.name(), avatarUrl: person.avatarUrl() }
                        if (window && window["userBlockstackData"] && window["userBlockstackData"].setProfile) {
                            window["userBlockstackData"].setProfile(username, userData)
                        }
                        resolve(userData)
                    } else {
                        resolve()
                    }
                }).catch((err) => reject(err))
            }
        })
    }

    static _getPublicKey(username) {
        return new Promise(function (resolve, reject) {
            var storedUserData = window && window["userBlockstackData"] && window["userBlockstackData"].getPublicKey ? window["userBlockstackData"].getPublicKey(username) : null
            if (storedUserData) {
                resolve(storedUserData)
            } else {
                BlockstackManager._getPublicFile(publicKeyFile, username).then((publicKey) =>
                {
                    if (publicKey && publicKey.key) {
                        if (window && window["userBlockstackData"] && window["userBlockstackData"].setPublicKey) {
                            window["userBlockstackData"].setPublicKey(username, publicKey.key)
                        }
                        resolve(publicKey.key)
                    } else {
                        resolve(null)
                    }
                }).catch((err) => reject(err))
            }
        })
    }

    static getValidMessage (broadcastUsername, chatMessage, chatMessages = null, chatId = null) {
        return new Promise(function (resolve, reject) {
            var chatUsername = BlockstackManager.getUsername(chatMessage)
            BlockstackManager._getPublicKey(chatUsername).then((publicKey) =>
            {
                if (publicKey) {
                    BlockstackManager._getValidMessage(broadcastUsername, chatMessage, publicKey, chatMessages, chatId).then((message) => resolve(message)).catch((err) => reject(err))
                } else {
                    resolve(null)
                }
            }).catch((err) => reject(err))
        })
    }

    static _getValidMessage (broadcastUsername, chatMessage, publicKey, chatMessages, chatId) {
        return new Promise(function (resolve, reject) {
            if (BlockstackManager._isValidSignature(chatMessage, broadcastUsername, publicKey)) {
                if (BlockstackManager.getPaymentStatus(chatMessage) !== 0) {
                    ServerManager.checkPayment(broadcastUsername, BlockstackManager.getMessageId(chatMessage), BlockstackManager.getUsername(chatMessage)).then((result) =>
                    {
                        if (result.status === "paid") {
                            chatMessage[6] = result.amount
                            chatMessage[5] = 1
                        } else if (result.status === "unpaid") {
                            chatMessage[5] = 0
                        } 
                        if (chatMessages && chatId) {
                            chatMessages.push(chatMessage)
                            BlockstackManager._saveChat(chatId, chatMessages).then(() => resolve({ message: chatMessage, currentChat: chatMessages })).catch((err) => reject(err))
                        } else {
                            resolve({ message: chatMessage, currentChat: chatMessages })
                        }
                    }).catch((err) => reject(err))
                } else {
                    resolve({ message: chatMessage, currentChat: chatMessages })
                }
            } else {
                resolve(null)
            }
        })
    }

    static getPaymentAmount (chatMessage) {
        return chatMessage[6]
    }

    static getPaymentStatus (chatMessage) {
        return chatMessage[5]
    }

    static getMessageText (chatMessage) {
        return chatMessage[4]
    }

    static getMessageId (chatMessage) {
        return chatMessage[3]
    }

    static _getSignature (chatMessage) {
        return chatMessage[2]
    }

    static getUsername (chatMessage) {
        return chatMessage[1]
    }

    static getTime (chatMessage) {
        return chatMessage[0]
    }

    static _isValidSignature (chatMessage, broadcastUsername, publicKey) {
        var isValid = false
        try {
            isValid = verifyECDSA(BlockstackManager._getMessageToSign(
                broadcastUsername, 
                BlockstackManager.getUsername(chatMessage), 
                BlockstackManager.getMessageId(chatMessage)),
                publicKey, 
                BlockstackManager._getSignature(chatMessage))
        } catch {}
        return isValid
    }

    static setChatMessage (broadcastUsername, newMessageText, paymentStatus = 0, paymentAmount = 0) {
        const userSession = new UserSession({ appConfig })
        const { appPrivateKey, username } = userSession.loadUserData()
        const messageId = BlockstackManager.generateUUID()
        const { signature } = signECDSA(appPrivateKey, BlockstackManager._getMessageToSign(broadcastUsername, username, messageId))
        const now = new Date().getTime()
        return [now,username,signature,messageId,newMessageText,paymentStatus,paymentAmount]
    }

    static storeChatMessage (broadcastUsername, myChatMessages, currentChatMessages = null) {
        return new Promise(function (resolve, reject) {
            BlockstackManager.getCurrentChatInfo(broadcastUsername).then((chatInfo) =>
            {
                if (chatInfo && chatInfo.id) {
                    putFile(`${broadcastUsername}.${chatInfo.id}.json`, JSON.stringify(myChatMessages), { encrypt: false }).then(() => 
                    {
                        ServerManager.ping(chatInfo.id, broadcastUsername).then(() => 
                        {
                            if (currentChatMessages) {
                                BlockstackManager._saveChat(chatInfo.id, currentChatMessages)
                            }
                            resolve(true)
                        }).catch((err) => reject(err))
                    }).catch((err) => reject(err))
                } else {
                    resolve(null)
                }
            }).catch((err) => reject(err))
        })
    }

    static _getMessageToSign (broadcastUsername, username, messageId) {
        return `${broadcastUsername}-${username}-${messageId}`
    }

    static setPublicKey () {
        return new Promise(function (resolve, reject) {
            const userSession = new UserSession({ appConfig })
            const { appPrivateKey, username } = userSession.loadUserData()
            const publicKey = getPublicKeyFromPrivate(appPrivateKey)
            putFile(publicKeyFile, JSON.stringify({key: publicKey}), { encrypt: false }).then(() => 
            {
                if (window && window["userBlockstackData"] && window["userBlockstackData"].setPublicKey) {
                    window["userBlockstackData"].setPublicKey(username, publicKey)
                }
                resolve()
            }).catch((err) => reject(err))
        })
    }

    static openNewChat (title, description) {
        return new Promise(function (resolve, reject) {
            var username = BlockstackManager.getLoggedUsername()
            BlockstackManager._getChatIds(username).then((chatIds) =>
            {
                var id = BlockstackManager.generateUUID()
                if (chatIds) {
                    chatIds.push(id)
                } else {
                    chatIds = [id]
                }
                var dataToSave = []
                var chatInfo = {id: id, title:title, description:description};
                dataToSave.push([currentInfoFile, chatInfo])
                dataToSave.push([chatsIdFile, chatIds])
                BlockstackManager._saveMultipleFiles(dataToSave).then(() =>
                {
                    ServerManager.setChat(id).then(() => resolve(chatInfo)).catch((err) => reject(err))
                }).catch((err) => reject(err))
            }).catch((err) => reject(err))
        }) 
    }

    static saveCurrentInfoFile(chatInfo){
        return new Promise(function(resolve, reject){
            putFile(currentInfoFile, JSON.stringify(chatInfo), { encrypt: false }).then(() => resolve()).catch((err) => reject(err))
        })
    }

    static getMyChat (broadcastUsername, chatId = null) {
        return new Promise(function (resolve, reject) {
            if (chatId) {
                BlockstackManager._getMyChat(broadcastUsername, chatId).then((messages) => resolve(messages)).catch((err) => reject(err))
            } else {
                BlockstackManager.getCurrentChatInfo(broadcastUsername).then((storedChatInfo) =>
                {
                    var storedChatId = storedChatInfo.id
                    BlockstackManager._getMyChat(broadcastUsername, storedChatId).then((messages) => resolve(messages)).catch((err) => reject(err))
                }).catch((err) => reject(err))
            }
        })
    }

    static _getMyChat (broadcastUsername, chatId) {
        return new Promise(function (resolve, reject) {
            if (chatId) {
                BlockstackManager._getPublicFile(`${broadcastUsername}.${chatId}.json`, null).then((messages) => 
                {
                    if (messages) {
                        BlockstackManager.sortChat(messages)
                        resolve(messages)
                    } else {
                        resolve([])
                    }
                }).catch((err) => reject(err))
            } else {
                resolve([])
            }
        })
    }

    static getCurrentChat (id) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._getChat(null, id).then((messages) => 
            {
                if (messages) {
                    BlockstackManager.sortChat(messages)
                    resolve(messages)
                } else {
                    resolve([])
                }
            }).catch((err) => reject(err))
        })
    }

    static _saveChat (id, chatMessages) {
        return new Promise(function (resolve, reject) {
            putFile(id + ".json", JSON.stringify(chatMessages), { encrypt: false }).then(() => resolve()).catch((err) => reject(err))
        })
    }

    static getSyncedChat (broadcastUsername) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._getChatIds(broadcastUsername).then((chatIds) =>
            {
                if (chatIds && chatIds.length > 0) {
                    var promises = []
                    for (var i = 0; i < chatIds.length; ++i) {
                        promises.push(BlockstackManager._getChat(broadcastUsername, chatIds[i]))
                    }
                    Promise.all(promises).then((response) => 
                    {
                        var messages = []
                        var promisesSync = []
                        var promisesKeys = []
                        var pendingKeyMessages = []
                        var username = BlockstackManager.getLoggedUsername()
                        for (var i = 0; i < response.length; ++i) {
                            if (response[i]) {
                                if (username === broadcastUsername) {
                                    promisesSync.push(BlockstackManager._syncPendingPayments(response[i], broadcastUsername, chatIds[i]))
                                } else {
                                    for (var j = 0; j < response[i].length; ++j) {
                                        pendingKeyMessages.push(response[i][j])
                                        promisesKeys.push(BlockstackManager._getPublicKey(BlockstackManager.getUsername(response[i][j])))
                                    }
                                }
                            }
                        }
                        if (promisesSync.length === 0 && promisesKeys.length === 0) {
                            resolve(messages)
                        } else if (promisesSync.length === 0) {
                            Promise.all(promisesKeys).then((publicKeys) => 
                            {
                                for (var i = 0; i < publicKeys.length; ++i) {
                                    if (BlockstackManager._isValidSignature(pendingKeyMessages[i], broadcastUsername, publicKeys[i])) {
                                        messages.push(pendingKeyMessages[i])
                                    }
                                }
                                BlockstackManager.sortChat(messages)
                                resolve(messages)
                            }).catch((err) => reject(err))
                        } else {
                            Promise.all(promisesSync).then((chatMessages) => 
                            {
                                for (var i = 0; i < chatMessages.length; ++i) {
                                    for (var j = 0; j < chatMessages[i].length; ++j) {
                                        messages.push(chatMessages[i][j])
                                    }
                                }
                                BlockstackManager.sortChat(messages)
                                resolve(messages)
                            }).catch((err) => reject(err))
                        }
                    }).catch((err) => reject(err))
                } else {
                    resolve([])
                }
            }).catch((err) => reject(err))
        }) 
    }

    static _syncPendingPayments (chatMessages, broadcastUsername, chatId) {
        return new Promise(function (resolve, reject) {
            if (chatMessages.length > 0) {
                var promises = []
                var paidMessages = []
                var savedMessages = []
                for (var i = 0; i < chatMessages.length; ++i) {
                    if (BlockstackManager.getPaymentStatus(chatMessages[i]) === 2) {
                        paidMessages.push(chatMessages[i])
                        promises.push(ServerManager.checkPayment(broadcastUsername, BlockstackManager.getMessageId(chatMessages[i]), BlockstackManager.getUsername(chatMessages[i])))
                    } else {
                        savedMessages.push(chatMessages[i])
                    }
                }
                if (promises.length > 0) {
                    Promise.all(promises).then((result) =>
                    {
                        var usernamesToSave = []
                        var usernamesNotToSave = []
                        for (var i = 0; i < result.length; ++i) {
                            if (result[i].status === "paid") {
                                paidMessages[i][6] = result[i].amount
                                paidMessages[i][5] = 1
                                usernamesToSave.push(BlockstackManager.getUsername(paidMessages[i]))
                            } else if (result[i].status === "unpaid") {
                                paidMessages[i][5] = 0
                                usernamesToSave.push(BlockstackManager.getUsername(paidMessages[i]))
                            } else {
                                usernamesNotToSave.push(BlockstackManager.getUsername(paidMessages[i]))
                            }
                            savedMessages.push(paidMessages[i])
                        }
                        var validUsers = []
                        for (var j = 0; j < usernamesToSave.length; ++j) {
                            var shouldSync = true
                            for (var k = 0; k < usernamesNotToSave.length; ++k) {
                                if (usernamesToSave[j] === usernamesNotToSave[k]) {
                                    shouldSync = false
                                    break
                                }
                            }
                            if (shouldSync) {
                                validUsers.push(usernamesToSave[j])
                            }
                        }
                        if (validUsers.length > 0) {
                            BlockstackManager._saveSyncChat(savedMessages, chatId, validUsers, []).then(() => resolve(savedMessages)).catch((err) => reject(err))
                        } else {
                            resolve(savedMessages)
                        }
                    }).catch((err) => reject(err))
                } else {
                    resolve(savedMessages)
                }
            } else {
                resolve(chatMessages)
            }
        })
    }

    static getCurrentChatInfo (username) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._getPublicFile(currentInfoFile, username).then((file) => 
            {
                if (file) {
                    resolve(file)
                } else {
                    resolve()
                }
            }).catch((err) => reject(err))
        })
    }

    static sortChat (messages) {
        messages.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    }

    static _getChat (username, id) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._getPublicFile(id + ".json", username).then((file) => 
            {
                if (file) {
                    resolve(file)
                } else {
                    resolve([])
                }
            }).catch((err) => reject(err))
        })
    }

    static _getChatIds (username) {
        return new Promise(function (resolve, reject) {
            BlockstackManager._getPublicFile(chatsIdFile, username).then((file) => 
            {
                if (file) {
                    resolve(file)
                } else {
                    resolve([])
                }
            }).catch((err) => reject(err))
        })
    }
    
    static generateUUID () { 
        var d = 0;
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            d = performance.now() * 1000
        } else if (typeof Date.now !== 'undefined' && typeof Date.now === 'function') {
            d = Date.now()
        } else {
            d = (new Date()).getTime()
        }
        var h=['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
        var k=['x','x','x','x','x','x','x','x','-','x','x','x','x','-','4','x','x','x','-','y','x','x','x','-','x','x','x','x','x','x','x','x','x','x','x','x'];
        var u='',i=0,rb=((d + Math.random() * 16) % 16 | 0)*0xffffffff|0;
        while(i++<36) {
            var c=k[i-1],r=rb&0xf,v=c==='x'?r:(r&0x3|0x8);
            u+=(c==='-'||c==='4')?c:h[v];rb=i%8===0?Math.random()*0xffffffff|0:rb>>4
        }
        return u
    }

    static _getPublicFile (fileName, username) {
        return new Promise(function (resolve, reject) {
            var options = { decrypt: false }
            if (username) {
                options["username"] = username
            }
            getFile(fileName, options).then((file) => 
            {
                if (file) {
                    resolve(JSON.parse(file))
                } else {
                    resolve()
                }
            }).catch((err) => reject(err))
        })
    }

    static _getFileUrl (arrayBuffer, type) {
        return URL.createObjectURL(new Blob([new Uint8Array(arrayBuffer)],{type: type}))
    }

    static _deleteFile (fileName) {
        return new Promise(function (resolve, reject) {
            deleteFile(fileName).then(() => 
            {
                resolve()
            }).catch((err) => reject(err))
        })
    }

    static _saveMultipleFiles (data) {
        return new Promise(function (resolve, reject) {
            var promises = []
            for (var i = 0; i < data.length; ++i) {
                promises.push(putFile(data[i][0], JSON.stringify(data[i][1]), { encrypt: false }))
            }
            Promise.all(promises).then(() => resolve()).catch((err) => 
            {
                for (var i = 0; i < data.length; ++i) {
                    var fileName = data[i][0]
                    setTimeout(() => BlockstackManager._deleteFile(fileName), 1000)
                }
                reject(err)
            })
        })
    }
}
