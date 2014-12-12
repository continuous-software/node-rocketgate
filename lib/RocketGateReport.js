var _ = require('lodash');
var assert = require('assert');
var Promise = require('bluebird');
var request = require('request');
var toJson = require('xml2json').toJson;
var errors = require('./errors.js');

function RocketGateReport(options) {

    assert(options.MERCHANT_ID, 'MERCHANT_ID is a mandatory field');
    assert(options.MERCHANT_PASSWORD, 'MERCHANT_PASSWORD is a mandatory field');

    this.endpoint = options.TEST_MODE === false
    ? 'https://my.rocketgate.com/com/rocketgate/gateway/xml/Transactions.cfc'
    : 'https://dev-my.rocketgate.com/com/rocketgate/gateway/xml/Transactions.cfc';

    _.assign(this, options);

}

RocketGateReport.prototype.query = function query(params) {

    return new Promise(function (resolve, reject) {
        params.method = 'lookupTransaction';
        params.returnFormat = 'JSON';
        params.merch_id = this.MERCHANT_ID;
        params.gatewayPassword = this.MERCHANT_PASSWORD;

        request.get({url: this.endpoint, qs: params}, function (err, res, body) {

            var errorObject;

            if (err) {
                reject(err);
            } else {

                //web service has returned error
                if (res.headers['content-type'].indexOf('xml') !== -1) {
                    errorObject = JSON.parse(toJson(body)).xml;
                    reject(new errors.RocketGateReportError(errorObject));
                } else {

                    // send back result with "//" at the start of the object
                    resolve(JSON.parse(body.substr(2)));
                }
            }
        });
    }.bind(this));
};

module.exports = RocketGateReport;


