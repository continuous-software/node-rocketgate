var RocketGateway = require('./lib/RocketGateGateway.js');

module.exports = function (conf) {
    return new RocketGateway(conf);
};