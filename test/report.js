var Report = require('../index.js').report.factory;
var assert = require('assert');
var errors = require('../lib/errors');

describe('rocketgate report api', function () {

    var service;

    beforeEach(function () {
        service = Report({MERCHANT_ID: 1, MERCHANT_PASSWORD: 'testpassword'});
    });

    describe('query', function () {

        it('should return the transations list', function (done) {
            service.query({
                fromDate: '20-september-14',
                respc_id: '0',
                ttype_id: '3,2',
                tstate_id: 'TRUE'
            }).then(function (result) {
                assert(result.DATA, 'DATA should be defined');
                done();
            }, function (err) {
                console.log(err);
            });
        });

        it('should reject the promise with gateway report api', function (done) {
            service.query({
                fromDate: '20-blah-14',
                tstate_id: 'TRUE'
            }).then(function (result) {
                throw new Error('should not get here');
            }, function (err) {
                assert(err instanceof errors.RocketGateReportError);
                assert.equal(err.message, 'Invalid Date: FromDate');
                done();
            });
        });
    });

});
