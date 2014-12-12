var BaseGateway = require('42-cent-base').BaseGateway;
var GatewayError = require('42-cent-base').GatewayError;
var assert = require('assert');
var util = require('util');
var Promise = require('bluebird');
var mapKeys = require('42-cent-util').mapKeys;
var request = require('request');
var toXml = require('json2xml');
var toJson = require('xml2json').toJson;
var schema = require('./schemas.js');
var reasonCodes = require('./reasonCodes.js');

var creditCardSchema = schema.creditCard;
var prospectSchema = schema.prospect;

var months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function toDateString(date) {
  var year = date.getUTCFullYear().toString().substr(2);
  var month = months[date.getUTCMonth()];
  var day = date.getUTCDate().toString();
  return day + '-' + month + '-' + year;
}

function resolveHost(gateway, guid) {

  var hosts = gateway.testMode === true ? gateway.rocketGateTestHosts : gateway.rocketGateHosts;
  var dns = gateway.testMode === true ? gateway.rocketGateTestHosts[0] : gateway.rocketGateDNS;
  var siteString = '0x';
  var tokens = dns.split('.');
  var subDomain = tokens.shift();

  if (!guid) {
    return hosts;
  }
  guid = guid.toString();
  siteString += guid.length > 15 ? guid.substring(0, 2) : guid.substring(0, 1);
  siteString = +(siteString);

  hosts = [subDomain + '-' + siteString].concat(tokens).join('.');
  return [hosts];
}

/**
 *
 * @param {Object} options - must at least have the credentials MERCHANT_ID and MERCHANT_PASSWORD
 * @constructor
 * @augment BaseGateway
 */
function RocketGateGateway(options) {

  assert(options.MERCHANT_ID, 'MERCHANT_ID is a mandatory field');
  assert(options.MERCHANT_PASSWORD, 'MERCHANT_PASSWORD is a mandatory field');

  this.testMode = false;
  this.rocketGateDNS = 'gw.rocketgate.com';
  this.rocketGateHosts = ['gw-16.rocketgate.com', 'gw-17.rocketgate.com'];
  this.rocketGateTestHosts = ['dev-gw.rocketgate.com'];
  this.rocketGateServlet = '/gateway/servlet/ServiceDispatcherAccess';
  this.rocketGateProtocol = 'https:';
  this.rocketGatePortNumber = '443';
  this.rocketGateConnectTimeout = 10;
  this.rocketGateUserAgent = 'RG Client - Node 1.0';

  BaseGateway.call(this, options);
}

util.inherits(RocketGateGateway, BaseGateway);

RocketGateGateway.prototype.sendRequest = function (params, guid) {
  try {
    var xmlBody;
    var post = Promise.promisify(request.post);

    util._extend(params, {
      merchantID: this.MERCHANT_ID,
      merchantPassword: this.MERCHANT_PASSWORD,
      version: 'R1.2'
    });

    xmlBody = toXml({gatewayRequest: params}, {header: true});

    var uri = {
      protocol: this.rocketGateProtocol,
      hostname: resolveHost(this, guid)[0],
      port: this.rocketGatePortNumber,
      pathname: this.rocketGateServlet
    };
  } catch (e) {
    return Promise.reject(e);
  }

  return post(uri, {
    body: xmlBody,
    headers: {
      'Content-Type': 'text/xml',
      'Content-Length': xmlBody.length,
      'User-Agent': this.rocketGateUserAgent
    },
    timeout: this.rocketGateConnectTimeout * 10000
  }).spread(function (res, body) {
    var json = JSON.parse(toJson(body)).gatewayResponse;

    if (json.reasonCode !== 0) {
      throw new GatewayError(reasonCodes[json.reasonCode.toString()] || 'Unknown error from the gateway', json);
    }
    return json;
  });
};

/**
 * @inheritDoc
 */
RocketGateGateway.prototype.submitTransaction = function submitTransaction(order, creditCard, prospect, other) {

  var params = {
    transactionType: 'CC_PURCHASE',
    amount: order.amount
  };
  var self = this;
  var output;

  mapKeys(creditCard, creditCardSchema, params);
  mapKeys(prospect, prospectSchema, params);
  util._extend(params, other);

  return this.sendRequest(params)
    .then(function (res) {
      output = {
        transactionId: res.guidNo,
        authCode: res.authNo,
        _original: res
      };
      return self.confirmTransaction(res.guidNo);
    })
    .then(function (res) {
      return output;
    });

};

/**
 * @inheritDoc
 */
RocketGateGateway.prototype.authorizeTransaction = function (order, creditCard, prospect, other) {
  var params = {
    transactionType: 'CC_AUTH',
    amount: order.amount
  };
  var self = this;
  var output;

  mapKeys(creditCard, creditCardSchema, params);
  mapKeys(prospect, prospectSchema, params);
  util._extend(params, other);

  return self.sendRequest(params)
    .then(function (res) {
      output = {
        transactionId: res.guidNo,
        authCode: res.authNo,
        _original: res
      };
      return self.confirmTransaction(res.guidNo);
    })
    .then(function (res) {
      return output;
    });
};

/**
 * @inheritDoc
 */
RocketGateGateway.prototype.voidTransaction = function voidTransaction(transactionId, other) {
  var params = {
    transactionType: 'CC_VOID',
    referenceGUID: transactionId
  };

  util._extend(params, other);

  return this.sendRequest(params, transactionId)
    .then(function (res) {
      return {
        _original: res
      };
    });
};

/**
 * @inheritDoc
 */
