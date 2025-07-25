# Consul Service Registrator

[![NPM version](https://img.shields.io/npm/v/consul-service-registrator.svg)](https://www.npmjs.com/package/consul-service-registrator)
[![Release Status](https://github.com/LCMApps/consul-service-registrator/workflows/NPM%20Release/badge.svg)](https://github.com/LCMApps/consul-service-registrator/releases)
[![Build Status](https://travis-ci.org/LCMApps/consul-service-registrator.svg?branch=master)](https://travis-ci.org/LCMApps/consul-service-registrator)
[![Coverage Status](https://coveralls.io/repos/github/LCMApps/consul-service-registrator/badge.svg?branch=master)](https://coveralls.io/github/LCMApps/consul-service-registrator?branch=master)

Please, check the full documentation below.

**Table of Contents**

* [Installation and Usage](#installation)

# <a name="installation"></a>Installation and Usage

Using npm:
```shell
$ npm install --save consul-service-registrator
```

Using yarn:
```shell
$ yarn add consul-service-registrator
```

## Usage

Lib provides 3 classes:
- `IpAddressDetector`
- `ServiceObserver`
- `Registrator`

### IpAddressDetector

Class has a method `getLanAndWanFromConsul` that return Promise.

Method fetches from consul a response of `/v1/agent/self` and
* if both `Config.AdvertiseAddr` and `Config.AdvertiseAddrWan` are present
returns them back as `result.lanIp` and `result.wanIp` correspondingly;
* if both `DebugConfig.AdvertiseAddrLAN` and `DebugConfig.AdvertiseAddrWAN` are present
  returns them back as `result.lanIp` and `result.wanIp` correspondingly.

> Note. `Config` shows the explicitly defined configuration. `DebugConfig` shows how Consul interpreted and applied
> the configuration in practice. TaggedAddresses show explicitly set values that are delivered through gossip

```js
const {IpAddressDetector} = require('consul-service-registrator');

const consulConfig = {
    host: '127.0.0.1',
    port: 8500
};
const ipAddressDetector = new IpAddressDetector(consulConfig);

ipAddressDetector.getLanAndWanFromConsul().then(result => {
    console.log(result);
}).catch(err => {
    console.log(err);
})
```

> Check the `example` folder and you may find use cases.

### Registrator



## Development

