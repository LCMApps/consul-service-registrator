const http = require('http');
const ConsulServiceRegistrator = require('../src/ServiceRegistrator');

// address and port of the consul daemon started manually or using docker-compose.yaml from the example
const consulHost = "127.0.0.1";
const consulPort = 8500;

// if consul runs in docker container, the address should be "host.docker.internal";
// if consul runs on the same host as this script, use "127.0.0.1"
const serverHostForConsulChecks = "host.docker.internal";
const server = http.createServer();

async function startServer() {
    return new Promise((resolve, reject) => {
        server.on('request', (request, response) => {
            let body = [];
            request.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', () => {
                body = Buffer.concat(body).toString();

                console.log(`[HTTP SERVICE REQUEST] ${request.method} ${request.url}`);
                response.end();
            });
        });

        server.on('error', err => {
            server.removeAllListeners();
            reject(err);
        });

        server.listen(0, () => {
            resolve(server.address().port);
        });
    });
}

async function stopServer() {
    return new Promise((resolve, reject) => {
        server.close((err) => {
            if (err) return reject();

            resolve();
        });
    });
}

async function waitFor(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

process.on('SIGTERM', async () => {
    await stopServer();
    process.exit(0);
});

async function registerWithoutChecksExample(port, overwrite = false) {
    const consulConfig = {
        "host": consulHost,
        "port": consulPort
    };

    const serviceName = 'example_service_1';
    const serviceId = `${serviceName}_${port}`;

    const s = new ConsulServiceRegistrator(consulConfig, serviceName, serviceId);

    s.setAddress("127.0.0.1");
    s.setPort(port);
    s.setTags([`node-${serviceName}`, 'example']);

    console.log(`Registration without health checks. Overwrite = ${overwrite}. Registering...`);
    await s.register(overwrite);
    console.log(`Registration without health checks. Overwrite = ${overwrite}. Registered.`);

    await waitFor(5000);
    console.log(`Registration without health checks. Overwrite = ${overwrite}. Deregistering...`);
    await s.deregister();
    console.log(`Registration without health checks. Overwrite = ${overwrite}. Deregistered.`);
}

async function registerWithChecksExample(port, overwrite = false) {
    const consulConfig = {
        "host": consulHost,
        "port": consulPort
    };

    const serviceName = 'example_service_2';
    const serviceId = `${serviceName}_${port}`;
    const checkId = serviceId + '_status';
    const checkName = 'Example service health status';
    const consulCheckInterval = '1s';
    const statusEndpoint = `http://${serverHostForConsulChecks}:${port}/status_ok`;

    const s = new ConsulServiceRegistrator(consulConfig, serviceName, serviceId);

    s.setAddress("127.0.0.1");
    s.setPort(port);
    s.setTags([`node-${serviceName}`, 'example']);
    s.addHttpCheck(checkId, checkName, statusEndpoint, consulCheckInterval);

    console.log(`Registration with health checks. Overwrite = ${overwrite}. Registering...`);
    await s.register(overwrite);
    console.log(`Registration with health checks. Overwrite = ${overwrite}. Registered.`);

    await waitFor(5000);
    console.log(`Registration with health checks. Overwrite = ${overwrite}. Deregistering...`);
    await s.deregister();
    console.log(`Registration with health checks. Overwrite = ${overwrite}. Deregistered.`);
}

async function registerWithChecksAfterStartExample(port, overwrite = false) {
    const consulConfig = {
        "host": consulHost,
        "port": consulPort
    };

    const serviceName = 'example_service_3';
    const serviceId = `${serviceName}_${port}`;
    const checkId = serviceId + '_status';
    const checkName = `${serviceName} health status`;
    const consulCheckInterval = '1s';
    const statusEndpoint = `http://${serverHostForConsulChecks}:${port}/status_ok`;

    const s = new ConsulServiceRegistrator(consulConfig, serviceName, serviceId);

    s.setAddress("127.0.0.1");
    s.setPort(port);
    s.setTags([`node-${serviceName}`, 'example']);

    console.log(`Registration with health checks after start. Registering...`);
    await s.register(overwrite);
    console.log(`Registration with health checks after start. Registered.`);

    await waitFor(5000);

    await s.addHttpCheck(checkId, checkName, statusEndpoint, consulCheckInterval);
    console.log(`Registration with health checks after start. Health check was added.`);

    await waitFor(5000);

    console.log(`Registration with health checks after start. Deregistering...`);
    await s.deregister();
    console.log(`Registration with health checks after start. Deregistered.`);
}

async function registerWithEmulationOfPresentChecksDuringTheStartExample(port) {
    const consulConfig = {
        "host": consulHost,
        "port": consulPort
    };

    const serviceName = 'example_service_4';
    const serviceId = `${serviceName}_${port}`;
    const checkId = serviceId + '_status';
    const checkName = `${serviceName} health status`;
    const consulCheckInterval = '1s';
    const statusEndpoint = `http://${serverHostForConsulChecks}:${port}/status_ok`;

    const s1 = new ConsulServiceRegistrator(consulConfig, serviceName, serviceId);
    const s2 = new ConsulServiceRegistrator(consulConfig, serviceName, serviceId);

    s1.setAddress("127.0.0.1");
    s2.setAddress("127.0.0.1");

    s1.setPort(port);
    s2.setPort(port);

    s1.setTags([`node-${serviceName}`, 'example']);
    s2.setTags([`node-${serviceName}`, 'example']);

    await s1.addHttpCheck(checkId, checkName, statusEndpoint, consulCheckInterval);
    await s2.addHttpCheck(checkId, checkName, statusEndpoint, consulCheckInterval);

    console.log(`Registration with health checks. First service that will fail. Registering...`);
    await s1.register(true);
    console.log(`Registration with health checks. First service that will fail. Registering...`);

    console.log(`Registration with health checks. First service will not deregister anything. This may happen because of fail`);

    await waitFor(5000);
    console.log(`Registration with health checks. Second service must delete checks hanged from the reg process of the first service. Registering...`);
    await s2.register(true);
    console.log(`Registration with health checks. Second service must delete checks hanged from the reg process of the first service. Registered.`);

    await waitFor(5000);
    console.log(`Registration with health checks. Second service must delete checks hanged from the reg process of the first service. Deregistering...`);
    await s2.deregister();
    console.log(`Registration with health checks. Second service must delete checks hanged from the reg process of the first service. Deregistered.`);
}

startServer().then(port => {
    console.log(`Server started, port = ${port}`);

    return port;
}).catch(err => {
    console.log('Server start failed');
    console.log(err);
    process.exit(0);
}).then(async port => {
    console.log('[EXAMPLE 1]');
    await registerWithoutChecksExample(port, false);

    console.log('[EXAMPLE 2]');
    await registerWithChecksExample(port, true);

    console.log('[EXAMPLE 3]');
    await registerWithChecksAfterStartExample(port);

    console.log('[EXAMPLE 4]');
    await registerWithEmulationOfPresentChecksDuringTheStartExample(port);
}).then(async () => {
    await stopServer();
    process.exit(0);
}).catch(async err => {
    console.log('FAILED');

    console.log(err);

    await stopServer();
    process.exit(1);
});
