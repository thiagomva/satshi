var userBlockstackData = (function() {
    var usersBlockstackProfile = {};
    var usersBlockstackPublicKey = {};
    function _getProfile(username) {
        if (usersBlockstackProfile[username]) {
            return usersBlockstackProfile[username];
        } else {
            return null;
        }
    };
    function _setProfile(username, value) {
        usersBlockstackProfile[username] = value;
    };
    function _getPublicKey(username) {
        if (usersBlockstackPublicKey[username]) {
            return usersBlockstackPublicKey[username];
        } else {
            return null;
        }
    };
    function _setPublicKey(username, value) {
        usersBlockstackPublicKey[username] = value;
    };
    return { 
        getProfile: _getProfile, 
        setProfile: _setProfile,
        getPublicKey: _getPublicKey,
        setPublicKey: _setPublicKey
    };  
 })(); 