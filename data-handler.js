var models = require('./models');

module.exports = (function(){
  return {
    repoIsNew: (repo) => {
      return models.PROJECT.findOne({
        where: {
          name: repo.name,
          url: repo.url,
        }
      }).then((project) => {
        return !!project;
      }, (err) => {
        throw err;
      });
    },
    saveIssue: (rawIssueData) => {
      var issueData = {
        url: rawIssueData.html_url,
        source: 'github',
        project: rawIssueData.url.split('/')[5],
        title: rawIssueData.title,
        date: rawIssueData.created_at.replace('T', ' ').replace('Z', ''),
      };
      return models.BUG.create(issueData);
    },
    saveRepo: (rawRepoData) => {
      var repoData = {
        url: rawRepoData.html_url,
        name: rawRepoData.name,
      };
      return models.PROJECT.create(repoData);
    }
  };
})();
