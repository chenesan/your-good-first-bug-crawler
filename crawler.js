var co = require('co');
var request = require('request');
var RateLimitRequest = require('./request');
var dataHandler = require('./data-handler');

var GITHUB_SEARCH_API_RATE = 2100;
var GITHUB_CORE_API_RATE = 800;
var USER_AGENT = 'your-good-first-bug-crawler';
var LANGUAGES = ['Python', 'JavaScript'];
var GOOD_FIRST_BUG_LABELS = [
  'good-first-bug', 'beginner', 'low-hanging-fruit',
  'beginner', 'newbie', 'cake',
];

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

function final(promises) {
  var count = promises.length;
  return new Promise((resolve, reject) => {
    function decrementCount(resolve) {
      count -= 1;
      if (count === 0) {
        resolve();
      }
    }
    promises.forEach(promise => {
      promise.then(
        () => {
          return decrementCount(resolve);
        },
        () => {
          return decrementCount(resolve);
        }
      );
    })
  });

}

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

function buildProjectData(rawRepo) {
  var projectData = {
    description: rawRepo.description,
    language: rawRepo.language,
    name: rawRepo.name,
    popularity: rawRepo.stargazers_count,
    url: rawRepo.html_url,
  }
  return projectData;
}

function buildProjectDataFromIssue(rawIssue) {
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
  var projectData = buildProjectDataFromIssue(rawIssue);
  var issueData = {
    url: rawIssue.html_url,
    source: 'github',
    project: {
      name: projectData.name,
      url: projectData.url,
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
  crawlIssuesByPage: co.wrap(function* (startUrl) {
    try {
      var {resp, body} = yield this.request(startUrl);
      var result = JSON.parse(body);
      var dataHandlerPromise = this.handleCrawledIssues(result.items);
      var nextCrawlPromise;
      var linkData = getDataFromLinkHeader(resp.headers.link);
      if (linkData.next) {
        nextCrawlPromise = this.crawlIssuesByPage(linkData.next);
      }
      return final([Promise.resolve(nextCrawlPromise), dataHandlerPromise]);
    }
    catch (err) { console.error(err); }
  }),
  crawlIssuesByLanguages(rootUrl) {
    return final(this.languages.map(language => {
      var startUrl = `${rootUrl}+language:${language}`;
      return this.crawlIssuesByPage(startUrl);
    }));
  },
  crawlIssuesWithLabel: co.wrap(function* (rootUrl, label) {
    var url = `${rootUrl}+label:${label}`;
    try {
      var {resp, body} = yield this.request(url);
      var result = JSON.parse(body);
      var nextCrawlPromise;
      var dataHandlerPromise = this.handleCrawledIssues(result.items);
      if (resp.headers.link) {
        if (result.total_count < 1000) {
          var linkData = getDataFromLinkHeader(resp.headers.link);
          if (linkData.next) {
            nextCrawlPromise = this.crawlIssuesByPage(linkData.next);
          }
        } else {
          nextCrawlPromise = this.crawlIssuesByLanguages(url);
        }
      }
      return final([Promise.resolve(nextCrawlPromise), dataHandlerPromise]);
    }
    catch (err) {
      console.log(err);
    }
  }),
  crawlRepo(repoUrl) {
    return this.request(repoUrl)
    .then(({resp = undefined, body = undefined } = {}) => {
      var rawData = JSON.parse(body);
      var projectData = buildProjectData(rawData);
      return dataHandler.saveProject(projectData);
    }, (err) => {
      throw err;
    });
  },
  handleCrawledIssues(issues) {
    var gen = function* (issue) {
      var projectData = buildProjectDataFromIssue(issue);
      var issueData = buildIssueData(issue);
      try {
        if (!(yield dataHandler.projectExists(projectData))) {
          yield this.crawlRepo(projectData.apiUrl);
        }
        return yield dataHandler.saveIssue(issueData);
      }
      catch (err) {
        console.error(err);
      }
    };
    gen = gen.bind(this);
    var wrapper = co.wrap(gen);
    return final(issues.map(wrapper));
  }
}

function main(labels, languages) {
  var githubRequest = githubRequestWrapper();
  var issueCrawler = Object.create(IssueCrawler);
  issueCrawler.setup(githubRequest, languages);
  final(labels.map((label) => {
    var rootUrl = 'https://api.github.com/search/issues?per_page=100&q=state:open+type:issue+no:assignee';
    return issueCrawler.crawlIssuesWithLabel(rootUrl, label);
  }))
  .then(
    () => { process.exit(1); },
    () => { process.exit(-1); }
  );
}

main(GOOD_FIRST_BUG_LABELS, LANGUAGES);
