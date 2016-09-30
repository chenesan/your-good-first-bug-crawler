module.exports = (function(){
  var models = require('./models');
  return {
    issueExists: (issueData) => {
      return models.Bug.findOne({
        where: {
          url: issueData.url,
        }
      }).then((issue) => {
        return !!issue;
      }, (err) => {
        throw err;
      });
    },
    repoExists: (repo) => {
      return models.Project.findOne({
        where: {
          name: repo.name,
          url: repo.url,
        }
      }).then((project) => {
        console.log(project, repo.name, repo.url);
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
      }, (err) => {
        console.log('Err happen: ', err);
        console.log('Problematic issue data: ', issueData.project);
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
