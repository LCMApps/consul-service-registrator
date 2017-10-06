'use strict';

/* jshint loopfunc:true */

const assert             = require('chai').assert;
const sinon              = require('sinon');
const async_             = require('asyncawait/async');
const await_             = require('asyncawait/await');
const randomstring       = require('randomstring');
const ServiceRegistrator = require('../lib/ServiceRegistrator');
const DetailedError      = require('../lib/DetailedError');

const errorMessages = {
    MUST_BE_OBJECT:      'options argument must be an object',
    MUST_BE_CONSUL:      'options argument must have host and port fields',
    MUST_BE_PROMISIFIED: 'consul must be created with promisify option',
    ADDRESS_TYPE:        'address argument must be a string',
    ADDRESS_NOT_IPV4:    'address argument must be an IPv4 address',
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
            }, DetailedError);
        });

        let incorrectArguments = [42, true, 'string', null, undefined, Symbol(), () => {
        }];

        incorrectArguments.forEach((arg) => {
            it('argument must be an object', () => {
                assert.throws(() => {
                    new ServiceRegistrator(arg, 'name', 'name_127.0.0.1_80');
                }, DetailedError, errorMessages.MUST_BE_OBJECT);
            });
        });

        it('argument is an object but without properties', () => {
            // this is an object and it should pass this check but fail with another text of Error
            let consulOptions = {};
            assert.throws(() => {
                new ServiceRegistrator(consulOptions, 'name', 'name_127.0.0.1_80');
            }, DetailedError, errorMessages.MUST_BE_CONSUL);
        });

        it('argument is a Consul object with incorect type of host (string) option', () => {
            let consulOptions = {host: {}};
            assert.throws(() => {
                new ServiceRegistrator(consulOptions, 'name', 'name_127.0.0.1_80');
            }, DetailedError, errorMessages.MUST_BE_CONSUL);
        });

        it('argument is a Consul object with incorect type of port (int) option', () => {
            let consulOptions = {port: {}};
            assert.throws(() => {
                new ServiceRegistrator(consulOptions, 'name', 'name_127.0.0.1_80');
            }, DetailedError, errorMessages.MUST_BE_CONSUL);
        });

    });

    describe('#setters', function () {
        it('check serviceName and serviceId', () => {
            let serviceName = randomstring.generate();
            let serviceId   = randomstring.generate();
            let service;

            assert.doesNotThrow(() => {
                service = new ServiceRegistrator(CONSUL_OPTIONS);

                service.setup(serviceName, serviceId);
            });

            assert.equal(service.getServiceName(), serviceName);
            assert.equal(service.getServiceId(), serviceId);
        });

        it('check serviceId if ServiceRegistrator::setup called only with serviceName argument', () => {
            let serviceName = randomstring.generate();
            let service;

            assert.doesNotThrow(() => {
                service = new ServiceRegistrator(CONSUL_OPTIONS);

                service.setup(serviceName);
            });
            assert.equal(service.getServiceName(), serviceName);
            assert.equal(service.getServiceId(), serviceName);
        });

        describe('setAddress with invalid type', function () {
            let incorrectArguments = [42, true, null, undefined, Symbol(), () => {
            }, {}];
            let service            = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_127.0.0.1_80');
            let testSetAddressFn   = function testSetAddress(arg) {
                return () => {
                    service.setAddress(arg);
                };
            };

            incorrectArguments.forEach((arg) => {
                it('setAddress with invalid type', () => {
                    assert.throws(testSetAddressFn(arg), DetailedError, errorMessages.ADDRESS_TYPE);
                });
            });
        });

        describe('setAddress with valid type and incorrect IP V4 address', function () {
            // eslint-disable-next-line max-len
            let incorrectArguments = ['', '256.0.0.0', '-1.0.0.0', '255.0.256.0', '1.1.1.p2', '0000', 'fe80::5efe:c0a8:33c'];
            let service            = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_127.0.0.1_80');
            let testSetAddressFn   = function testSetAddress(arg) {
                return () => {
                    service.setAddress(arg);
                };
            };

            incorrectArguments.forEach((arg) => {
                it('setAddress with invalid type', () => {
                    assert.throws(testSetAddressFn(arg), DetailedError, errorMessages.ADDRESS_NOT_IPV4);
                });
            });
        });

        it('setAddress with valid argument', function () {
            let consul      = getFakeConsulObject(true);
            let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name_127.0.0.1_80');
            service._consul = consul;
            service.setAddress('127.0.0.1');
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
            ];
            let callNo = 1;

            tests.forEach((test) => {
                let init = test.init;
                let arg  = test.arg;
                it('test #' + callNo, function () {
                    let consul      = getFakeConsulObject(true);
                    let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name.' + pid);
                    service._consul = consul;
                    init(service);

                    let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
                    let registerReturn     = new Promise(() => {
                    });

                    consulRegisterStub.returns(registerReturn);
                    service.register()
                        .then(() => {
                            assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                            assert.isTrue(
                                consulRegisterStub.firstCall.calledWith(arg),
                                consulRegisterStub.printf('incorrect argument, calls: %C')
                            );
                            assert.equal(service.getServiceId(), arg.id);
                        })
                        .catch(err => {
                            assert.ifError(err);
                        });
                });

                callNo++;
            });

            it('register with overwrite', function () {
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
                    })
                    .catch(err => {
                        assert.ifError(err);
                    });

            });

            it('register with overwrite, that fail', function (done) {
                let consul      = getFakeConsulObject(true);
                let service     = new ServiceRegistrator(CONSUL_OPTIONS, 'name', 'name123');
                service._consul = consul;

                let deregisterError      = 'Some consul error';
                let consulRegisterStub   = sinon.stub(consul.agent.service, 'register');
                let consulDeregisterStub = sinon.stub(consul.agent.service, 'deregister');
                let registerReturn       = Promise.resolve();
                let deregisterReturn     = Promise.reject(deregisterError);

                consulRegisterStub.returns(registerReturn);
                consulDeregisterStub.returns(deregisterReturn);

                service.register(true)
                    .catch((err) => {
                        assert.equal(consulDeregisterStub.callCount, 1, 'must be called once');
                        assert.equal(consulRegisterStub.callCount, 0);
                        assert.isFalse(service._active);
                        assert.match(err.message, new RegExp(
                            '^Failed to deregister service in overwrite mode due to error: `Some consul error`$'
                        ));

                        done();
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

            it('error on register without checks, from consul', function (done) {
                let consul  = getFakeConsulObject(true);
                let service = new ServiceRegistrator(CONSUL_OPTIONS);

                service.setup('name', 'name_someId');

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
                let regResult = service.register();

                let regError = new Error('regerr');

                regResult.catch(err => {
                    assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                    assert.strictEqual(err, regError);
                    done();
                });

                rejectRegPromise(regError);
            });

            it('register without checks, and then add some checks', function (done) {
                async_(() => {
                    let consul  = getFakeConsulObject(true);
                    let service = new ServiceRegistrator(CONSUL_OPTIONS);

                    service.setup('name', 'name_someId');

                    service._consul = consul;

                    let regPromise         = Promise.resolve();
                    let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
                    consulRegisterStub.returns(regPromise);
                    let checkRegPromises  = _checksRegister(consul, 1);
                    let firstCheckRegData = checkRegPromises[0];

                    assert.isNull(service._checks);
                    assert.isFalse(service._active);

                    await_(service.register());

                    assert.equal(consulRegisterStub.callCount, 1, 'must be called once');

                    assert.isTrue(service._active);

                    let checkRegPromise = service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s');

                    firstCheckRegData.resolve();
                    await_(checkRegPromise);

                    let checkRegArgs = {
                        id:        service._serviceId + '.checkid',
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
                })().then(done).catch(done);
            });

            it('register with checks, that fails', function (done) {
                async_(() => {
                    let consul  = getFakeConsulObject(true);
                    let service = new ServiceRegistrator(CONSUL_OPTIONS);

                    service.setup('name', 'name_someId');

                    service._consul = consul;

                    let regPromise         = Promise.resolve();
                    let consulRegisterStub = sinon.stub(consul.agent.service, 'register');

                    consulRegisterStub.returns(regPromise);
                    let checkRegPromises  = _checksRegister(consul, 1);
                    let firstCheckRegData = checkRegPromises[0];

                    assert.isNull(service._checks);
                    assert.isFalse(service._active);

                    let checkRegArgs = {
                        id:        service._serviceId + '.checkid',
                        serviceid: service._serviceId,
                        name:      'checkname',
                        http:      'http://localhost:8080',
                        interval:  '10s'
                    };

                    await_(service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s'));

                    assert.isArray(service._checks);
                    assert.equal(service._checks.length, 1);
                    assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
                    assert.isFalse(service._active);

                    let deregisterStub = sinon.stub(service, 'deregister');
                    deregisterStub.returns(Promise.resolve());

                    firstCheckRegData.reject(new Error('check reg error'));

                    service.register()
                        .catch(err => {
                            assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                            assert.isFalse(service._active);

                            // eslint-disable-next-line max-len
                            assert.match(err.message, /^Can not register one of checks, failed with error: Error: check reg error$/);
                            assert.equal(deregisterStub.callCount, 1, 'must be called once');
                            assert.isTrue(deregisterStub.firstCall.calledWith());
                        });
                })().then(done).catch(done);
            });

            it('register with checks, that fails and deregister that fails', function (done) {
                async_(() => {
                    let consul  = getFakeConsulObject(true);
                    let service = new ServiceRegistrator(CONSUL_OPTIONS);

                    service.setup('name', 'name_someId');

                    service._consul = consul;

                    let checkRegArgs = {
                        id:        service._serviceId + '.checkid',
                        serviceid: service._serviceId,
                        name:      'checkname',
                        http:      'http://localhost:8080',
                        interval:  '10s'
                    };

                    let checkError         = new Error('check reg error');
                    let deregisterMsg      = 'deregister fail';
                    let consulRegisterStub = sinon.stub(consul.agent.service, 'register');

                    let consulCheckRegisterStub = sinon.stub(consul.agent.check, 'register');
                    let deregisterStub          = sinon.stub(consul.agent.service, 'deregister');

                    consulRegisterStub.returns(Promise.resolve());
                    consulCheckRegisterStub.returns(Promise.reject(checkError));
                    deregisterStub.returns(Promise.reject(deregisterMsg));

                    assert.isNull(service._checks);
                    assert.isFalse(service._active);

                    await_(service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s'));

                    assert.isArray(service._checks);
                    assert.equal(service._checks.length, 1);
                    assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
                    assert.isFalse(service._active);

                    service.register()
                        .catch(err => {
                            assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                            assert.isFalse(service._active);
                            assert.match(err.message, new RegExp(
                                '^Can not register one of checks, failed with error: ' +
                                'Error: check reg error and failed to deregister just started service due to ' +
                                'error: `deregister fail`$'
                            ));
                            assert.equal(consulCheckRegisterStub.callCount, 1, 'must be called once');
                            assert.equal(deregisterStub.callCount, 1, 'must be called once');
                            assert.isTrue(deregisterStub.firstCall.calledWith());
                        });
                })().then(done).catch(done);
            });

            it('overwrite registration with checks, that fails', function (done) {
                async_(() => {
                    let consul      = getFakeConsulObject(true);
                    let service     = new ServiceRegistrator(CONSUL_OPTIONS);

                    service.setup('name', 'name_someId');

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
                        id:        service._serviceId + '.checkid',
                        serviceid: service._serviceId,
                        name:      'checkname',
                        http:      'http://localhost:8080',
                        interval:  '10s'
                    };

                    await_(service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s'));

                    assert.isArray(service._checks);
                    assert.equal(service._checks.length, 1);
                    assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
                    assert.isFalse(service._active);

                    firstCheckRegData.reject(new Error('check reg error'));

                    service.register(true)
                        .catch(err => {
                            assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
                            assert.isFalse(service._active);

                            // eslint-disable-next-line max-len
                            assert.match(err.message, /^Can not register one of checks, failed with error: Error: check reg error$/);
                            assert.equal(consulDeregisterStub.callCount, 2, 'must be called twice');
                        });
                })().then(done).catch(done);
            });
        });
    });
});
