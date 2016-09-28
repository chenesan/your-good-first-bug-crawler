var models = require('./models');

module.exports = (function(){
  return {
    repoIsNew: (repo) => {
      return models.Project.findOne({
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
      return models.Project.findOne({
        where: {
          name: issueData.project,
          url: rawIssueData.html_url.split('/').slice(0, -2),
        },
      })
      .then((project) => {
        return project.createBug(issueData);
      });
    },
    saveRepo: (rawRepoData) => {
      var repoData = {
        url: rawRepoData.html_url,
        name: rawRepoData.name,
        language: rawRepoData.language,
      };
      return models.Language.findOrCreate({
        where: {
          name: repoData.language,
        }
      }).spread((language, created) => {
        return language.createProject(repoData);
      }, (error) => {
        console.log(error);
      });
    }
  };
})();
