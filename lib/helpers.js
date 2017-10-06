'use strict';

const _      = require('lodash');
const consul = require('consul');

const DetailedError = require('./DetailedError');

function checkOptionsAndCreateConsulObject(options) {
    if (!_.isObject(options) || _.isFunction(options)) {
        throw new DetailedError('options argument must be an object');
    }

    if (!_.has(options, 'host') || !_.has(options, 'port')) {
        throw new DetailedError('options argument must have host and port fields');
    }

    if (!_.isString(options.host) || _.isEmpty(options.host)) {
        throw new DetailedError('options.host parameter must be a non empty string');
    }

    if (!_.isInteger(options.port) || options.port <= 0) {
        throw new DetailedError('options.port parameter must be a positive integer');
    }

    let consulOptions = {
        host:      options.host,
        port:      options.port,
        promisify: true,
    };

    if (!_.has(options, 'secure')) {
        consulOptions.secure = false;
    } else {
        if (!_.isBoolean(options.secure)) {
            throw new DetailedError('options.secure parameter must be boolean');
        }

        consulOptions.secure = options.secure;
    }

    return consul(consulOptions);
}

module.exports.checkOptionsAndCreateConsulObject = checkOptionsAndCreateConsulObject;
