[![Build Status](https://travis-ci.org/continuous-software/node-rocketgate.svg?branch=master)](https://travis-ci.org/continuous-software/node-rocketgate) [![Greenkeeper badge](https://badges.greenkeeper.io/continuous-software/node-rocketgate.svg)](https://greenkeeper.io/)

![node-rocketgate](http://rocketgate.com/images/logo_rocketgate.png)

## Installation ##

    $ npm install -s rocketgate

## Usage

```javascript
var RocketGate = require('rocketgate');
var client = new RocketGate.gateway({
    MERCHANT_ID: <PLACEHOLDER>,
    MERCHANT_PASSWORD: '<PLACEHOLDER>'
});
```

## Gateway API

This SDK is natively compatible with [42-cent](https://github.com/continuous-software/42-cent).  
It implements the [BaseGateway](https://github.com/continuous-software/42-cent-base) API.
