var models = require('./models');

module.exports = (function(){
  return {
    repoExists: (repo) => {
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
    saveIssue: (issueData) => {
      return models.Project.findOne({
        where: {
          name: issueData.project.name,
          url: issueData.project.url
        },
      })
      .then((project) => {
        return project.createBug(issueData);
      });
    },
    saveRepo: (repoData) => {
      return models.Language.findOrCreate({
        where: {
          name: repoData.language,
        }
      }).spread((language, created) => {
        return language.createProject(repoData);
      }, (error) => {
        throw error;
      });
    }
  };
})();
