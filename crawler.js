var request = require('request');
var dataHandler = require('./data-handler');

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
      setTimeout(() => { result = sendRequest(); },remainingSeconds);
      return result;
    }
  }
  requestWithRateLimit.remainingCount = initRemainingCount;
  requestWithRateLimit.resetTime = initResetTime;
  return requestWithRateLimit;
}

var issueSearchRequest = requestWrapper(10);
var projectGetRequest = requestWrapper(60);

var USER_AGENT = 'your-good-first-bug-crawler';
var LANGS = ['python', 'javascript'];
var goodFirstBugLabels = ['good-first-bug', 'low-hanging-fruit'];


function getStartUrlFromLink(link) {
  return link.split(';')[0].slice(1, -1);
}

function crawlIssuesByPage(startUrl) {

}

function crawlIssuesByLangs(rootUrl, langs) {

}

function getRepo(issueEntity) {
  return issueEntity.repository_url.split('/').pop();
}

function handleCrawledIssues(issues) {
  issues.forEach(issue => {
    var repo = getRepo(issue);
    if (!dataHandler.repoIsNew(repo)){
      crawlRepo(repo);
    }
    dataHandler.save(issue);
  })
}

function crawlIssuesWithLabel(rootUrl, label) {
  var url = `${rootUrl}+label:${label}`;
  var option = {
    url,
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
    },
  };
  issueSearchRequest(option, (err, response, body) => {
    if (err) {
      console.log(err);
    } else {
      var result = JSON.parse(body);
      handleCrawledIssues(result.items);
      if (result.total_count < 1000) {
        var startUrl = getStartUrlFromLink(response.headers.link);
        crawlIssuesByPage(startUrl);
      } else {
        crawlIssuesByLang(url, LANGS);
      }
    }
  });
}

goodFirstBugLabels.forEach((label) => {
  var rootUrl = 'https://api.github.com/search/issues?per_page=100&q=state:open+type:issue+no:assignee';
  crawlIssuesWithLabel(rootUrl, label);
})
