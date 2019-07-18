const axios = require('axios');
var clientTransactionId = 1;

exports.getStatus = async function(config) {
  return axios.all([getStat(config, 'cansetshutter'), getStat(config, 'shutterstatus')])
    .then(axios.spread((canSetShutter, shutterStatus) => {
      let dome = {};
      let validateResponse = (response, valueName, handleValid) => {
        dome[valueName] = null;
        let baseErrorMessage = `\t\tError occurred in "${valueName}" call to dome equipment`;
        if (!response) {
          console.error(baseErrorMessage);
        } else if (response.status !== 200) {
          console.error(`${baseErrorMessage}: Error status ${response.status} - ${response.data}`);
        } else if (response.data.ErrorNumber !== 0) {
          console.error(`${baseErrorMessage}: Error ${response.data.ErrorNumber} - ${response.data.ErrorMessage}`);
        } else {
          handleValid();
        }
      };

      validateResponse(canSetShutter, 'canSetShutter', () => {
        dome.canSetShutter = canSetShutter.data.Value;
      });

      validateResponse(shutterStatus, 'shutterStatus', () => {
        switch (shutterStatus.data.Value) {
          case 0:
            dome.shutterStatus = 'open'; break;
          case 1:
            dome.shutterStatus = 'closed'; break;
          case 2:
            dome.shutterStatus = 'opening'; break;
          case 3:
            dome.shutterStatus = 'closing'; break;
          default:
            dome.shutterStatus = 'error';
        }
      });
      return dome;
    }))
    .catch((error) => {
      if (error.message) {
        error.message = `Error occurred in "getStatus" call to dome equipment`;
      }
      console.error(error);
      throw error;
    });
};

exports.executeCommand = async function(command, config) {
  // Assert that the type is correct?
  // The request body must be a string in this format or Alpaca will not accept it
  let requestBody = `ClientTransactionID=${clientTransactionId}`;
  if (config.clientId) {
    requestBody += `&ClientId=${config.clientId}`;
  }
  // Valid actions are "openShutter", "closeShutter", "abortSlew" (in uppercase or lowercase)
  let url = `${config.baseUrl}/${config.deviceNumber}/${command.action.toLowerCase()}`;
  await axios.put(url, requestBody)
    .then(response => {
      // Send response somewhere?
      if (!response) {
        let error = new Error();
        error.response = 'null response';
        error.message = 'Null response was returned';
        throw error;
      } else if (response.data.ErrorNumber !== 0) {
        let error = new Error();
        let baseErrorMessage = `Error occurred in "${command.action.toLowerCase()}" call to dome equipment`;
        error.message = `\t\t${baseErrorMessage}: Error ${response.data.ErrorNumber} - ${response.data.ErrorMessage}`;
        error.response = response;
        throw error;
      }
    })
    .catch(error => {
      console.error(`\t\tError occurred in "${command.action.toLowerCase()}" command to dome equipment`, error.response);
      throw error;
    });
};

function getStat(config, stat) {
  let url = new URL(`${config.baseUrl}/${config.deviceNumber}/${stat}`);
  let searchParams = new URLSearchParams();
  searchParams.append('clienttransactionid', clientTransactionId);
  if (config.clientId) {
    searchParams.append('clientid', config.clientId);
  }
  url.search = searchParams;

  let response = axios.get(url.toString())
    .catch((error) => {
      // TODO: Do more checking for different cases?
      return error.response;
    });
  clientTransactionId++;
  return response;
};
