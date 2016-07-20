'use strict';

const IPV4_PATTERN = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/i;

function isIpV4Address(ip) {
  return IPV4_PATTERN.test(ip);
}

module.exports.isIpV4Address = isIpV4Address;
