var request = require('request');
var dataHandler = require('./data-handler');

var USER_AGENT = 'your-good-first-bug-crawler';
var LANGS = ['python', 'javascript'];
var goodFirstBugLabels = ['good-first-bug', 'low-hanging-fruit'];

/* helper */

function getStartUrlFromLink(link) {
  return link.split(';')[0].slice(1, -1);
}

function getRepo(issueEntity) {
  return issueEntity.repository_url.split('/').pop();
}

/* wrapper of request for rate limit */

function requestWrapper(initRemainingCount = Infinity, initResetTime = 0) {
  function requestWithRateLimit(option, callback) {
    var sendRequest = () => {
      var wrappedCallback = (err, resp, body) => {
        if (err) {
          throw err;
        } else {
          requestWithRateLimit.remainingCount = resp.headers['x-ratelimit-remaining'];
          requestWithRateLimit.resetTime = resp.headers['x-ratelimit-reset'];
          callback(err, resp, body);
        }
      }
      return request(option, wrappedCallback);
    }
    if (requestWithRateLimit.rateLimitRemaining) {
      return sendRequest();
    } else {
      var currentTime = Date.now() / 1000;
      var remainingSeconds = currentTime - request.rateLimitResetTime + 1;
      var result;
      setTimeout(() => { result = sendRequest(); }, remainingSeconds * 1000);
      return result;
    }
  }
  requestWithRateLimit.remainingCount = initRemainingCount;
  requestWithRateLimit.resetTime = initResetTime;
  return requestWithRateLimit;
}

function getRateLimit() {
  var option = {
    url: 'https://api.github.com/rate_limit',
    method: 'GET',
    headers: {
      'User-Agent': 'your-good-first-bug-crawler',
    },
  };
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
    searchRequest = requestWrapper(searchLimitData.remaining, searchLimitData.reset);
    coreRequest = requestWrapper(coreLimitData.remaining, coreLimitData.reset);
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
  setup(requestFunc) {
    this.request = requestFunc;
  },
  crawlIssuesByPage(startUrl) {

  },
  crawlIssuesByLangs(rootUrl, langs) {

  },
  crawlIssuesWithLabel(rootUrl, label) {
    var url = `${rootUrl}+label:${label}`;
    var option = {
      url,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
      },
    };
    this.request(option, (err, response, body) => {
      if (err) {
        console.log(err);
      } else {
        var result = JSON.parse(body);
        this.handleCrawledIssues(result.items);
        if (result.total_count < 1000) {
          var startUrl = getStartUrlFromLink(response.headers.link);
          this.crawlIssuesByPage(startUrl);
        } else {
          this.crawlIssuesByLangs(url, LANGS);
        }
      }
    });
  },
  handleCrawledIssues(issues) {
    issues.forEach(issue => {
      var repo = getRepo(issue);
      if (!dataHandler.repoIsNew(repo)){
        crawlRepo(repo);
      }
      dataHandler.save(issue);
    })
  }
}

function main() {
  githubRequestWrapper()
  .then((githubRequest) => {
    var issueCrawler = Object.create(IssueCrawler);
    issueCrawler.setup(githubRequest);
    goodFirstBugLabels.forEach((label) => {
      var rootUrl = 'https://api.github.com/search/issues?per_page=100&q=state:open+type:issue+no:assignee';
      issueCrawler.crawlIssuesWithLabel(rootUrl, label);
    });
  });
}

main();
