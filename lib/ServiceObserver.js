'use strict';

const EventEmitter = require('events');
const util = require('util');
const _ = require('lodash');
const helpers = require('./helpers');

class ServiceObserver extends EventEmitter {
  constructor (options) {
    super();

    this._consul = helpers.checkOptionsAndCreateConsulObject(options);

    if (_.has(options, 'notifyNotesChange')) {
      if (_.isBoolean(options.notifyNotesChange)) {
        throw new Error('options.notifyNotesChange must be a bool');
      }

      this._notifyNotesChange = options.notifyNotesChange;
    } else {
      this._notifyNotesChange = false;
    }

    if (_.has(options, 'notifyOutputChange')) {
      if (_.isBoolean(options.notifyNotesChange)) {
        throw new Error('options.notifyOutputChange must be a bool');
      }

      this._notifyOutputChange = options.notifyOutputChange;
    } else {
      this._notifyOutputChange = false;
    }

    this._checkOptions = new Map();
    this._watches = new Map();
    this._services = new Map();
    this._allNodes = new Map();
    this._healhtyNodes = new Map();
    this._problemNodes = new Map();
  }

  getNodes(serviceName) {
    return this._getNodeData(this._allNodes, serviceName);
  }

  getHealthyNodes(serviceName) {
    return this._getNodeData(this._healhtyNodes, serviceName);
  }

  getProblemNodes(serviceName) {
    return this._getNodeData(this._problemNodes, serviceName);
  }

  getNodeInfo(serviceName, nodeAddress, serviceId) {
    if (!this._services.has(serviceName)) {
      return null;
    }

    let services = this._services.get(serviceName);
    let key = nodeAddress + '-' + serviceId;
    if (!_.has(services, key)) {
      return null;
    }

    return services[key];
  }

  watch(serviceName, intervalSec, options = {}) {
    if (!_.isInteger(intervalSec)) {
      throw new Error(util.format('intervalSec argument must be an int but %j was passed', typeof intervalSec));
    }

    if (intervalSec < 1) {
      throw new Error(util.format('intervalSec argument must be a non-zero positive integer', intervalSec));
    }

    if (!_.isString(serviceName)) {
      throw new Error(util.format('serviceName argument must be a string but %j was passed', typeof serviceName));
    }

    if (!_.isObject(options)) {
      throw new Error(util.format('options argument must be an array but %j was passed', typeof options));
    }

    options.service = serviceName;

    if (this._checkOptions.has(serviceName)) {
      if (_.isEqual(this._checkOptions.get(serviceName), options)) {
        return true;
      } else {
        throw new Error(
          util.format('Service %s is already registered with options that differs from passed', serviceName)
        );
      }
    }

    this._validateWatchOptions(options);

    this._watches.set(serviceName, true);
    this._services.set(serviceName, null);
    this._allNodes.set(serviceName, []);
    this._healhtyNodes.set(serviceName, []);
    this._problemNodes.set(serviceName, []);
    this._checkOptions.set(serviceName, options);
    this._repeatedCheck(serviceName, intervalSec);
  }

  unwatch(serviceName) {
    let allNodesAtThisMoment = [];
    if (this._allNodes.has(serviceName)) {
      allNodesAtThisMoment = this._allNodes.get(serviceName);
    }

    if (this._watches.has(serviceName)) {
      this._watches.delete(serviceName);
      this._checkOptions.delete(serviceName);
      this._services.delete(serviceName);
      this._allNodes.delete(serviceName, []);
      this._healhtyNodes.delete(serviceName, []);
      this._problemNodes.delete(serviceName, []);
    }

    return allNodesAtThisMoment;
  }

  _getNodeData(objectToUse, serviceName) {
    if (!objectToUse.has(serviceName)) {
      return [];
    }

    return objectToUse.get(serviceName);
  }

  _compareWithNewData(serviceName, newData) {
    let result = {
      gone: [],
      arrived: [],
      changed: {
        addressOrPort: [],
        checks: [],
      },
    };

    let oldData = this._services.get(serviceName);
    let oldKeys = _.keys(oldData);
    let newKeys = _.keys(newData);
    let goneServices = _.difference(oldKeys, newKeys);
    let arrivedServices = _.difference(newKeys, oldKeys);
    let unchangedServices = _.intersection(newKeys, oldKeys);

    if (goneServices.length > 0) {
      goneServices.forEach(goneService => {
        result.gone.push(oldData[goneService]);
      });
    }

    if (arrivedServices.length > 0) {
      arrivedServices.forEach(arrivedService => {
        result.arrived.push(newData[arrivedService]);
      });
    }

    if (unchangedServices.length > 0) {
      unchangedServices.forEach(unchangedService => {
        let oldServiceData = oldData[unchangedService];
        let newServiceData = newData[unchangedService];
        if (oldServiceData.ServiceAddress !== newServiceData.ServiceAddress ||
          oldServiceData.ServicePort !== newServiceData.ServicePort
        ) {
          result.changed.addressOrPort.push({
            Old: oldServiceData,
            New: newServiceData,
          });
        }

        let oldCheckKeys = _.keys(oldServiceData.Checks);
        let newCheckKeys = _.keys(newServiceData.Checks);

        let commonChecks = _.intersection(oldCheckKeys, newCheckKeys);
        if (commonChecks.length !== oldCheckKeys.length) {
          result.changed.checks.push({
            Old: oldServiceData,
            New: newServiceData,
          });

          return;
        }

        commonChecks.forEach(checkId => {
          let oldCheckIdData = oldServiceData.Checks[checkId];
          let newCheckIdData = newServiceData.Checks[checkId];
          if ((oldCheckIdData.Status !== newCheckIdData.Status) ||
            (this._notifyNotesChange && (oldCheckIdData.Notes !== newCheckIdData.Notes)) ||
            (this._notifyOutputChange && (oldCheckIdData.Output !== newCheckIdData.Output))
          ) {
            result.changed.checks.push({
              Old: oldServiceData,
              New: newServiceData,
            });

            return;
          }
        });
      });
    }

    return result;
  }

