'use strict';

const net     = require('net');
const _       = require('lodash');
const helpers = require('./helpers');

class IpAddressDetector {
    constructor(options) {
        this._consul = helpers.checkOptionsAndCreateConsulObject(options);
    }

    /**
     * Method return LAN and WAN from the configuration of the consul agent
     * @return {Promise.<{lanIp: string, wanIp: string}|Error>}
     */
    getLanAndWanFromConsul() {
        return this._consul.agent.self()
            .then(result => {
                if (_.has(result, 'Config.AdvertiseAddr') && _.has(result, 'Config.AdvertiseAddrWan')) {
                    if (!net.isIPv4(result.Config.AdvertiseAddr)) {
                        throw new Error('Config.AdvertiseAddr in /v1/agent/self is not IPv4 address');
                    }

                    if (!net.isIPv4(result.Config.AdvertiseAddrWan)) {
                        throw new Error('Config.AdvertiseAddrWan in /v1/agent/self is not IPv4 address');
                    }

                    return {
                        lanIp: result.Config.AdvertiseAddr,
                        wanIp: result.Config.AdvertiseAddrWan
                    };
                }

                if (_.has(result, 'DebugConfig.AdvertiseAddrLAN') && _.has(result, 'DebugConfig.AdvertiseAddrWAN')) {
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
                }

                throw new Error('Can`t detect LAN and WAN addresses from Consul Agent configuration');
            });
    }
}

module.exports = IpAddressDetector;
