var request = require('request');
var dataHandler = require('./data-handler');

var USER_AGENT = 'your-good-first-bug-crawler';
var LANGUAGES = ['python', 'javascript'];
var GOOD_FIRST_BUG_LABELS = ['good-first-bug', 'low-hanging-fruit', 'beginner', 'newbie', 'cake'];
var basicGetOption = {
  method: 'GET',
  headers: {
    'User-Agent': 'your-good-first-bug-crawler',
  },
};

/* helper */
function getDataFromLinkHeader(link) {
  var data = {};
  link.split(',').forEach(line => {
    var [urlSeg, relSeg] = line.split(';').map(val => val.trim());
    var url = urlSeg.slice(1, -1);
    var rel = relSeg.split('=')[1].slice(1, -1);
    data[rel] = url;
  });
  return data;
}

function getRepoData(issueEntity) {
  var urlSlices = issueEntity.repository_url.split('/');
  return {
    name: urlSlices.pop(),
    owner: urlSlices.pop(),
    apiUrl: issueEntity.repository_url,
  };
}

/* wrapper of request for rate limit */

function requestWrapper(initRemainingCount = Infinity, initResetTime = 0, limit = -1) {
  function requestWithRateLimit(option, callback) {
    var sendRequest = () => {
      requestWithRateLimit.remainingCount -= 1;
      console.log(option.url, 'remainingCount:', requestWithRateLimit.remainingCount);
      var wrappedCallback = (err, resp, body) => {
        if (err) {
          throw err;
        } else {
          requestWithRateLimit.resetTime = resp.headers['x-ratelimit-reset'];
          callback(err, resp, body);
        }
      }
      return request(option, wrappedCallback);
    }
    if (requestWithRateLimit.remainingCount > 0) {
      return sendRequest();
    } else {
      requestWithRateLimit.requestQueue.push(sendRequest);
      console.log('Request for ' + option.url + 'is limited. put it into requestQueue');
      console.log('Now Request Queue Size is', requestWithRateLimit.requestQueue.length);
      if (requestWithRateLimit.timerId === -1) {
        var currentTime = Date.now() / 1000;
        var remainingSeconds = requestWithRateLimit.resetTime - currentTime + 1;
        console.log('next time request: ', remainingSeconds);
        requestWithRateLimit.timerId = setTimeout(
          () => {
            console.log('Pop requestQueue');
            requestWithRateLimit.remainingCount = requestWithRateLimit.rateLimit;
            var requestTimes = requestWithRateLimit.requestQueue.length < requestWithRateLimit.rateLimit ?
              requestWithRateLimit.requestQueue.length : requestWithRateLimit.rateLimit;
            for(var i = 0; i < requestTimes; i ++) {
              (requestWithRateLimit.requestQueue.shift())();
            }
            requestWithRateLimit.timerId = -1;
          }, remainingSeconds * 1000
        );
      }
    }
  }
  requestWithRateLimit.remainingCount = initRemainingCount;
  requestWithRateLimit.resetTime = initResetTime;
  requestWithRateLimit.timerId = -1;
  requestWithRateLimit.requestQueue = [];
  requestWithRateLimit.rateLimit = limit;
  return requestWithRateLimit;
}

function getRateLimit() {
  var option = Object.create(basicGetOption);
  option.url = 'https://api.github.com/rate_limit';
  var promise = new Promise((resolve, reject) => {
    request(option, (err, resp, body) => {
      if(err) {
        reject(err);
      } else {
        resolve(JSON.parse(body));
      }
    });
  });
  return promise;
}

/* wrapper for request without knowing github resource type */

function githubRequestWrapper() {
  return getRateLimit()
  .then((data) => {
    var searchLimitData = data.resources.search;
    var coreLimitData = data.resources.core;
    searchRequest = requestWrapper(searchLimitData.remaining, searchLimitData.reset, searchLimitData.limit);
    coreRequest = requestWrapper(coreLimitData.remaining, coreLimitData.reset, coreLimitData.limit);
    function wrapper(option, callback) {
      if (option.url.includes('/search/')) {
        return searchRequest(option, callback);
      } else {
        return coreRequest(option, callback);
      }
    }
    return wrapper
  }, (err) => { throw err; });
}

/* main crawler */

var IssueCrawler = {
  request: undefined,
  languages: undefined,
  setup(requestFunc, languages) {
    this.request = requestFunc;
    this.languages = languages;
  },
  crawlIssuesByPage(startUrl) {
    var option = Object.create(basicGetOption);
    option.url = startUrl;
    this.request(option, (err, response, body) => {
      if (err) {
        console.log(err);
      } else {
        var result = JSON.parse(body);
        if (!result.items) {
          console.log(response);
        }
        this.handleCrawledIssues(result.items);
        var linkData = getDataFromLinkHeader(response.headers.link);
        if (linkData.next) {
          this.crawlIssuesByPage(linkData.next);
        }
      }
    })
  },
  crawlIssuesByLanguages(rootUrl) {
    this.languages.forEach(language => {
      var startUrl = `${rootUrl}+language:${language}`;
      this.crawlIssuesByPage(startUrl);
    });
  },
  crawlIssuesWithLabel(rootUrl, label) {
    var option = Object.create(basicGetOption);
    option.url = `${rootUrl}+label:${label}`;
    this.request(option, (err, response, body) => {
      if (err) {
        console.log(err);
      } else {
        var result = JSON.parse(body);
        this.handleCrawledIssues(result.items);
        if (response.headers.link) {
          if (result.total_count < 1000) {
            var linkData = getDataFromLinkHeader(response.headers.link);
            if (linkData.next) {
              this.crawlIssuesByPage(linkData.next);
            }
          } else {
            this.crawlIssuesByLanguages(url);
          }
        } else {

        }
      }
    });
  },
  crawlRepo(repoUrl) {
    var option = Object.create(basicGetOption);
    option.url = repoUrl;
    this.request(option, (err, resp, body) => {
      if (err) {
        console.log(err);
      } else {
        var data = JSON.parse(body);
        dataHandler.saveRepo(data);
      }
    });
  },
  handleCrawledIssues(issues) {
    issues.forEach(issue => {
      var repoData = getRepoData(issue);
      if (dataHandler.repoIsNew(repoData)){
        // this.crawlRepo(repoData.url);
        // console.log(repoData.name);
      }
      dataHandler.saveIssue(issue);
    })
  }
}

function main(labels, languages) {
  githubRequestWrapper()
  .then((githubRequest) => {
    var issueCrawler = Object.create(IssueCrawler);
    issueCrawler.setup(githubRequest, languages);
    labels.forEach((label) => {
      var rootUrl = 'https://api.github.com/search/issues?per_page=100&q=state:open+type:issue+no:assignee';
      issueCrawler.crawlIssuesWithLabel(rootUrl, label);
    });
  });
}

main(GOOD_FIRST_BUG_LABELS, LANGUAGES);
