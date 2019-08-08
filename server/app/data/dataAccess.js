const Sequelize = require('sequelize');
const config = require('nconf');
const SqlString = require('sequelize/lib/sql-string');

Sequelize.DATE.prototype._stringify = function _stringify(date, options) {
    return this._applyTimezone(date, options).format('YYYY-MM-DD HH:mm:ss.SSS');
};

function getFormattedRawQuery(sql, replacements) {
    return SqlString.formatNamedParameters(sql, replacements, "+00:00", "mssql");
}

const sequelize = new Sequelize(config.get("DB_NAME"), config.get("DB_USER"), config.get("DB_PASSWORD"), {
    host: config.get("DB_HOST"),
    dialect: 'mssql',
    dialectOptions:{
        encrypt: true
    },
    operatorsAliases: false,
    define:{
        freezeTableName: true
    } 
});

module.exports = { sequelize, getFormattedRawQuery };