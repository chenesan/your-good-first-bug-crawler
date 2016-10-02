module.exports = (function(){
  var models = require('./models');
  return {
    issueExists: (issueData) => {
      return models.Issue.findOne({
        where: {
          url: issueData.url,
        }
      }).then((issue) => {
        return !!issue;
      }, (err) => {
        throw err;
      });
    },
    projectExists: (repo) => {
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
        return project.createIssue(issueData);
      }, (err) => {
        console.error('Err happen: ', err);
        console.error('Problematic issue data: ', issueData.project);
      })
      .then(
        () => {
          console.log('Save Issue: ', issueData.project.name, issueData.title);
        },
        (err) => {
          console.error('Save Issue ', issueData.title, ' failed: ', err);
        }
      );
    },
    saveProject: (projectData) => {
      return models.Language.findOrCreate({
        where: {
          name: projectData.language,
        }
      }).spread((language, created) => {
        return language.createProject(projectData);
      }, (err) => {
        console.log(err);
      }).then(
        () => {
          console.log('Save project: ', projectData.name);
        },
        (err) => {
          console.error('Save project ', projectData.name, ' failed: ', err);
        }
      );
    }
  };
})();
