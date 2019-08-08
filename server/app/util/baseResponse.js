var baseResponse = function (res, next) {
    return function (err, result) {
        if (err) next(err);
        else {
            res.status(200).json(result).end();
        };
    }
}

module.exports = baseResponse;

