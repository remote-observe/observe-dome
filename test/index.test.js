const axios = require('axios');
var sinon = require('sinon');

const chai = require('chai');
chai.use(require('dirty-chai'));
const expect = chai.expect;

const dome = require('../index.js');

describe('Dome Module', () => {
  const config = {
    type: 'dome',
    module: 'observe-dome',
    filePath: 'null',
    baseUrl: 'https://api.mockrovor.byu.edu/api/v1/dome',
    deviceNumber: 42
  };

  let mockRespond = (value, errorNumber = 0, errorMessage = '') =>
    Promise.resolve((() => {
      let response = {
        status: 200,
        statusText: 'OK',
        data: {
          ClientTransactionID: 0,
          ServerTransactionID: 0,
          ErrorNumber: errorNumber,
          ErrorMessage: errorMessage
        }
      };
      if (value !== null) {
        response.data.Value = value;
      }
      return response;
    })());

    let mockError = (status, statusText, message) => {
      let error = new Error();
      error.response = {
        status: status,
        statusText: statusText,
        data: message
      }
      return Promise.reject(error);
    };

  describe('#getStatus', () => {
    let getStub;
    let logSpy;

    before(() => {
      getStub = sinon.stub(axios, 'get');
      logSpy = sinon.spy(console.log);
    });

    after(() => {
      sinon.restore();
    });

    beforeEach(() => {
      getStub.resetHistory();
    });

    afterEach(() => {
      //
    });

    it('should retreive the correct dome status', async () => {
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/cansetshutter.*`))).returns(mockRespond(true));
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/shutterstatus.*`))).returns(mockRespond(0));
      let expected = {
        canSetShutter: true,
        shutterStatus: 'open'
      };

      let domeStatus = await dome.getStatus(config);

      expect(axios.get.callCount).to.equal(Object.keys(expected).length);
      expect(domeStatus).to.exist();
      expect(domeStatus).to.deep.equal(expected);
    });

    it('should retreive the correct dome status when missing optional search params', async () => {
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/cansetshutter.*`))).returns(mockRespond(false));
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/shutterstatus.*`))).returns(mockRespond(1));

      config.clientId = 65535;
      let expected = {
        canSetShutter: false,
        shutterStatus: 'closed'
      };

      let domeStatus = await dome.getStatus(config);

      expect(axios.get.callCount).to.equal(Object.keys(expected).length);
      expect(domeStatus).to.exist();
      expect(domeStatus).to.deep.equal(expected);
    });

    it('should have null value for field where the the call has an error and "error" as error shutter status', async () => {
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/cansetshutter.*`))).returns(mockRespond(true, 1025, 'Invalid value'));
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/shutterstatus.*`))).returns(mockRespond(4));
      let expected = {
        canSetShutter: null,
        shutterStatus: 'error'
      };

      let domeStatus = await dome.getStatus(config);

      expect(axios.get.callCount).to.equal(Object.keys(expected).length);
      expect(domeStatus).to.exist();
      expect(domeStatus).to.deep.equal(expected);
    });

    it('should catch and log error when a 400 response is received', async () => {
      let errorMessage = 'MockException: you did something incorrect. at someFunction(Class someArg) in <someFile>:line 4';
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/cansetshutter.*`))).returns(mockError(400, 'Bad Request', errorMessage));
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/shutterstatus.*`))).returns(mockRespond(2));
      let expected = {
        canSetShutter: null,
        shutterStatus: 'opening'
      };

      let domeStatus = await dome.getStatus(config);

      expect(axios.get.callCount).to.equal(Object.keys(expected).length);
      expect(domeStatus).to.exist();
      expect(domeStatus).to.deep.equal(expected);
      expect(logSpy.calledWithMatch(errorMessage));
    });

    it('should catch and log error when a 500 response is received', async () => {
      let errorMessage = 'MockException: we did something incorrect. at someFunction(Class someArg) in <someFile>:line 5';
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/cansetshutter.*`))).returns(mockError(500, 'Internal Server Error', errorMessage));
      getStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/shutterstatus.*`))).returns(mockRespond(3));
      let expected = {
        canSetShutter: null,
        shutterStatus: 'closing'
      };

      let domeStatus = await dome.getStatus(config);

      expect(axios.get.callCount).to.equal(Object.keys(expected).length);
      expect(domeStatus).to.exist();
      expect(domeStatus).to.deep.equal(expected);
      expect(logSpy.calledWithMatch(errorMessage));
    });
  });

  describe('#executeCommand', () => {
    let status;
    let command = {
      action: '',
      status: '',
      type: 'dome'
    };
    const shutterTime = 1000;
    let clock;
    let putStub;
    let logSpy;

    let setupShutterResponse = (action, responseStatus, eventualStatus) => {
      putStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/${action.toLowerCase()}`)), sinon.match.any)
        .callsFake(() => {
          status = responseStatus;
          setTimeout(() => { status = eventualStatus; }, shutterTime);
          return mockRespond(null);
        });
      };

    before(() => {
      clock = sinon.useFakeTimers();
      putStub = sinon.stub(axios, 'put');
      logSpy = sinon.spy(console.log);
    });

    after(() => {
      sinon.restore();
      clock.restore();
    });

    beforeEach(() => {
      putStub.resetHistory();
    });

    afterEach(() => {
      //
    });

    it('should open dome', async () => {
      status = 'closed';
      command.action = 'openShutter';
      setupShutterResponse('openshutter', 'opening', 'open');

      dome.executeCommand(command, config);

      expect(axios.put.callCount).to.equal(1);

      expect(status).to.equal('opening');
      clock.tick(shutterTime);
      expect(status).to.equal('open');
      expect(axios.put.callCount).to.equal(1);
    });

    it('should close dome', async () => {
      status = 'opening';
      command.action = 'closeshutter';
      setupShutterResponse('closeshutter', 'closing', 'closed');

      dome.executeCommand(command, config);

      expect(status).to.equal('closing');
      clock.tick(shutterTime);
      expect(status).to.equal('closed');
      expect(axios.put.callCount).to.equal(1);
    });

    it('should abort slew', async () => {
      status = 'opening';
      command.action = 'AbortSlew';
      setupShutterResponse('abortslew', 'error', 'error');

      dome.executeCommand(command, config);

      expect(status).to.equal('error');
      expect(axios.put.callCount).to.equal(1);
    });

    it('should throw error when given custom error from Alpaca', async () => {
      status = 'opening';
      command.action = 'abortSlew';
      putStub.withArgs(sinon.match(new RegExp(`${config.baseUrl}/\\d+/${command.action.toLowerCase()}`)), sinon.match.any)
        .returns(mockRespond(null, 1025, 'Invalid value'));
      let exceptionThrown = false;
      config.clientId = 65535;

      await dome.executeCommand(command, config)
        .catch(() => { exceptionThrown = true; });

      expect(status).to.equal('opening');
      expect(axios.put.callCount).to.equal(1);
      expect(logSpy.calledWithMatch(1025, 'Invalid value'));
      expect(exceptionThrown).to.be.true();
    });

    it('should catch and log error when a 400 response is received', async () => {
      status = 'opening';
      command.action = 'closeshutter';
      let errorMessage = 'MockException: you did something incorrect. at someFunction(Class someArg) in <someFile>:line 4';
      putStub.withArgs(sinon.match.any, sinon.match.any).returns(mockError(400, 'Bad Request', errorMessage));
      let exceptionThrown = false;

      await dome.executeCommand(command, config)
        .catch(() => { exceptionThrown = true; });

      expect(status).to.equal('opening');
      expect(axios.put.callCount).to.equal(1);
      expect(logSpy.calledWithMatch(errorMessage));
      expect(exceptionThrown).to.be.true();
    });

    it('should catch and log error when a 500 response is received', async () => {
      status = 'closing';
      command.action = 'openshutter';
      let errorMessage = 'MockException: we did something incorrect. at someFunction(Class someArg) in <someFile>:line 5';
      putStub.withArgs(sinon.match.any, sinon.match.any).returns(mockError(500, 'Internal Server Error', errorMessage));
      let exceptionThrown = false;

      await dome.executeCommand(command, config)
        .catch(() => { exceptionThrown = true; });

      expect(status).to.equal('closing');
      expect(axios.put.callCount).to.equal(1);
      expect(logSpy.calledWithMatch(errorMessage));
      expect(exceptionThrown).to.be.true();
    });
  });
});
