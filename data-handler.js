module.exports = (function(){
  var co = require('co');
  var models = require('./models');
  var issueExists = (issueData) => {
    return models.Issue.findOne({
      where: {
        url: issueData.url,
      }
    }).then((issue) => {
      return !!issue;
    }, (err) => {
      throw err;
    });
  };
  var projectExists = (repo) => {
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
  };
  var saveIssue = co.wrap(function* (issueData) {
    try {
      var project = yield models.Project.findOne({
        where: {
          name: issueData.project.name,
          url: issueData.project.url
        },
      });
      if (project) {
        var issue = yield models.Issue.findOne({
          where: {
            url: issueData.url,
          },
        });
        if (issue) {
          yield issue.update(issueData);
          console.log('Update Issue: ', issueData.project.name, issueData.title);
        } else {
          yield project.createIssue(issueData);
          console.log('Save Issue: ', issueData.project.name, issueData.title);
        }
      } else {
        console.log('There is no project ' + issueData.project.name
        + 'when save issue ' + issueData.title);
      }
    }
    catch(err) { console.error('Save Issue ', issueData.title, ' failed: ', err);}
  });
  var saveProject = (projectData) => {
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
  };
  return {
    issueExists,
    projectExists,
    saveIssue,
    saveProject,
  };
})();
