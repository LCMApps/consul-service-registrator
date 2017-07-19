'use strict';

const net     = require('net');
const _       = require('lodash');
const helpers = require('./helpers');

class IpAddressDetector {
    constructor(options) {
        this._consul = helpers.checkOptionsAndCreateConsulObject(options);
    }

    /**
     * Method return AdvertiseAddr and AdvertiseAddrWan from Consul Config
     * @return {Promise.<{lanIp: string, wanIp: string}>}
     */
    async getLanAndWanFromConsul() {
        const consulInfo = await this._consul.agent.self();

        if (!_.has(consulInfo, 'Config.AdvertiseAddr')) {
            throw new Error('Config.AdvertiseAddr section in /v1/agent/self is not found');
        }

        if (!_.has(consulInfo, 'Config.AdvertiseAddrWan')) {
            throw new Error('Config.AdvertiseAddr section in /v1/agent/self is not found');
        }

        if (!_.isString(consulInfo.Config.AdvertiseAddr) || !net.isIPv4(consulInfo.Config.AdvertiseAddr)) {
            throw new Error('Config.AdvertiseAddr in /v1/agent/self is not IPv4 address');
        }

        if (!_.isString(consulInfo.Config.AdvertiseAddrWan) || !net.isIPv4(consulInfo.Config.AdvertiseAddrWan)) {
            throw new Error('Config.AdvertiseAddrWan in /v1/agent/self is not IPv4 address');
        }

        return {
            lanIp: consulInfo.Config.AdvertiseAddr,
            wanIp: consulInfo.Config.AdvertiseAddrWan
        };
    }
}

module.exports = IpAddressDetector;
