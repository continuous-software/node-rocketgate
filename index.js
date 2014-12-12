var RocketGateway = require('./lib/RocketGateGateway.js');
var RocketGateReport = require('./lib/RocketGateReport.js');
var RocketGateReportErrors = require('./lib/errors.js');

module.exports = {
  report:  {
    factory: function factory(options) {
      return new RocketGateReport(options);
    },
    errors: RocketGateReportErrors
  },
  gateway: function (conf) {
    return new RocketGateway(conf);
  }
};
