var request = require('request');
var RateLimitRequest = require('./request');
var dataHandler = require('./data-handler');

var USER_AGENT = 'your-good-first-bug-crawler';
var LANGUAGES = ['python', 'javascript'];
var GOOD_FIRST_BUG_LABELS = ['good-first-bug']//, 'low-hanging-fruit', 'beginner', 'newbie', 'cake'];

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
  var name = urlSlices.pop();
  var owner = urlSlices.pop();
  return {
    name,
    owner,
    apiUrl: issueEntity.repository_url,
    url: `https://www.github.com/${owner}/${name}`,
  };
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
    searchRequest = Object.create(RateLimitRequest);
    searchRequest.setup(searchLimitData.remaining, searchLimitData.reset, searchLimitData.limit);
    coreRequest = Object.create(RateLimitRequest);
    coreRequest.setup(coreLimitData.remaining, coreLimitData.reset, coreLimitData.limit);
    function wrapper(url, callback) {
      var option = Object.create(basicGetOption, {
        url
      });
      if (url.includes('/search/')) {
        return searchRequest.request(option, callback);
      } else {
        return coreRequest.request(option, callback);
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
    this.request(startUrl, (err, response, body) => {
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
    var url = `${rootUrl}+label:${label}`;
    this.request(url, (err, response, body) => {
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
        }
      }
    });
  },
  crawlRepo(repoUrl) {
    this.request(repoUrl, (err, resp, body) => {
      if (err) {
        console.log(err);
      } else {
        var data = JSON.parse(body);
        data.url = data.html_url,
        dataHandler.saveRepo(data);
      }
    });
  },
  handleCrawledIssues(issues) {
    issues.forEach(issue => {
      var repoData = getRepoData(issue);
      dataHandler.repoExists(repoData).then((exist) => {
        if (exist) {
          this.crawlRepo(repoData.apiUrl);
        }
        var issueData = {
          url: issue.html_url,
          source: 'github',
          project: {
            name: issue.url.split('/')[5],
            url: issue.html_url.split('/').slice(0, -2),
          },
          title: issue.title,
          date: issue.created_at.replace('T', ' ').replace('Z', ''),
        };
        dataHandler.saveIssue(issue);
      });
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
