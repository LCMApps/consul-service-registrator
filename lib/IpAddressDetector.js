'use strict';

const net     = require('net');
const _       = require('lodash');
const helpers = require('./helpers');

class IpAddressDetector {
    constructor(options) {
        this._consul = helpers.checkOptionsAndCreateConsulObject(options);
    }

    /**
     * Method return AdvertiseAddrLAN and AdvertiseAddrWan from the configuration of the consul agent
     * @return {Promise.<{lanIp: string, wanIp: string}|Error>}
     */
    getLanAndWanFromConsul() {
        return this._consul.agent.self()
            .then(result => {
                if (!_.has(result, 'DebugConfig')) {
                    throw new Error('DebugConfig section in /v1/agent/self is not found');
                }

                if (!net.isIPv4(result.DebugConfig.AdvertiseAddrLAN)) {
                    throw new Error('DebugConfig.AdvertiseAddrLAN in /v1/agent/self is not IPv4 address');
                }

                if (!net.isIPv4(result.DebugConfig.AdvertiseAddrWAN)) {
                    throw new Error('DebugConfig.AdvertiseAddrWAN in /v1/agent/self is not IPv4 address');
                }

                return {
                    lanIp: result.DebugConfig.AdvertiseAddrLAN,
                    wanIp: result.DebugConfig.AdvertiseAddrWAN
                };
            });
    }
}

module.exports = IpAddressDetector;
