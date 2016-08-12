'use strict';

const util = require('util');
const _ = require('lodash');
const helpers = require('./helpers');

class ServiceRegistrator {
  constructor (options, serviceName) {
    if (!_.isString(serviceName) || _.isEmpty(serviceName)) {
      throw new Error('serviceName must be a string');
    }

    this._active = false;
    this._consul = helpers.checkOptionsAndCreateConsulObject(options);
    this._serviceName = serviceName;
    this._serviceId = serviceName + '.' + process.pid;
    this._address = null;
    this._port = null;
    this._tags = null;
    this._checks = null;
  }

  addHttpCheck(id, name, url, interval, ttl, notes = null) {
    let check = {
      id: this._serviceId + '.' + id,
      serviceid: this._serviceId,
      name: name,
      http: url,
      interval: interval,
      ttl: ttl,
    };

    if (notes !== null) {
      check.notes = notes;
    }

    if (!this._active) {
      if (this._checks === null) {
        this._checks = [check];
      } else {
        this._checks.push(check);
      }

      return Promise.resolve();
    } else {
      return new Promise((resolve, reject) => {
        this._consul.agent.check.register(check)
          .then(() => {
            if (this._checks === null) {
              this._checks = [check];
            } else {
              this._checks.push(check);
            }

            resolve();
          })
          .catch(err => reject(err));
      });
    }
  }

  getServiceId () {
    return this._serviceId;
  }

  getServiceName () {
    return this._serviceName;
  }

  enableMaintenanceMode(reason = '') {
    try {
      this._validateMaintenanceData(reason);
    } catch (err) {
      return Promise.reject(err);
    }

    return this._consul.agent.service.maintenance({
      id: this.getServiceId(),
      enable: true,
      reason: reason,
    });
  }

  disableMaintenanceMode(reason = '') {
    try {
      this._validateMaintenanceData(reason);
    } catch (err) {
      return Promise.reject(err);
    }

    return this._consul.agent.service.maintenance({
      id: this.getServiceId(),
      enable: false,
      reason: reason,
    });
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

    this._active = true;

    if (_.isArray(this._checks) && !_.isEmpty(this._checks)) {
      return new Promise((resolve, reject) => {
        this._consul.agent.service.register(options)
          .then(() => {
            let checkRegisterPromises = this._checks.map(check => this._consul.agent.check.register(check));
            return Promise.all(checkRegisterPromises);
          })
          .then(() => resolve())
          .catch(err => {
            this.deregister()
              .then(() => {
                reject(new Error(util.format(
                  'Can not register one of checks for the service `%s`, failed with error: %s',
                  this._serviceId,
                  err
                )));
              })
              .catch(deregisterErr => {
                reject(new Error(util.format(
                  'Can not register one of checks for the service `%s`, failed with error: %s and failed to ' +
                    'deregister just started service due to error: `%s`',
                  this._serviceId,
                  err,
                  deregisterErr
                )));
              });
          });
      });
    } else {
      return this._consul.agent.service.register(options);
    }
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
    this._active = false;
    return this._consul.agent.service.deregister(this._serviceId);
  }

  _validateMaintenanceData(reason) {
    if (!this._active) {
      throw new Error(
        util.format('Can not enable maintenance mode because service `%s` is not active', this._serviceId)
      );
    }

    if (!_.isString(reason)) {
      throw new Error(
        util.format('Reason must be a string, but received %s', typeof reason)
      );
    }
  }
}

module.exports = ServiceRegistrator;
