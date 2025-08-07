'use strict';

/* jshint loopfunc:true */

const assert             = require('chai').assert;
const sinon              = require('sinon');
const randomstring       = require('randomstring');
const ServiceRegistrator = require('src/ServiceRegistrator');

const errorMessages = {
    MUST_BE_OBJECT:      'options must be an object',
    MUST_BE_CONSUL:      'options must have host and port fields',
    MUST_BE_PROMISIFIED: 'consul must be created with promisify option',
    ADDRESS_TYPE:        'address must be a non-empty string',
    TAGGED_ADDRESS_TYPE_TYPE_ERROR_MESSAGE_REGEXP: /^TaggedAddresses.type must be ServiceRegistrator.TAGGED_ADDRESS_TYPE_LAN or ServiceRegistrator.TAGGED_ADDRESS_TYPE_WAN$/,
    TAGGED_ADDRESS_TYPE_ADDRESS_ERROR_MESSAGE_REGEXP: /^TaggedAddresses.address must be a non-empty string$/,
    TAGGED_ADDRESS_TYPE_PORT_ERROR_MESSAGE_REGEXP: /^TaggedAddresses.port must be an integer in a range from 0 to 65535$/
};

const CONSUL_OPTIONS = {
    host: '127.0.0.1',
    port: 8500,
};

function getFakeConsulObject(promisify) {
    return {
        _opts: {
            promisify: promisify,
        },
        agent: {
            service: {
                register:   () => {
                },
                deregister: () => {
                }
            },
            check:   {
                register: () => {
                },
            },
        },
    };
}

