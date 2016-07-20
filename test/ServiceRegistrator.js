'use strict';

const assert = require('chai').assert;
const sinon = require('sinon');
const randomstring = require('randomstring');
const ServiceRegistrator = require('../lib/ServiceRegistrator');

const errorMessages = {
  MUST_BE_OBJECT: 'argument must be an object',
  MUST_BE_CONSUL: 'argument must be an instance of Consul class',
  MUST_BE_PROMISIFIED: 'consul must be created with promisify option',
  ADDRESS_TYPE: 'address must be a string',
  ADDRESS_NOT_IPV4: 'address must be an IPv4 IP address',
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
      let consul = {};
      assert.throws(() => { new ServiceRegistrator(consul, 'name'); }, Error, errorMessages.MUST_BE_CONSUL);
    });

    it('argument is a Consul object without promisify option', () => {
      let consul = { _opts: {} };
      assert.throws(() => { new ServiceRegistrator(consul, 'name'); }, Error, errorMessages.MUST_BE_CONSUL);
    });

    it('argument is a Consul object with promisify option but incorrect type', () => {
      let consul = getFakeConsulObject(false);
      consul._opts.promisify = 123;

      assert.throws(() => { new ServiceRegistrator(consul, 'name'); }, Error, errorMessages.MUST_BE_PROMISIFIED);
    });

    it('argument is a Consul object with promisify off', () => {
      let consul = getFakeConsulObject(false);

      assert.throws(() => { new ServiceRegistrator(consul, 'name'); }, Error, errorMessages.MUST_BE_PROMISIFIED);
    });

    it('argument is a Consul object with promisify', () => {
      let consul = getFakeConsulObject(true);

      assert.doesNotThrow(() => { new ServiceRegistrator(consul, 'name'); });
    });
  });

  describe('#setters', function () {
    it('check serviceName', () => {
      let consul = getFakeConsulObject(true);
      let serviceName = randomstring.generate();
      let service;

      assert.doesNotThrow(() => { service = new ServiceRegistrator(consul, serviceName); });
      assert.equal(service.getServiceName(), serviceName);
    });

    describe('setAddress with invalid type', function () {
      let incorrectArguments = [42, true, null, undefined, Symbol(), () => {}, {}];
      let consul = getFakeConsulObject(true);
      let service = new ServiceRegistrator(consul, 'name');
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
      let consul = getFakeConsulObject(true);
      let service = new ServiceRegistrator(consul, 'name');
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
      let service = new ServiceRegistrator(consul, 'name');
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
        {
          init: (service) => {
            service.addHttpCheck('health', 'Healthcheck over HTTP API', 'http://1.2.3.4:12345/', '1s', '100ms');
          },
          arg: {
            name: 'name',
            id: 'name.' + pid,
            checks: [
              {
                id: 'health',
                name: 'Healthcheck over HTTP API',
                http: 'http://1.2.3.4:12345/',
                interval: '1s',
                timeout: '100ms',
              },
            ],
          },
        },
      ];
      let callNo = 1;

      tests.forEach((test) => {
        let init = test.init;
        let arg = test.arg;
        it('test #' + callNo, function () {
          let consul = getFakeConsulObject(true);
          let service = new ServiceRegistrator(consul, 'name');
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
  });
});