RocketGateGateway.prototype.refundTransaction = function refundTransaction(transactionId, other) {
  var params = {
    transactionType: 'CC_CREDIT',
    referenceGUID: transactionId
  };

  return this.sendRequest(params, transactionId)
    .then(function (res) {
      return {
        _original: res
      };
    });
};

/**
 * @inheritDoc
 *
 * note the following tuple will result in a specific rebill frequency value
 * {periodUnit: 'months', periodLength:4} -> 'QUARTERLY'
 * {periodUnit: 'months', periodLength:6} -> 'SEMI-ANNUALLY'
 * {periodUnit: 'months', periodLength:12} -> 'ANNUALLY'
 * Note RocketGate does not really support trial period but rather a one shot fee to charge during the subscription plan registration
 * so the trialAmount amount can not be different from the amount except if the trial period is a one shot fee
 */
RocketGateGateway.prototype.createSubscription = function createSubscription(cc, prospect, subPlan, other) {
  var rebill = {
    rebillCount: +(subPlan.iterationCount) - 1,
    rebillAmount: +(subPlan.amount)
  };
  var feeAmount = +(subPlan.amount);

  switch (subPlan.periodUnit) {
    case 'months':
    {
      if (subPlan.periodLength == 4) {
        rebill.rebillFrequency = 'QUARTERLY'
      } else if (subPlan.periodLength == 6) {
        rebill.rebillFrequency = 'SEMI-ANNUALLY';
      } else if (subPlan.periodLength == 12) {
        rebill.rebillFrequency = 'ANNUALLY';
      } else {
        rebill.rebillFrequency = 'MONTHLY';
      }

      break;
    }
    case 'days':
    {
      rebill.rebillFrequency = subPlan.periodLength;
      break;
    }
    default :
    {
      rebill.rebillFrequency = 'MONTHLY'
    }
  }

  if (subPlan.trialAmount) {
    rebill.rebillAmount = subPlan.amount;
    feeAmount = subPlan.trialAmount;
    //trial period of one
    rebill.rebillCount += 1;
  } else if (subPlan.trialCount) {
    rebill.rebillCount += +(subPlan.trialCount);
  }

  rebill.rebillStart = Math.floor((new Date(subPlan.startingDate).getTime() - Date.now()) / (3600 * 1000 * 24));

  util._extend(rebill, other);

  return this.submitTransaction({amount: feeAmount}, cc, prospect, rebill)
    .then(function (res) {
      return {
        subscriptionId: res.transactionId,
        _original: res._original
      };
    });
};

RocketGateGateway.prototype.confirmTransaction = function confirmTransaction(transactionId) {
  var params = {
    transactionType: 'CC_CONFIRM',
    referenceGUID: transactionId
  };

  return this.sendRequest(params, transactionId)
    .then(function (res) {
      return res;
    });
};

/**
 * @inheritsDoc
 * Note this simply authorizes a transaction (for a 1 dollar transaction) in order to create a token to be used for later transactions
 * merchantCustomerID must be provided in the "other" argument (it is a identifier for the customer in the merchant system)
 */
RocketGateGateway.prototype.createCustomerProfile = function createCustomerProfile(cc, billing, shipping, other) {

  var prospect = {};
  billing = billing || {};
  shipping = shipping || {};
  other = other || {};
  util._extend(prospect, billing);
  util._extend(prospect, shipping);

  return this.authorizeTransaction({amount: 1}, cc, prospect, other)
    .then(function (res) {
      return {
        _original: res._original,
        profileId: res._original.cardHash
      };
    });
};

/**
 * @inheritsDoc
 * Note the prospect var must contains a property "id" (the id of the customer in the merchant system)
 * It has to be the same used when you created the customer profile in the gateway system,
 * you can alternatively pass the "merchantCustomerID" in the other var
 */
RocketGateGateway.prototype.chargeCustomer = function chargeCustomer(order, prospect, other) {
  other = other || {};
  other.cardHash = prospect.profileId || '';
  other.merchantCustomerID = prospect.id || '';
  return this.submitTransaction(order, {}, prospect, other);
};

//RocketGateGateway.prototype.getSettledBatchList = function getSettledBatchList(from, to) {
//
//    var fromDate = new Date(from);
//    var toDate = to ? new Date(to) : new Date();
//    var queryObject = {
//        fromDate: toDateString(fromDate),
//        fromHour: fromDate.getUTCHours(),
//        toDate: toDateString(toDate),
//        toHour: toDate.getUTCHours(),
//        tstate_id: '4,6,7,8'
//    };
//
//    return this._report.query(queryObject).then(function (result) {
//        //todo would be clever to find property index based on column metadata
//        return _(result.DATA).groupBy('38').map(function (value, key) {
//            var batch = {
//                chargeAmount: 0,
//                chargeCount: 0,
//                refundAmount: 0,
//                refundCount: 0,
//                voidCount: 0,
//                declineCount: 0,
//                errorCount: 0,
//                batchId: key
//            };
//
//            _(value).forEach(function (tr) {
//
//                batch.settlementDate = tr[11].split(' ').slice(0, 3).join(' ');
//
//                if (tr[10] === 'SETTLED') {
//                    batch.chargeAmount += +(tr[21]);
//                    batch.chargeCount++;
//                }
//                else if (tr[10] === 'VOIDED') {
//                    batch.voidCount++;
//                }
//                else if (tr[10] === 'CREDITED') {
//                    batch.refundAmount += +(tr[21]);
//                    batch.refundCount++;
//                }
//                else if (tr[10] === 'TICKETED') {
//                    batch.errorCount++;
//                }
//            });
//
//            return batch;
//        }).value();
//    });
//};

module.exports = RocketGateGateway;

