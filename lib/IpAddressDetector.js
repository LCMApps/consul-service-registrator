'use strict';

const net     = require('net');
const _       = require('lodash');
const helpers = require('./helpers');

class IpAddressDetector {
    constructor(options) {
        this._consul = helpers.checkOptionsAndCreateConsulObject(options);
    }

    /**
     * Method return AdvertiseAddr and AdvertiseAddrWan from the configuration of the consul agent
     * @return {Promise.<{lanIp: string, wanIp: string}|Error>}
     */
    getLanAndWanFromConsul() {
        return this._consul.agent.self()
            .then(result => {
                if (!_.has(result, 'Config.AdvertiseAddr')) {
                    throw new Error('Config.AdvertiseAddr section in /v1/agent/self is not found');
                }

                if (!_.has(result, 'Config.AdvertiseAddrWan')) {
                    throw new Error('Config.AdvertiseAddr section in /v1/agent/self is not found');
                }

                if (!_.isString(result.Config.AdvertiseAddr) || !net.isIPv4(result.Config.AdvertiseAddr)) {
                    throw new Error('Config.AdvertiseAddr in /v1/agent/self is not IPv4 address');
                }

                if (!_.isString(result.Config.AdvertiseAddrWan) || !net.isIPv4(result.Config.AdvertiseAddrWan)) {
                    throw new Error('Config.AdvertiseAddrWan in /v1/agent/self is not IPv4 address');
                }

                return {
                    lanIp: result.Config.AdvertiseAddr,
                    wanIp: result.Config.AdvertiseAddrWan
                };
            });
    }
}

module.exports = IpAddressDetector;
