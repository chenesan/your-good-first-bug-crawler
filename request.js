var request = require('request');

var NO_RESET_TIME = 0;
var NO_LIMIT = -1;
var NO_REMAINING = 99999;


module.exports = (function(){
  var RequestRateController = {
    setup: function(remaining = NO_REMAINING, resetTime = NO_RESET_TIME, limit = NO_LIMIT) {
      this.remaining = remaining;
      this.resetTime = resetTime;
      this.limit = limit;
      this.queue = [];
    },
    start: function () {
      const nextTime = this._computeNextTime();
      setTimeout(this._sendRequest.bind(this), nextTime);
    },
    request: function(option) {
      return new Promise((resolve, reject) => {
        var wrappedCallback = (err, resp, body) => {
          if (err) {
            reject(err);
          } else {
            this.resetTime = resp.headers['x-ratelimit-reset'] ? resp.headers['x-ratelimit-reset'] : this.resetTime;
            resolve({resp, body});
          }
        };
        wrappedCallback = wrappedCallback.bind(this);
        var requestData = {
          option,
          callback: wrappedCallback,
        };
        this.queue.push(requestData);
      });
    },
    _computeNextTime: function() {
      let nextTime = 0;
      if (this.resetTime === NO_RESET_TIME) {
        nextTime = 1000;
      } else if (Date.now() > this.resetTime * 1000) {
        nextTime = 0;
      } else {
        nextTime = ((this.resetTime * 1000 - Date.now()) / (this.remaining + 1));
      }
      console.log('nextTime', nextTime);
      return nextTime;
    },
    _sendRequest: function() {
      console.log('_sendRequest' + this);
      if (this.queue.length !== 0) {
        var data = this.queue.shift();
        if (Date.now() > this.resetTime * 1000) {
          this.remaining = this.limit;
        }
        this.remaining -= 1;
        console.log('Send request for ' + data.option.url);
        request(data.option, data.callback);
      }
      const nextTime = this._computeNextTime();
      setTimeout(this._sendRequest.bind(this), nextTime);
    }
  }

  return RequestRateController;
})();