describe('ServiceRegistrator', function () {
    describe('#construct', function () {
        it('argument must be passed', function () {
            assert.throws(() => {
                new ServiceRegistrator();
            }, Error);
        });

        let incorrectArguments = [42, true, 'string', null, undefined, Symbol(), () => {
        }];

        incorrectArguments.forEach((arg) => {
            it('argument must be an object', () => {
                assert.throws(() => {
                    new ServiceRegistrator(arg, 'name', 'name_127.0.0.1_80');
                }, Error, errorMessages.MUST_BE_OBJECT);
            });
        });

        it('argument is an object but without properties', () => {
            // this is an object and it should pass this check but fail with another text of Error
            let consulOptions = {};
            assert.throws(() => {
                new ServiceRegistrator(consulOptions, 'name', 'name_127.0.0.1_80');
            }, Error, errorMessages.MUST_BE_CONSUL);
        });

        it('argument is a Consul object with incorect type of host (string) option', () => {
            let consulOptions = {host: {}};
            assert.throws(() => {
                new ServiceRegistrator(consulOptions, 'name', 'name_127.0.0.1_80');
            }, Error, errorMessages.MUST_BE_CONSUL);
        });

        it('argument is a Consul object with incorect type of port (int) option', () => {
            let consulOptions = {port: {}};
            assert.throws(() => {
                new ServiceRegistrator(consulOptions, 'name', 'name_127.0.0.1_80');
            }, Error, errorMessages.MUST_BE_CONSUL);
        });

    });

    describe('#setters', function () {
        it('check serviceName', () => {
            let serviceName = randomstring.generate();
            let service;

            assert.doesNotThrow(() => {
                service = new ServiceRegistrator(CONSUL_OPTIONS, serviceName, 'name_127.0.0.1_80');
            });
            assert.equal(service.getServiceName(), serviceName);
        });

        it('check serviceId', () => {
            let serviceName = randomstring.generate();
            let serviceId   = serviceName + '_127.0.0.1_80';
            let service;

            assert.doesNotThrow(() => {
                service = new ServiceRegistrator(CONSUL_OPTIONS, serviceName, serviceId);
            });
            assert.equal(service.getServiceId(), serviceId);
        });

        describe('setAddress with invalid type', function () {
            let incorrectArguments = [42, true, null, undefined, Symbol(), '', () => {
            }, {}];
            let service            = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_127.0.0.1_80');
            let testSetAddressFn   = function testSetAddress(arg) {
                return () => {
                    service.setAddress(arg);
                };
            };

            incorrectArguments.forEach((arg) => {
                it(`setAddress with invalid type (${typeof arg})`, () => {
                    assert.throws(testSetAddressFn(arg), Error, errorMessages.ADDRESS_TYPE);
                });
            });
        });

        it('setAddress with valid argument', function () {
            let consul      = getFakeConsulObject(true);
            let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_127.0.0.1_80');
            service._consul = consul;
            service.setAddress('127.0.0.1');
        });

        describe('setTaggedAddresses with invalid type', function () {
            let incorrectTypeArguments = [42, true, null, undefined, Symbol(), '', () => {}, {}];
            let incorrectAddressArguments = [42, true, null, undefined, Symbol(), '', () => {}, {}];
            let incorrectPortArguments = [-1, 65536, true, null, undefined, Symbol(), '', () => {}, {}];

            const service = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_127.0.0.1_80');
            const testSetTaggedAddressTypeFn = function testSetTaggedAddressTypeFn(arg) {
                return () => {
                    service.setTaggedAddress(arg, '127.0.0.1', 80);
                };
            };

            const testSetTaggedAddressAddressFn = function testSetTaggedAddressAddressFn(arg) {
                return () => {
                    service.setTaggedAddress(ServiceRegistrator.TAGGED_ADDRESS_TYPE_LAN, arg, 80);
                };
            };

            const testSetTaggedAddressPortFn = function testSetTaggedAddressPortFn(arg) {
                return () => {
                    service.setTaggedAddress(ServiceRegistrator.TAGGED_ADDRESS_TYPE_LAN, '127.0.0.1', arg);
                };
            };

            incorrectTypeArguments.forEach((arg) => {
                it(`incorrect type argument (${typeof arg})`, () => {
                    assert.throws(testSetTaggedAddressTypeFn(arg), Error, errorMessages.TAGGED_ADDRESS_TYPE_TYPE_ERROR_MESSAGE_REGEXP);
                });
            });

            incorrectAddressArguments.forEach((arg) => {
                it(`incorrect address argument (${typeof arg})`, () => {
                    assert.throws(testSetTaggedAddressAddressFn(arg), Error, errorMessages.TAGGED_ADDRESS_TYPE_ADDRESS_ERROR_MESSAGE_REGEXP);
                });
            });

            incorrectPortArguments.forEach((arg) => {
                it(`incorrect port argument (${typeof arg})`, () => {
                    assert.throws(testSetTaggedAddressPortFn(arg), Error, errorMessages.TAGGED_ADDRESS_TYPE_PORT_ERROR_MESSAGE_REGEXP);
                });
            });
        });

        describe('setTaggedAddress with valid arguments', function () {
            let correctTypeArguments = [
                {
                    name: 'ServiceRegistrator.TAGGED_ADDRESS_TYPE_LAN',
                    value: ServiceRegistrator.TAGGED_ADDRESS_TYPE_LAN,
                },
                {
                    name: 'ServiceRegistrator.TAGGED_ADDRESS_TYPE_WAN',
                    value: ServiceRegistrator.TAGGED_ADDRESS_TYPE_WAN,
                },
            ];

            const service = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_127.0.0.1_80');
            const testSetTaggedAddressTypeFn = function testSetTaggedAddressTypeFn(arg) {
                service.setTaggedAddress(arg, '127.0.0.1', 80);
            };

            correctTypeArguments.forEach((arg) => {
                it(`correct type argument (${arg.name})`, () => {
                    testSetTaggedAddressTypeFn(arg.value);
                });
            });
        });

        describe('register', function () {
            let pid    = process.pid;
            let tests  = [
                {
                    init: () => {
                    },
                    arg:  {
                        name: 'name',
                        id:   'name.' + pid
                    },
                },
                {
                    init: (service) => {
                        service.setAddress('1.2.3.4');
                    },
                    arg:  {
                        name:    'name',
                        id:      'name.' + pid,
                        address: '1.2.3.4'
                    },
                },
                {
                    init: (service) => {
                        service.setPort(12345);
                    },
                    arg:  {
                        name: 'name',
                        id:   'name.' + pid,
                        port: 12345
                    },
                },
                {
                    init: (service) => {
                        service.setTags(['tag1', 'tag2']);
                    },
                    arg:  {
                        name: 'name',
                        id:   'name.' + pid,
                        tags: ['tag1', 'tag2']
                    },
                },
                {
                    init: (service) => {
                        service.setTaggedAddress(ServiceRegistrator.TAGGED_ADDRESS_TYPE_LAN, '192.168.10.10', 80);
                    },
                    arg:  {
                        name: 'name',
                        id:   'name.' + pid,
                        taggedAddresses: {lan: {address: '192.168.10.10', port: 80}}
                    },
                },
            ];
            let callNo = 1;

            tests.forEach((test) => {
                let init = test.init;
                let arg  = test.arg;
                it('test #' + callNo, async function () {
                    let consul      = getFakeConsulObject(true);
                    let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name.' + pid);
                    service._consul = consul;
                    init(service);

                    let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
                    let registerReturn     = new Promise((resolve, reject) => {
                        resolve();
                    });

                    consulRegisterStub.returns(registerReturn);
                    const v = await service.register();
                    console.log(v);

                    assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                    assert.isTrue(
                        consulRegisterStub.firstCall.calledWith(arg),
                        consulRegisterStub.printf('incorrect argument, calls: %C')
                    );
                    assert.equal(service.getServiceId(), arg.id);
                });

                callNo++;
            });

            /**
             * When ServiceRegistrator tries to deregister the service it calls consul.agent.service.deregister
             * and this call resolves promise if service with that name was already registered.
             */
            it('register with overwrite, service was already registered', function () {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name.' + pid);
                service._consul = consul;

                let consulRegisterStub   = sinon.stub(consul.agent.service, 'register');
                let consulDeregisterStub = sinon.stub(consul.agent.service, 'deregister');
                let registerReturn       = Promise.resolve();
                let deregisterReturn     = Promise.resolve();

                consulRegisterStub.returns(registerReturn);
                consulDeregisterStub.returns(deregisterReturn);

                service.register(true)
                    .then(() => {
                        assert.equal(consulDeregisterStub.callCount, 1, 'must be called once');
                        assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                        assert.isTrue(service._active);
                    });

            });

            /**
             * When ServiceRegistrator tries to deregister the service it calls consul.agent.service.deregister
             * and this call rejects promise if service with that name wasn't registered yet.
             */
            it('register with overwrite, service was not registered', async function () {
                let consul        = getFakeConsulObject(true);
                const serviceName = 'serviceName';
                const serviceId   = serviceName + '.' + pid;
                let service       = new ServiceRegistrator(CONSUL_OPTIONS, serviceName, serviceId);
                service._consul   = consul;

                const deregisteredErrorResponseBody = 'Unknown service ID "' + serviceId +
                    '". Ensure that the service ID is passed, not the service name.';
                let deregisterError      = new Error('not found');
                deregisterError.response = {
                    body: deregisteredErrorResponseBody,
                };
                let consulRegisterStub   = sinon.stub(consul.agent.service, 'register');
                let consulDeregisterStub = sinon.stub(consul.agent.service, 'deregister');
                let registerReturn       = Promise.resolve();
                let deregisterReturn     = Promise.reject(deregisterError);

                consulRegisterStub.returns(registerReturn);
                consulDeregisterStub.returns(deregisterReturn);

                return service.register(true)
                    .then(() => {
                        assert.equal(consulDeregisterStub.callCount, 1, 'must be called once');
                        assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                        assert.isTrue(service._active);
                    });
            });

            it('register with overwrite, that fail', async function () {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name123');
                service._consul = consul;

                let deregisterError      = new Error('Some consul error');
                let consulRegisterStub   = sinon.stub(consul.agent.service, 'register');
                let consulDeregisterStub = sinon.stub(consul.agent.service, 'deregister');
                let registerReturn       = Promise.resolve();
                let deregisterReturn     = Promise.reject(deregisterError);

                consulRegisterStub.returns(registerReturn);
                consulDeregisterStub.returns(deregisterReturn);

                return service.register(true)
                    .then(() => {
                        assert.fail("Registration must fail if consul return unknown error");
                    })
                    .catch((err) => {
                        assert.equal(consulDeregisterStub.callCount, 1, 'must be called once');
                        assert.equal(consulRegisterStub.callCount, 0);
                        assert.isFalse(service._active);
                        assert.match(err.message, new RegExp(
                            '^Failed to deregister service `\\w+` in overwrite mode due to error: ' +
                            '`Some consul error`$'
                        ));
                    });
            });
        });

        describe('register: extended cases', function () {
            function _checksRegister(consul, amountOfChecks) {
                let data                    = [];
                let consulCheckRegisterStub = sinon.stub(consul.agent.check, 'register');
                for (let i = 0; i < amountOfChecks; i++) {
                    let resolvePromise;
                    let rejectPromise;
                    let checkRegPromise = new Promise((resolve, reject) => {
                        resolvePromise = resolve;
                        rejectPromise  = reject;
                    });

                    consulCheckRegisterStub.onCall(i).returns(checkRegPromise);
                    data.push({
                        resolve: resolvePromise,
                        reject:  rejectPromise,
                        stub:    consulCheckRegisterStub,
                    });
                }

                return data;
            }

            it('error on register without checks, from consul', async function () {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_someId');
                service._consul = consul;

                // eslint-disable-next-line no-unused-vars
                let resolveRegPromise;
                let rejectRegPromise;
                let regPromise = new Promise((resolve, reject) => {
                    resolveRegPromise = resolve;
                    rejectRegPromise  = reject;
                });

                let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
                consulRegisterStub.returns(regPromise);

                let regError = new Error('regerr');

                // noinspection JSUnusedAssignment
                rejectRegPromise(regError);

                try {
                    await service.register();
                } catch (err) {
                    assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                    assert.strictEqual(err, regError);

                    return;
                }

                assert.fail('Unexpected test behaviour. Registration must fail according to stubs.');
            });

            it('register without checks, and then add some checks', async function () {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_someId');
                service._consul = consul;

                let regPromise         = Promise.resolve();
                let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
                consulRegisterStub.returns(regPromise);
                let checkRegPromises  = _checksRegister(consul, 1);
                let firstCheckRegData = checkRegPromises[0];

                assert.isNull(service._checks);
                assert.isFalse(service._active);

                await service.register();

                assert.equal(consulRegisterStub.callCount, 1, 'must be called once');

                assert.isTrue(service._active);

                let checkRegPromise = service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s');

                firstCheckRegData.resolve();
                await checkRegPromise;

                let checkRegArgs = {
                    id:        'checkid',
                    serviceid: service._serviceId,
                    name:      'checkname',
                    http:      'http://localhost:8080',
                    interval:  '10s'
                };

                assert.equal(firstCheckRegData.stub.callCount, 1, 'must be called once');
                assert.isTrue(
                    firstCheckRegData.stub.firstCall.calledWith(checkRegArgs),
                    firstCheckRegData.stub.printf('incorrect argument, calls: %C')
                );
                assert.isArray(service._checks);
                assert(service._checks.length, 1);
                assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
            });

            it('register with checks, that fails', async function () {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_someId');
                service._consul = consul;

                let regPromise         = Promise.resolve();
                let consulRegisterStub = sinon.stub(consul.agent.service, 'register');

                consulRegisterStub.returns(regPromise);
                let checkRegPromises  = _checksRegister(consul, 1);
                let firstCheckRegData = checkRegPromises[0];

                assert.isNull(service._checks);
                assert.isFalse(service._active);

                let checkRegArgs = {
                    id:        'checkid',
                    serviceid: service._serviceId,
                    name:      'checkname',
                    http:      'http://localhost:8080',
                    interval:  '10s'
                };

                await service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s');

                assert.isArray(service._checks);
                assert.equal(service._checks.length, 1);
                assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
                assert.isFalse(service._active);

                let deregisterStub = sinon.stub(service, 'deregister');
                deregisterStub.returns(Promise.resolve());

                firstCheckRegData.reject(new Error('check reg error'));

                try {
                    await service.register();
                } catch (err) {
                    assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                    assert.isFalse(service._active);

                    // eslint-disable-next-line max-len
                    assert.match(err.message, /^Can not register one of checks for the service `\w+`, failed with error: Error: check reg error/);
                    assert.equal(deregisterStub.callCount, 1, 'must be called once');
                    assert.isTrue(deregisterStub.firstCall.calledWith());

                    return;
                }

                assert.fail('Unexpected test behaviour. Registration must fail according to stubs.');
            });

            it('register with checks, that fails and deregister that fails', async function () {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_someId');
                service._consul = consul;

                let checkRegArgs = {
                    id:        'checkid',
                    serviceid: service._serviceId,
                    name:      'checkname',
                    http:      'http://localhost:8080',
                    interval:  '10s'
                };

                let checkError         = new Error('check reg error');
                let deregisterErr      = new Error('deregister fail');
                let consulRegisterStub = sinon.stub(consul.agent.service, 'register');

                let consulCheckRegisterStub = sinon.stub(consul.agent.check, 'register');
                let deregisterStub          = sinon.stub(consul.agent.service, 'deregister');

                consulRegisterStub.returns(Promise.resolve());
                consulCheckRegisterStub.returns(Promise.reject(checkError));
                deregisterStub.returns(Promise.reject(deregisterErr));

                assert.isNull(service._checks);
                assert.isFalse(service._active);

                await service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s');

                assert.isArray(service._checks);
                assert.equal(service._checks.length, 1);
                assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
                assert.isFalse(service._active);

                try {
                    await service.register();
                } catch (err) {
                    assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                    assert.isFalse(service._active);
                    assert.match(err.message, new RegExp(
                        '^Can not register one of checks for the service `\\w+`, failed with error: ' +
                        'check reg error and failed to deregister just started service due to ' +
                        'error: `deregister fail`'
                    ));
                    assert.equal(consulCheckRegisterStub.callCount, 1, 'must be called once');
                    assert.equal(deregisterStub.callCount, 1, 'must be called once');
                    assert.isTrue(deregisterStub.firstCall.calledWith());

                    return;
                }

                assert.fail('Unexpected test behaviour. Registration must fail according to stubs.');
            });

            it('overwrite registration with checks, that fails', async function () {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_someId');
                service._consul = consul;

                let regPromise           = Promise.resolve();
                let deregPromise         = Promise.resolve();
                let consulRegisterStub   = sinon.stub(consul.agent.service, 'register');
                let consulDeregisterStub = sinon.stub(consul.agent.service, 'deregister');

                consulRegisterStub.returns(regPromise);
                consulDeregisterStub.returns(deregPromise);

                let checkRegPromises  = _checksRegister(consul, 1);
                let firstCheckRegData = checkRegPromises[0];

                assert.isNull(service._checks);
                assert.isFalse(service._active);

                let checkRegArgs = {
                    id:        'checkid',
                    serviceid: service._serviceId,
                    name:      'checkname',
                    http:      'http://localhost:8080',
                    interval:  '10s'
                };

                await service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s');

                assert.isArray(service._checks);
                assert.equal(service._checks.length, 1);
                assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
                assert.isFalse(service._active);

                firstCheckRegData.reject(new Error('check reg error'));

                try {
                    await service.register(true);
                } catch (err) {
                    assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                    assert.isFalse(service._active);

                    // eslint-disable-next-line max-len
                    assert.match(err.message, /^Can not register one of checks for the service `\w+`, failed with error: Error: check reg error/);
                    assert.equal(consulDeregisterStub.callCount, 2, 'must be called twice');

                    return;
                }

                assert.fail('Unexpected test behaviour. Registration must fail according to stubs.');
            });
        });

        describe('addHttpCheck with status', () => {
            it('should creates check object without status prop if it not passed as argument', () => {
                const service   = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_someId');
                const checkArgs = {
                    id:       'id',
                    name:     'check',
                    url:      'checkUrl',
                    interval: 'interval',
                };

                const checkObject = {
                    id:        checkArgs.id,
                    serviceid: service.getServiceId(),
                    name:      checkArgs.name,
                    http:      checkArgs.url,
                    interval:  checkArgs.interval
                };

                service.addHttpCheck(checkArgs.id, checkArgs.name, checkArgs.url, checkArgs.interval);

                assert.deepEqual(service._checks[0], checkObject);
            });

            it('should creates check object with status prop if it passed as argument', () => {
                const service   = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_someId');
                const checkArgs = {
                    id:       'id',
                    name:     'check',
                    url:      'checkUrl',
                    interval: 'interval',
                    status:   'status'
                };

                const checkObject = {
                    id:        checkArgs.id,
                    serviceid: service.getServiceId(),
                    name:      checkArgs.name,
                    http:      checkArgs.url,
                    interval:  checkArgs.interval,
                    status:    checkArgs.status
                };

                service.addHttpCheck(
                    checkArgs.id, checkArgs.name, checkArgs.url, checkArgs.interval, null, checkArgs.status
                );

                assert.deepEqual(service._checks[0], checkObject);
            });
        });
    });
});
