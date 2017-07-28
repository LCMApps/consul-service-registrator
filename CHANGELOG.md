# Changelog
### 1.3.0

- Using `net.isIPv4` for validate IPv4 addresses
- IpAddressDetector not extended from EventEmitter now 
- IpAddressDetector now has only `getLanAndWanFromConsul` method that return 
AdvertiseAddr and AdvertiseAddrWan from Consul Config 
- Added new required argument for ServiceRegistrator's constructor - `serviceId`
- Remove ttl parameter from `addHttpCheck` method of ServiceRegistrator
- Add `getServiceById` and `getAllServices` methods to ServiceRegistrator

### 1.2.2

- ServiceRegistrator obtained new method getServiceId
- ServiceRegistrator: new methods enableMaintenanceMode and disableMaintenanceMode to control maintenance

### 1.2.1

- IpAddressDetector was refactored: consul options checks was removed and common helper checks that options.

### 1.2.0

- New class ServiceObserver that watches for changes of services and notifies on changed checks, addresses,
  ports and so on
- Unit test of ServiceRegistrator was fixed

### 1.1.1

- Passing of options for consul (host, port, secure) instead of passing consul object to IpAddressDetector
- Options passing of logger to IpAddressDetector
- addHttpCheck method of ServiceRegistrator registers check with checkID that equals to `serviceName.pid.id` where
  id is a value passed to the method. Previous behaviour was to register check just with checkID=id and it led to
  problems where few services registers different checks with the same checkID on the same node.

### 1.1.0

- Passing of options for consul (host, port, secure) instead of passing consul object
- Logic of registration of checks was changed. Bug in node consul lib makes mass registration of checks impossible,
  so the first action of this lib is registration of service and then registration of checks
- addHttpCheck method can register checks after service registration
- addHttpCheck method returns promise

### 1.0.0

- Initial version
