'use strict';

/* jshint loopfunc:true */

const assert = require('chai').assert;
const sinon = require('sinon');
const async_ = require('asyncawait/async');
const await_ = require('asyncawait/await');
const randomstring = require('randomstring');
const ServiceRegistrator = require('../lib/ServiceRegistrator');

const errorMessages = {
  MUST_BE_OBJECT: 'options must be an object',
  MUST_BE_CONSUL: 'options must have host and port fields',
  MUST_BE_PROMISIFIED: 'consul must be created with promisify option',
  ADDRESS_TYPE: 'address must be a string',
  ADDRESS_NOT_IPV4: 'address must be an IPv4 IP address',
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
        register: () => {},
        deregister: () => {},
      },
      check: {
        register: () => {},
      },
    },
  };
}

describe('ServiceRegistrator', function () {
  describe('#construct', function () {
    /*jshint nonew: false */
    it('argument must be passed', function () {
      assert.throws(() => { new ServiceRegistrator(); }, Error);
    });

    let incorrectArguments = [42, true, 'string', null, undefined, Symbol(), () => {}];

    incorrectArguments.forEach((arg) => {
      it('argument must be an object', () => {
        assert.throws(() => { new ServiceRegistrator(arg, 'name'); }, Error, errorMessages.MUST_BE_OBJECT);
      });
    });

    it('argument is an object but without properties', () => {
      // this is an object and it should pass this check but fail with another text of Error
      let consulOptions = {};
      assert.throws(() => { new ServiceRegistrator(consulOptions, 'name'); }, Error, errorMessages.MUST_BE_CONSUL);
    });

    it('argument is a Consul object with incorect type of host (string) option', () => {
      let consulOptions = { host: {} };
      assert.throws(() => { new ServiceRegistrator(consulOptions, 'name'); }, Error, errorMessages.MUST_BE_CONSUL);
    });

    it('argument is a Consul object with incorect type of port (int) option', () => {
      let consulOptions = { port: {} };
      assert.throws(() => { new ServiceRegistrator(consulOptions, 'name'); }, Error, errorMessages.MUST_BE_CONSUL);
    });

  });

  describe('#setters', function () {
    it('check serviceName', () => {
      let serviceName = randomstring.generate();
      let service;

      assert.doesNotThrow(() => { service = new ServiceRegistrator(CONSUL_OPTIONS, serviceName); });
      assert.equal(service.getServiceName(), serviceName);
    });

    describe('setAddress with invalid type', function () {
      let incorrectArguments = [42, true, null, undefined, Symbol(), () => {}, {}];
      let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
      let testSetAddressFn = function testSetAddress(arg) {
        return () => {service.setAddress(arg);};
      };

      incorrectArguments.forEach((arg) => {
        it('setAddress with invalid type', () => {
          assert.throws(testSetAddressFn(arg), Error, errorMessages.ADDRESS_TYPE);
        });
      });
    });

    describe('setAddress with valid type and incorrect IP V4 address', function () {
      let incorrectArguments = ['', '256.0.0.0', '-1.0.0.0', '255.0.256.0', '1.1.1.p2', '0000', 'fe80::5efe:c0a8:33c'];
      let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
      let testSetAddressFn = function testSetAddress(arg) {
        return () => { service.setAddress(arg); };
      };

      incorrectArguments.forEach((arg) => {
        it('setAddress with invalid type', () => {
          assert.throws(testSetAddressFn(arg), Error, errorMessages.ADDRESS_NOT_IPV4);
        });
      });
    });

    it('setAddress with valid argument', function () {
      let consul = getFakeConsulObject(true);
      let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
      service._consul = consul;
      service.setAddress('127.0.0.1');
    });

    describe('register', function () {
      let pid = process.pid;
      let tests = [
        {
          init: () => { },
          arg: { name: 'name', id: 'name.' + pid },
        },
        {
          init: (service) => {
            service.setAddress('1.2.3.4');
          },
          arg: { name: 'name', id: 'name.' + pid, address: '1.2.3.4' },
        },
        {
          init: (service) => {
            service.setPort(12345);
          },
          arg: { name: 'name', id: 'name.' + pid, port: 12345 },
        },
        {
          init: (service) => {
            service.setTags(['tag1', 'tag2']);
          },
          arg: { name: 'name', id: 'name.' + pid, tags: ['tag1', 'tag2'] },
        },
      ];
      let callNo = 1;

      tests.forEach((test) => {
        let init = test.init;
        let arg = test.arg;
        it('test #' + callNo, function () {
          let consul = getFakeConsulObject(true);
          let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
          service._consul = consul;
          init(service);

          let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
          let registerReturn = new Promise(() => { });
          consulRegisterStub.returns(registerReturn);
          let result = service.register();

          assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
          assert.isTrue(
            consulRegisterStub.firstCall.calledWith(arg),
            consulRegisterStub.printf('incorrect argument, calls: %C')
          );
          assert.strictEqual(result, registerReturn);
        });

        callNo++;
      });
    });

    describe('register: extended cases', function () {
      function _checksRegister(consul, amountOfChecks) {
        let data = [];
        let consulCheckRegisterStub = sinon.stub(consul.agent.check, 'register');
        for (let i = 0; i < amountOfChecks; i++) {
          let resolvePromise;
          let rejectPromise;
          let checkRegPromise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
          });

          consulCheckRegisterStub.onCall(i).returns(checkRegPromise);
          data.push({
            resolve: resolvePromise,
            reject: rejectPromise,
            stub: consulCheckRegisterStub,
          });
        }

        return data;
      }

      it('error on register without checks, from consul', function (done) {
        let consul = getFakeConsulObject(true);
        let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
        service._consul = consul;

        let resolveRegPromise;
        let rejectRegPromise;
        let regPromise = new Promise((resolve, reject) => {
          resolveRegPromise = resolve;
          rejectRegPromise = reject;
        });

        let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
        consulRegisterStub.returns(regPromise);
        let regResult = service.register();

        assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
        assert.strictEqual(regResult, regPromise);

        let regError = new Error('regerr');

        regResult.catch(err => {
          assert.strictEqual(err, regError);
          done();
        });

        rejectRegPromise(regError);
      });

      it('register without checks, and then add some checks', function (done) {
        async_(() => {
          let consul = getFakeConsulObject(true);
          let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
          service._consul = consul;

          let regPromise = Promise.resolve();
          let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
          consulRegisterStub.returns(regPromise);
          let checkRegPromises = _checksRegister(consul, 1);
          let firstCheckRegData = checkRegPromises[0];

          assert.isNull(service._checks);
          assert.isFalse(service._active);

          await_(service.register());

          assert.equal(consulRegisterStub.callCount, 1, 'must be called once');

          assert.isTrue(service._active);

          let checkRegPromise = service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s', '30s');

          firstCheckRegData.resolve();
          await_(checkRegPromise);

          let checkRegArgs = {
            id: 'checkid',
            serviceid: service._serviceId,
            name: 'checkname',
            http: 'http://localhost:8080',
            interval: '10s',
            ttl: '30s',
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
          let consul = getFakeConsulObject(true);
          let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
          service._consul = consul;

          let regPromise = Promise.resolve();
          let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
          consulRegisterStub.returns(regPromise);
          let checkRegPromises = _checksRegister(consul, 1);
          let firstCheckRegData = checkRegPromises[0];

          assert.isNull(service._checks);
          assert.isFalse(service._active);

          let checkRegArgs = {
            id: 'checkid',
            serviceid: service._serviceId,
            name: 'checkname',
            http: 'http://localhost:8080',
            interval: '10s',
            ttl: '30s',
          };
          service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s', '30s');

          assert.isArray(service._checks);
          assert.equal(service._checks.length, 1);
          assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
          assert.isFalse(service._active);

          let deregisterStub = sinon.stub(service, 'deregister');
          deregisterStub.returns(Promise.resolve());

          let promise = service.register();

          assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
          assert.isTrue(service._active);

          firstCheckRegData.reject(new Error('check reg error'));

          assert.throws(
            () => { await_(promise); },
            /^Can not register one of checks for the service `\w+\.\d+`, failed with error: Error: check reg error$/
          );

          assert.equal(deregisterStub.callCount, 1, 'must be called once');
          assert.isTrue(deregisterStub.firstCall.calledWith());
        })().then(done).catch(done);
      });

      it('register with checks, that fails and deregister that fails', function (done) {
        async_(() => {
          let consul = getFakeConsulObject(true);
          let service = new ServiceRegistrator(CONSUL_OPTIONS, 'name');
          service._consul = consul;

          let regPromise = Promise.resolve();
          let consulRegisterStub = sinon.stub(consul.agent.service, 'register');
          consulRegisterStub.returns(regPromise);
          let checkRegPromises = _checksRegister(consul, 1);
          let firstCheckRegData = checkRegPromises[0];

          assert.isNull(service._checks);
          assert.isFalse(service._active);

          let checkRegArgs = {
            id: 'checkid',
            serviceid: service._serviceId,
            name: 'checkname',
            http: 'http://localhost:8080',
            interval: '10s',
            ttl: '30s',
          };
          service.addHttpCheck('checkid', 'checkname', 'http://localhost:8080', '10s', '30s');

          assert.isArray(service._checks);
          assert.equal(service._checks.length, 1);
          assert.strictEqual(JSON.stringify(service._checks[0]), JSON.stringify(checkRegArgs));
          assert.isFalse(service._active);

          let deregisterStub = sinon.stub(consul.agent.service, 'deregister');
          deregisterStub.returns(Promise.reject('dereg fail'));

          let promise = service.register();

          assert.equal(consulRegisterStub.callCount, 1, 'must be called once');
          assert.isTrue(service._active);

          firstCheckRegData.reject(new Error('check reg error'));

          assert.throws(
            () => { await_(promise); },
            new RegExp(
              '^Can not register one of checks for the service `\\w+\\.\\d+`, failed with error: ' +
                'Error: check reg error and failed to deregister just started service due to error: `dereg fail`$'
            )
          );

          assert.equal(deregisterStub.callCount, 1, 'must be called once');
          assert.isTrue(deregisterStub.firstCall.calledWith());
        })().then(done).catch(done);
      });
    });
  });
});