  _repeatedCheck(serviceName, intervalSec) {
    if (!this._watches.has(serviceName)) {
      return;
    }

    if (!this._checkOptions.has(serviceName)) {
      this.emit('error', new Error(util.format('checkOptions for service `%s` was not found', serviceName)));
      return;
    }

    let options = this._checkOptions.get(serviceName);
    if (!_.isObject(options)) {
      this.emit('error', new Error(util.format(
        'checkOptions for service `%s` must be object but %s was found',
        serviceName,
        typeof options
      )));

      return;
    }

    let promise = this._consul.health.service(this._checkOptions.get(serviceName));

    promise.then(services => {
      if (!this._watches.has(serviceName)) {
        return;
      }

      let actualData = {};
      let allNodes = [];
      let healthyNodes = [];
      let problemNodes = [];

      services.forEach(service => {
        let nodeAddress = service.Node.Address;
        let serviceAddress = service.Service.Address;
        let servicePort = service.Service.Port;
        let serviceId = service.Service.ID;

        let checks = {};
        let problemChecks = [];

        service.Checks.forEach(check => {
          let checkId;
          if (!_.isEmpty(serviceId) && check.CheckID.startsWith(serviceId + '.')) {
            checkId = check.CheckID.substring(serviceId.length + 1);
          } else {
            checkId = check.CheckID;
          }

          let output = check.Output;

          checks[checkId] = {
            CheckID: checkId,
            Name: check.Name,
            Status: check.Status,
            Output: output,
            Notes: check.Notes,
          };

          if (check.Status !== 'passing') {
            problemChecks.push({
              id: checkId,
              status: check.Status,
            });
          }

          actualData[nodeAddress + '-' + serviceId] = {
            NodeAddress: nodeAddress,
            ServiceAddress: serviceAddress,
            ServicePort: servicePort,
            Checks: checks,
          };
        });

        let nodeData = {
          ServiceId: serviceId,
          NodeAddress: nodeAddress,
          ServiceAddress: serviceAddress,
          ServicePort: servicePort,
        };

        allNodes.push(nodeData);

        if (problemChecks.length === 0) {
          healthyNodes.push(nodeData);
        } else {
          let problemNodeData = _.clone(nodeData);
          problemNodeData.checks = problemChecks;
          problemNodes.push(problemNodeData);
        }
      });

      this._allNodes.set(serviceName, allNodes);
      this._problemNodes.set(serviceName, problemNodes);
      this._healhtyNodes.set(serviceName, healthyNodes);

      if (this._services.get(serviceName) === null) {
        this._services.set(serviceName, actualData);
        this.emit('initialized', serviceName);
      } else {
        let comparison = this._compareWithNewData(serviceName, actualData);
        this._services.set(serviceName, actualData);

        if (comparison.gone.length > 0 || comparison.arrived.length > 0 ||
          comparison.changed.addressOrPort.length > 0 || comparison.changed.checks.length > 0
        ) {
          this.emit('changed', serviceName, comparison);
        }
      }
    }).catch((err) => {
      if (!this._watches.has(options.service)) {
        return;
      }

      this.emit('error', err);
    });

    setTimeout(() => this._repeatedCheck(serviceName, intervalSec), intervalSec * 1000);
  }

  _validateWatchOptions(options) {
    if (_.has(options, 'dc') && (!_.isString(options.dc) || _.isEmpty(options.dc))) {
      throw new Error('options.dc must be a non-empty string');
    }

    if (_.has(options, 'tag') && (!_.isString(options.tag) || _.isEmpty(options.tag))) {
      throw new Error('options.tag must be a non-empty string');
    }

    let unsupportedOptions = _.pull(_.keys(options), 'dc', 'tag', 'service');
    if (!_.isEmpty(unsupportedOptions)) {
      throw new Error(util.format('options contains unsupported keys %j', unsupportedOptions));
    }

    return true;
  }
}

module.exports = ServiceObserver;
