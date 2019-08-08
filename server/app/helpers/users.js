var JsonTokens = require('jsontokens');

class Users {
    constructor() {
    }
    static GetUser (authToken) {
        return this.GetPayload(authToken).username;
    };
    static GetEmail (authToken) {
        return this.GetPayload(authToken).email;
    };
    static GetPayload (authToken) {
        if (!authToken) {
            throw new Error(401, 'request unauthorized');
        }
        var decodedToken = null;
        try {
            decodedToken = (0, JsonTokens.decodeToken)(authToken);
        } catch(e) {
            throw new Error(401, e);
        }
        if (!decodedToken || !decodedToken.payload || !decodedToken.payload.username) {
            throw new Error(401, 'request unauthorized');
        }
        return decodedToken.payload;
    };   
}

module.exports = Users;