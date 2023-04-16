'use strict';

const _      = require('lodash');
const Consul = require('consul');

function checkOptionsAndCreateConsulObject(options) {
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

    let consulOptions = {
        host:      options.host,
        port:      options.port,
    };

    if (!_.has(options, 'secure')) {
        consulOptions.secure = false;
    } else {
        if (!_.isBoolean(options.secure)) {
            throw new Error('options.secure must be boolean');
        }

        consulOptions.secure = options.secure;
    }

    return new Consul(consulOptions);
}

module.exports.checkOptionsAndCreateConsulObject = checkOptionsAndCreateConsulObject;
