'use strict';

const _ = require('lodash');
const helpers = require('./helpers');

class ServiceRegistrator {
  constructor (consul, serviceName) {
    if (!_.isObject(consul) || _.isFunction(consul)) {
      throw new Error('argument must be an object');
    }

    if (!_.has(consul, '_opts.promisify') ||
      !_.has(consul, 'agent.service.register') ||
      !_.has(consul, 'agent.service.deregister')
    ) {
      throw new Error('argument must be an instance of Consul class');
    }

    if (!_.isBoolean(consul._opts.promisify) || !consul._opts.promisify) {
      throw new Error('consul must be created with promisify option');
    }

    if (!_.isString(serviceName) || _.isEmpty(serviceName)) {
      throw new Error('serviceName must be a string');
    }

    this._consul = consul;
    this._serviceName = serviceName;
    this._serviceId = serviceName + '.' + process.pid;
    this._address = null;
    this._port = null;
    this._tags = null;
    this._checks = null;
  }

  addHttpCheck(id, name, url, interval, timeout) {
    let check = {
      id: id,
      name: name,
      http: url,
      interval: interval,
      timeout: timeout,
    };

    if (this._checks === null) {
      this._checks = [check];
    } else {
      this._checks.push(check);
    }
  }

  getServiceName () {
    return this._serviceName;
  }

  register () {
    let options = {};

    options.name = this.getServiceName();

    if (this._address !== null) {
      options.address = this._address;
    }

    options.id = this._serviceId;

    if (this._port !== null) {
      options.port = this._port;
    }

    if (this._tags !== null) {
      options.tags = this._tags;
    }

    if (this._checks !== null) {
      options.checks = this._checks;
    }

    return this._consul.agent.service.register(options);
  }

  setAddress(address) {
    if (!_.isString(address)) {
      throw new Error('address must be a string');
    }

    if (!helpers.isIpV4Address(address)) {
      throw new Error('address must be an IPv4 IP address');
    }

    this._address = address;
  }

  setTags(tags) {
    if (!_.isArray(tags) || _.isEmpty(tags)) {
      throw new Error('tags must be an non-empty array');
    }

    tags.forEach((tag) => {
      if (!_.isString(tag) || _.isEmpty(tag)) {
        throw new Error('all elements of tag array must be a non-empty string');
      }
    });

    this._tags = tags;
  }

  setPort(port) {
    if (!_.isInteger(port)) {
      throw new Error('port must be an int');
    }

    if (port < 0 && port > 65535) {
      throw new Error('port must be between 0 and 65535');
    }

    this._port = port;
  }

  deregister () {
    return this._consul.agent.service.deregister(this._serviceId);
  }
}

module.exports = ServiceRegistrator;
