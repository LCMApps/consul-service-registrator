'use strict';

const _ = require('lodash');
const consul = require('consul');
const helpers = require('./helpers');
const EventEmitter = require('events');

class IpAddressDetector extends EventEmitter {
  constructor (options, logger = null) {
    super();

    if (!_.isObject(options) || _.isFunction(options)) {
      throw new Error('options must be an object');
    }

    if (!_.has(options, 'host') || !_.has(options, 'port')) {
      throw new Error('options must have host and port fields');
    }

    if (!_.isString(options.host) || _.isEmpty(options.host)) {
      throw new Error('options.host must be a non empty string');
    }

    if (!_.isInteger(options.port) || options.port <= 0) {
      throw new Error('options.port must be a positive integer');
    }

    if (logger !== null && (!_.isObject(logger) || !_.has(logger, 'log') || !_.isFunction(logger.log))) {
      throw new Error('logger is not valid instance of logger');
    }

    let consulOptions = {
      host: options.host,
      port: options.port,
      promisify: true,
    };

    if (!_.has(options, 'secure')) {
      consulOptions.secure = false;
    } else {
      if (!_.isBoolean(options.secure)) {
        throw new Error('options.secure must be boolean');
      }

      consulOptions.secure = options.secure;
    }

    this._consul = consul(consulOptions);
    this._logger = logger;
  }

  getLanAndWanAddress() {
    return new Promise((resolve, reject) => {
      try {
        let lanIp = this._getAddressFromEnv('LAN');
        let wanIp = this._getAddressFromEnv('WAN');
        if (lanIp !== false && wanIp !== false) {
          return resolve({ lanIp, wanIp });
        }
      } catch (err) {
        this.emit('error', err);
        if (this._logger !== null) {
          this._logger.log('error',
            'Can not detect LAN or WAN IPv4 address from env, so going to use consul agent data'
          );
        }
      }

      this._getLanAndWanFromConsul()
        .then(lanAndWan => resolve(lanAndWan))
        .catch(err => reject(err));
    });
  }

  _getLanAndWanFromConsul() {
    return this._consul.agent.self()
      .then(result => {
        if (!_.has(result, 'Config.AdvertiseAddr')) {
          throw new Error('Config.AdvertiseAddr section in /v1/agent/self is not found');
        }

        if (!_.has(result, 'Config.AdvertiseAddrWan')) {
          throw new Error('Config.AdvertiseAddr section in /v1/agent/self is not found');
        }

        if (!_.isString(result.Config.AdvertiseAddr) || !helpers.isIpV4Address(result.Config.AdvertiseAddr)) {
          throw new Error('Config.AdvertiseAddr in /v1/agent/self is not IPv4 address');
        }

        if (!_.isString(result.Config.AdvertiseAddrWan) || !helpers.isIpV4Address(result.Config.AdvertiseAddrWan)) {
          throw new Error('Config.AdvertiseAddrWan in /v1/agent/self is not IPv4 address');
        }

        return { lanIp: result.Config.AdvertiseAddr, wanIp: result.Config.AdvertiseAddrWan };
      });
  }

  _getAddressFromEnv(type) {
    if (type !== 'LAN' && type !== 'WAN') {
      throw new Error('Invalid type');
    }

    let envVariable = 'NODE_' + type + '_IP';
    if (_.has(process.env, envVariable)) {
      console.log(envVariable + ' is present', process.env[envVariable]);
      if (helpers.isIpV4Address(process.env[envVariable])) {
        return process.env[envVariable];
      } else {
        throw Error(envVariable + ' is not IPv4 address');
      }
    }

    return false;
  }
}

module.exports = IpAddressDetector;
