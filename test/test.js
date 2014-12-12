var TestAccount = require('../settings/testAccount.js');
var RocketGate = require('../index.js');
var GatewayError = require('42-cent-base').GatewayError;
var model = require('42-cent-model');
var CreditCard = model.CreditCard;
var Prospect = model.Prospect;
var assert = require('assert');


describe('rocket gate service', function () {

  var service;

  beforeEach(function () {
    service = RocketGate.gateway(TestAccount);
    service.testMode = true;
  });

  describe('authorization and capture', function () {

    it('should submit a transaction', function (done) {

      var cc = {
        creditCardNumber: '4111111111111111',
        expirationYear: '2016',
        expirationMonth: '02',
        cvv: '999'
      };

      var prospect = {
        customerFirstName: 'Ellen',
        customerLastName: 'Johson',
        billingAddress: '14 Main Street',
        billingCity: 'Pecan Springs',
        billingZip: '44628',
        billingState: 'TX',
        billingCountry: 'USA',
        shippingFirstName: 'China',
        shippingLastName: 'Bayles',
        shippingAddress: '12 Main Street',
        shippingCity: 'Pecan Springs',
        shippingZip: '44628',
        shippingCountry: 'USA'
      };

      var order = {amount: '3.99'};

      service.submitTransaction(order, cc, prospect).then(function (result) {
        assert.equal(result.transactionId, result._original.guidNo, 'it should have the appropriate transactionId');
        assert.equal(result.authCode, result._original.authNo, 'it should have the appropriate authCode');
        done();
      });
    });

    it('should reject the promise when we get a web service error', function (done) {
      var cc = {
        expirationYear: '2010',
        expirationMonth: '02',
        cvv: '999'
      };

      var order = {amount: '3.99'};

      service.submitTransaction(order, cc, {}, {}).then(function (result) {
        throw new Error('should not get here');
      }, function (reason) {
        assert(reason instanceof GatewayError);
        assert.equal(reason.message, 'Rejected - Invalid Card Number', 'it should have the appropriate message');
        assert(reason._original, '_original should be defined');
        done();
      });
    });
  });

  describe('authorization only ', function () {
    it('should authorize  a transaction', function (done) {

      var cc = {
        creditCardNumber: '4111111111111111',
        expirationYear: '2016',
        expirationMonth: '02',
        cvv: '999'
      };

      var prospect = {
        customerFirstName: 'Ellen',
        customerLastName: 'Johson',
        billingAddress: '14 Main Street',
        billingCity: 'Pecan Springs',
        billingZip: '44628',
        billingState: 'TX',
        shippingFirstName: 'China',
        shippingLastName: 'Bayles',
        shippingAddress: '12 Main Street',
        shippingCity: 'Pecan Springs',
        shippingZip: '44628'
      };

      var order = {amount: '3.99'};

      service.authorizeTransaction(order, cc, prospect).then(function (result) {
        assert.equal(result.transactionId, result._original.guidNo, 'it should have the appropriate transactionId');
        assert.equal(result.authCode, result._original.authNo, 'it should have the appropriate authCode');
        done();
      });
    });

    it('should reject the promise when we get a web service error', function (done) {
      var cc = {
        expirationYear: '2010',
        expirationMonth: '02',
        cvv: '999'
      };

      var order = {amount: '3.99'};

      service.authorizeTransaction(order, cc, {}, {}).then(function (result) {
        throw new Error('should not get here');
      }, function (reason) {
        assert(reason instanceof GatewayError);
        assert.equal(reason.message, 'Rejected - Invalid Card Number', 'it should have the appropriate message');
        assert(reason._original, '_original should be defined');
        done();
      });
    });
  });

  xdescribe('getSettledBatchList', function () {

    it('should get statistic batch for a given window of time', function (done) {
      service.getSettledBatchList(new Date(Date.now() - 3 * 24 * 1000 * 3600)).then(function (result) {
        assert.equal(result.length, 3, 'it should have a batch per day');
        done();
      }, function (err) {
        throw new Error('should not get here');
      });
    });
  });

  describe('refund transaction', function () {

    it('should refund a transaction', function (done) {
      var cc = {
        creditCardNumber: '4111111111111111',
        expirationYear: '2016',
        expirationMonth: '02',
        cvv: '999'
      };
      var transId;

      service.submitTransaction({amount: Math.random() * 100}, cc, {})
        .then(function (res) {
          transId = res.transactionId;
          return service.refundTransaction(transId);
        })
        .then(function (re) {
          assert(re._original, 'original should be defined');
          done();
        });
    });

    it('should reject the promise when the gateway returns an error', function (done) {
      service.refundTransaction('1006666')
        .then(function () {
          throw new Error('should not get here');
        })
        .catch(function (err) {
          assert.equal(err.message, 'Declined – No matching transaction');
          assert(err._original, '_error should be defined');
          done();
        })
    });
  });

  describe('void transaction', function () {

    it('should void a transaction', function (done) {

      var cc = {
        creditCardNumber: '4111111111111111',
        expirationYear: '2016',
        expirationMonth: '02',
        cvv: '999'
      };

      var prospect = {
        customerFirstName: 'Ellen',
        customerLastName: 'Johson',
        billingAddress: '14 Main Street',
        billingCity: 'Pecan Springs',
        billingZip: '44628',
        billingState: 'TX',
        shippingFirstName: 'China',
        shippingLastName: 'Bayles',
        shippingAddress: '12 Main Street',
        shippingCity: 'Pecan Springs',
        shippingZip: '44628'
      };

      var order = {amount: '3.99'};

      var transId;
      service.authorizeTransaction(order, cc, prospect, {})
        .then(function (res) {
          transId = res.transactionId;
          return service.voidTransaction(transId);
        })
        .then(function (re) {
          assert(re._original, 'original should be defined');
          done();
        });
    });

    it('should reject the promise when the gateway returns an error', function (done) {
      service.voidTransaction('1006666')
        .then(function () {
          throw new Error('should not get here');
        })
        .catch(function (err) {
          assert.equal(err.message, 'Declined – No matching transaction');
          assert(err._original, '_error should be defined');
          done();
        });
    });
  });

  describe('create subscription', function () {

    it('should create a subscription profile', function (done) {

      var subscription = new model.SubscriptionPlan()
        .withAmount('5.55')
        .withIterationCount('5')
        .withPeriodLength(1)
        .withPeriodUnit('months')
        .withStartingDate(new Date(Date.now() + 24 * 3600 * 7 * 1000));
      var creditCard = new model.CreditCard()
        .withCreditCardNumber('4111111111111111')
        .withCvv('123')
        .withExpirationMonth('02')
        .withExpirationYear('2017');

      var prospect = new model.Prospect()
        .withCustomerFirstName('bob')
        .withCustomerLastName('leponge');

      //mandatory...
      var other = {
        merchantCustomerID: Date.now() + ".JSTest",
        merchantInvoiceID: Date.now() + ".Test"
      };


      return service.createSubscription(creditCard, prospect, subscription, other)
        .then(function (res) {
          assert(res.subscriptionId, 'subscriptionId should be defined');
          assert(res._original, '_original should be defined');
          done();
        });
    });
  });

  describe('create customer profile', function () {

    var random = Math.floor(Math.random() * 1000);

    it('should create a customer profile', function (done) {

      var cc = new CreditCard()
        .withCreditCardNumber('4111111111111111')
        .withExpirationMonth('12')
        .withExpirationYear('2014')
        .withCvv('123');

      var billing = {
        customerFirstName: 'bob',
        customerLastName: 'leponge',
        email: 'bob@eponge.com'
      };

      service.createCustomerProfile(cc, billing)
        .then(function (result) {
          assert(result.profileId, ' profileId Should be defined');
          assert(result._original, '_original should be defined');
          done();
        })
        .catch(function (err) {
          console.log(err);

        });
    });

    it('should reject the promise when the gateway return an error', function (done) {
      var cc = new CreditCard()
        .withCreditCardNumber('123')
        .withExpirationMonth('12')
        .withExpirationYear('2014')
        .withCvv('123');

      var billing = {
        customerFirstName: 'bob',
        customerLastName: 'leponge',
        email: 'bob@eponge.com'
      };

      service.createCustomerProfile(cc, billing)
        .then(function (result) {
          throw new Error('it should not get here');
        }, function (err) {
          assert(err._original, '_original should be defined');
          assert.equal(err.message, 'Rejected - Invalid Card Number');
          done();
        });
    });
  });

  describe('charge customer profile', function () {

    it('should charge a existing customer', function (done) {

      var merchantCustomerId = Date.now();

      var cc = new CreditCard()
        .withCreditCardNumber('4111111111111111')
        .withExpirationMonth('12')
        .withExpirationYear('2014')
        .withCvv('123');

      var billing = {
        customerFirstName: 'bob',
        customerLastName: 'leponge',
        email: 'bob@eponge.com'
      };

      service.createCustomerProfile(cc, billing, {}, {merchantCustomerID: merchantCustomerId})
        .then(function (result) {
          var randomAmount = Math.floor(Math.random() * 300);
          assert(result.profileId, ' profileId Should be defined');
          assert(result._original, '_original should be defined');

          //id is mandatory
          var prospect = {profileId: result.profileId, id: merchantCustomerId};

          return service.chargeCustomer({amount: randomAmount}, prospect);
        })
        .then(function (res) {
          assert.equal(res.transactionId, res._original.guidNo);
          assert(res._original, '_original should be defined');
          done();
        })
        .catch(function (err) {
          console.log(err);
        });
    });

    it('should reject the promise when the gateway return an error', function (done) {
      return service.chargeCustomer({amount: 234}, {profileId: '1234'})
        .then(function () {
          throw new Error('should not get here');
        }, function (err) {
          assert(err._original, '_original should be defined');
          assert.equal(err.message, 'Rejected - Invalid Customer ID');
          done();
        }
      );
    });
  });

});
