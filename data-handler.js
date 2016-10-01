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
        console.error('Err happen: ', err);
        console.error('Problematic issue data: ', issueData.project);
      })
      .then(
        () => {
          console.log('Save bug: ', issueData.project.name, issueData.title);
        },
        (err) => {
          console.error('Save bug ', issueData.title, ' failed: ', err);
        }
      );
    },
    saveRepo: (repoData) => {
      return models.Language.findOrCreate({
        where: {
          name: repoData.language,
        }
      }).spread((language, created) => {
        return language.createProject(repoData);
      }, (err) => {
        throw err;
      }).then(
        () => {
          console.log('Save project: ', repoData.name);
        },
        (err) => {
          console.error('Save project ', repoData.name, ' failed: ', err);
        }
      );
    }
  };
})();
