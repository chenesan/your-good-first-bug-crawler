var request = require('request');
var RateLimitRequest = require('./request');
var dataHandler = require('./data-handler');

var GITHUB_SEARCH_API_RATE = 2100;
var GITHUB_CORE_API_RATE = 800;
var USER_AGENT = 'your-good-first-bug-crawler';
var LANGUAGES = ['python', 'javascript'];
var GOOD_FIRST_BUG_LABELS = ['good-first-bug', 'beginner']//, 'low-hanging-fruit', 'beginner', 'newbie', 'cake'];

var basicGetOption = {
  method: 'GET',
  headers: {
    'User-Agent': 'your-good-first-bug-crawler',
  },
  qs: {
    client_id: process.env.OAUTH_CLIENT_ID,
    client_secret: process.env.OAUTH_CLIENT_SECRET,
  }
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

function buildRepoData(rawRepo) {
  var repoData = {
    url: rawRepo.html_url,
    language: rawRepo.language,
    name: rawRepo.name,
  }
  return repoData;
}

function buildRepoDataFromIssue(rawIssue) {
  var urlSlices = rawIssue.repository_url.split('/');
  var name = urlSlices.pop();
  var owner = urlSlices.pop();
  return {
    name,
    owner,
    apiUrl: rawIssue.repository_url,
    url: `https://github.com/${owner}/${name}`,
  };
}

function buildIssueData(rawIssue) {
  var repoData = buildRepoDataFromIssue(rawIssue);
  var issueData = {
    url: rawIssue.html_url,
    source: 'github',
    project: {
      name: repoData.name,
      url: repoData.url,
    },
    title: rawIssue.title,
    created_at: rawIssue.created_at.replace('T', ' ').replace('Z', ''),
  };
  return issueData;
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
  var searchRequest = Object.create(RateLimitRequest);
  searchRequest.setup(GITHUB_SEARCH_API_RATE);
  searchRequest.start();
  var coreRequest = Object.create(RateLimitRequest);
  coreRequest.setup(GITHUB_CORE_API_RATE);
  coreRequest.start();
  function wrapper(url) {
    var option = Object.create(basicGetOption);
    option.url = url;
    if (url.includes('/search/')) {
      return searchRequest.request(option);
    } else {
      return coreRequest.request(option);
    }
  }
  return wrapper
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
    return this.request(startUrl)
    .then(
      ({resp = undefined, body = undefined} = {}) => {
        var result = JSON.parse(body);
        if (!result.items) {
          console.log(response);
        }
        this.handleCrawledIssues(result.items);
        var linkData = getDataFromLinkHeader(response.headers.link);
        if (linkData.next) {
          this.crawlIssuesByPage(linkData.next);
        }
      },
      (err) => { throw err; }
    )
  },
  crawlIssuesByLanguages(rootUrl) {
    this.languages.forEach(language => {
      var startUrl = `${rootUrl}+language:${language}`;
      this.crawlIssuesByPage(startUrl);
    });
  },
  crawlIssuesWithLabel(rootUrl, label) {
    var url = `${rootUrl}+label:${label}`;
    this.request(url)
    .then(({resp = undefined, body = undefined} = {}) => {
      var result = JSON.parse(body);
      if (resp.headers.link) {
        if (result.total_count < 1000) {
          var linkData = getDataFromLinkHeader(resp.headers.link);
          if (linkData.next) {
            this.crawlIssuesByPage(linkData.next);
          }
        } else {
          this.crawlIssuesByLanguages(url);
        }
      }
      this.handleCrawledIssues(result.items);
    }, (err) => {
      throw err;
    });
  },
  crawlRepo(repoUrl) {
    return this.request(repoUrl)
    .then(({resp = undefined, body = undefined } = {}) => {
      var rawData = JSON.parse(body);
      var repoData = buildRepoData(rawData);
      return dataHandler.saveRepo(repoData);
    }, (err) => {
      throw err;
    });
  },
  handleCrawledIssues(issues) {
    issues.forEach(issue => {
      var repoData = buildRepoDataFromIssue(issue);
      var issueData = buildIssueData(issue);
      dataHandler.issueExists(issueData)
      .then((exist) => {
        if (!exist) {
          return dataHandler.repoExists(repoData)
          .then((exist) => {
            if (!exist) {
              return this.crawlRepo(repoData.apiUrl);
            } else {
              return Promise.resolve(repoData);
            }
          })
          .then(() => {
            try {
              dataHandler.saveIssue(issueData);
            } catch(err) {
              throw err;
            }
          }, (err) => {
            console.error(err);
          });
        }
      });
    });
  }
}

function main(labels, languages) {
  var githubRequest = githubRequestWrapper();
  var issueCrawler = Object.create(IssueCrawler);
  issueCrawler.setup(githubRequest, languages);
  labels.forEach((label) => {
    var rootUrl = 'https://api.github.com/search/issues?per_page=100&q=state:open+type:issue+no:assignee';
    issueCrawler.crawlIssuesWithLabel(rootUrl, label);
  });
}

main(GOOD_FIRST_BUG_LABELS, LANGUAGES);
