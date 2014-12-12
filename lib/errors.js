var util = require('util');
var _ = require('lodash');

function RocketGateReportError(error) {
    _.assign(this, error);
    Error.call(this);
}

util.inherits(RocketGateReportError, Error);

module.exports = {
    RocketGateReportError: RocketGateReportError
};
