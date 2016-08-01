# Changelog

### 1.1.1

- Passing of options for consul (host, port, secure) instead of passing consul object to IpAddressDetector
- Options passing of logger to IpAddressDetector

### 1.1.0

- Passing of options for consul (host, port, secure) instead of passing consul object
- Logic of registration of checks was changed. Bug in node consul lib makes mass registration of checks impossible,
  so the first action of this lib is registration of service and then registration of checks
- addHttpCheck method can register checks after service registration
- addHttpCheck method returns promise

### 1.0.0

- Initial version
