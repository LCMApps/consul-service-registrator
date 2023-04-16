const IpAddressDetector = require('../src/IpAddressDetector');

// address and port of the consul daemon started manually or using docker-compose.yaml from the example
const consulHost = "127.0.0.1";
const consulPort = 8500;

const consulConfig = {
    "host": consulHost,
    "port": consulPort
};
const ipAddressDetector = new IpAddressDetector(consulConfig);

ipAddressDetector.getLanAndWanFromConsul().then(result => {
    console.log(result);
}).catch(err => {
    console.log(err);
})
