'use strict';

const _    = require('lodash');
const net  = require('net');
const util = require('util');

const helpers       = require('./helpers');
const DetailedError = require('./DetailedError');

class ServiceRegistrator {
    constructor(options) {
        this._active      = false;
        this._consul      = helpers.checkOptionsAndCreateConsulObject(options);
        this._serviceName = null;
        this._serviceId   = null;
        this._address     = null;
        this._port        = null;
        this._tags        = null;
        this._checks      = null;
    }

    setup(serviceName, serviceId) {
        if (!_.isString(serviceName) || _.isEmpty(serviceName)) {
            throw new DetailedError('serviceName argument must be a not empty string');
        }

        if (serviceId === undefined) {
            serviceId = serviceName;
        } else if (!_.isString(serviceId) || serviceId.length === 0) {
            throw new DetailedError('serviceId argument must be a not empty string');
        }

        this._serviceName = serviceName;
        this._serviceId   = serviceId;
    }

    addHttpCheck(id, name, url, interval, notes = null) {
        if (this._serviceName === null || this._serviceId === null) {
            return Promise.reject(new DetailedError('serviceName and serviceId parameters must be set'));
        }

        let check = {
            id:        this._serviceId + '.' + id,
            serviceid: this._serviceId,
            name:      name,
            http:      url,
            interval:  interval,
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

    getServiceId() {
        return this._serviceId;
    }

    getServiceName() {
        return this._serviceName;
    }

    enableMaintenanceMode(reason = '') {
        if (this._serviceName === null || this._serviceId === null) {
            return Promise.reject(new DetailedError('serviceName and serviceId parameters must be set'));
        }

        try {
            this._validateMaintenanceData(reason);
        } catch (err) {
            return Promise.reject(err);
        }

        return this._consul.agent.service.maintenance({
            id:     this._serviceId,
            enable: true,
            reason: reason,
        });
    }

    disableMaintenanceMode(reason = '') {
        if (this._serviceName === null || this._serviceId === null) {
            return Promise.reject(new DetailedError('serviceName and serviceId parameters must be set'));
        }

        try {
            this._validateMaintenanceData(reason);
        } catch (err) {
            return Promise.reject(err);
        }

        return this._consul.agent.service.maintenance({
            id:     this._serviceId,
            enable: false,
            reason: reason,
        });
    }

    register(overwrite = false) {
        if (!_.isBoolean(overwrite)) {
            return Promise.reject(new DetailedError('overwrite argument must be a boolean'));
        }

        let options = {
            name: this._serviceName,
            id:   this._serviceId
        };

        if (this._address !== null) {
            options.address = this._address;
        }

        if (this._port !== null) {
            options.port = this._port;
        }

        if (this._tags !== null) {
            options.tags = this._tags;
        }

        if (_.isArray(this._checks) && !_.isEmpty(this._checks)) {
            return this._deregisterOnDemand(overwrite)
                .then(() => {
                    return this._consul.agent.service.register(options)
                        .then(() => {
                            let checkRegisterPromises = this._checks.map(check => {
                                return this._consul.agent.check.register(check);
                            });
                            return Promise.all(checkRegisterPromises);
                        })
                        .then(() => this._active = true)
                        .catch(err => {
                            return this.deregister()
                                .catch(deregisterErr => {
                                    throw new DetailedError(
                                        util.format(
                                            'Can not register one of checks, failed with error: ' +
                                            '%s and failed to deregister just started service due to error: `%s`',
                                            err,
                                            deregisterErr
                                        ),
                                        {serviceId: this._serviceId}
                                    );
                                })
                                .then(() => {
                                    throw new DetailedError(
                                        util.format(
                                            'Can not register one of checks, failed with error: %s',
                                            err
                                        ),
                                        {serviceId: this._serviceId});
                                });
                        });
                });
        } else {
            return this._deregisterOnDemand(overwrite)
                .then(() => this._consul.agent.service.register(options))
                .then(() => this._active = true);
        }
    }

    setAddress(address) {
        if (!_.isString(address)) {
            throw new DetailedError('address argument must be a string');
        }

        if (!net.isIPv4(address)) {
            throw new DetailedError('address argument must be an IPv4 address');
        }

        this._address = address;
    }

    setTags(tags) {
        if (!_.isArray(tags) || _.isEmpty(tags)) {
            throw new DetailedError('tags argument must be an non-empty array');
        }

        tags.forEach((tag) => {
            if (!_.isString(tag) || _.isEmpty(tag)) {
                throw new DetailedError('all elements of tag argument must be a non-empty string');
            }
        });

        this._tags = tags;
    }

    setPort(port) {
        if (!_.isInteger(port)) {
            throw new DetailedError('port argument must be an int');
        }

        if (port < 0 && port > 65535) {
            throw new DetailedError('port argument must be between 0 and 65535');
        }

        this._port = port;
    }

    deregister() {
        this._active = false;
        return this._consul.agent.service.deregister(this._serviceId);
    }

    _deregisterOnDemand(deregister) {
        return Promise.resolve()
            .then(() => {
                if (deregister) {
                    return this.deregister();
                }
            })
            .catch(deregisterErr => {
                throw new DetailedError(
                    util.format(
                        'Failed to deregister service in overwrite mode due to error: `%s`',
                        deregisterErr
                    ),
                    {serviceId: this._serviceId}
                );
            });
    }

    _validateMaintenanceData(reason) {
        if (!this._active) {
            throw new DetailedError('Can not enable maintenance mode because service is not active',
                {serviceId: this._serviceId}
            );
        }

        if (!_.isString(reason)) {
            throw new DetailedError(
                util.format('Reason must be a string, but received %s', typeof reason)
            );
        }
    }
}

module.exports = ServiceRegistrator;
