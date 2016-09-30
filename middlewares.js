module.exports = (function(){
  function RepeatedUrlMiddleware(request) {
    const requestPromiseMap = {};
    const newRequest = Object.create(request);
    const method = request.request;
    newRequest.request = function(option) {
      let promise;
      if (requestPromiseMap[option.url] === undefined) {
        promise = method.call(this, option);
        requestPromiseMap[option.url] = promise;
      } else {
        console.log("The url " + option.url + " has been requested before.");
        promise = requestPromiseMap[option.url];
      }
      return promise;
    }
    return newRequest;
  }
  var DEFAULT_MIDDLEWARES = [
    RepeatedUrlMiddleware,
  ];
  return {
    RepeatedUrlMiddleware,
    DEFAULT_MIDDLEWARES,
  }
})()
