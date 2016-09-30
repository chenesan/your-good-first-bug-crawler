module.exports = (function(){
  var request = require('request');
  var middlewares = require('./middlewares');
  var DEFAULT_REQUEST_PERIOD = 3000;
  var RequestRateController = {
    setup: function(requestPeriod = DEFAULT_REQUEST_PERIOD) {
      this.queue = [];
      this.requestPeriod = requestPeriod;
    },
    start: function () {
      setTimeout(this._request.bind(this), this.requestPeriod);
    },
    request: function(option) {
      return new Promise((resolve, reject) => {
        console.log('push: ', option.url);
        var wrappedCallback = (err, resp, body) => {
          if (err) {
            reject(err);
          } else {
            resolve({resp, body});
          }
        };
        var requestData = {
          option,
          callback: wrappedCallback,
        };
        this.queue.push(requestData);
      });
    },
    _request: function() {
      if (this.queue.length !== 0) {
        var data = this.queue.shift();
        console.log('Send request for ' + data.option.url);
        request(data.option, data.callback);
      }
      setTimeout(this._request.bind(this), this.requestPeriod);
    }
  }

  middlewares.DEFAULT_MIDDLEWARES.forEach(middleware => {
    RequestRateController = middleware(RequestRateController);
  })

  return RequestRateController;
})();
