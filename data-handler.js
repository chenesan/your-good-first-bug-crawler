var mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

const BUG_TABLE = process.env.BUG_TABLE;
const LANGUAGE_TABLE = process.env.LANGUAGE_TABLE;
const PROJECT_TABLE = process.env.PROJECT_TABLE;
const BUG_LANGUAGE_TABLE = process.env.BUG_LANGUAGE_TABLE;

connection.connect();

module.exports = (function(){
  return {
    repoIsNew: (repo) => {
      var sql = `SELECT EXISTS(SELECT * FROM ${PROJECT_TABLE} WHERE name = '${repo.name}' AND url = '${repo.url}');`;
      return new Promise((resolve, reject) => {
        connection.query(sql, (err, result) => {
          if (err) {
            console.log(sql);
            console.log(err);
          } else {
            var isNew = (result[0][Object.keys(result[0])] === 0);
            resolve(isNew);
          }
        })
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
      var sql = `INSERT INTO ${BUG_TABLE} (created_at, project_id, title, url) ` +
      `SELECT '${issueData.date}', id, '${issueData.title}', '${issueData.url}' ` +
      `FROM ${PROJECT_TABLE} WHERE name = '${issueData.project}';`;

      connection.query(
        sql,
        (err, result) => {
          if (err) {
            console.log(sql);
            console.log(err);
          } else {
          }
        }
      );

    },
    saveRepo: (rawRepoData) => {
      var repoData = {
        url: rawRepoData.html_url,
        name: rawRepoData.name,
      };
      console.log(repoData);
      var sql = `INSERT INTO ${PROJECT_TABLE} (url, name) VALUES ('${repoData.url}', '${repoData.name}');`;
      connection.query(sql, (err, result) => {
        if (err) {
          console.log(sql);
          console.log(err);
        } else {
          console.log('insert repo success');
        }
      })
    }
  };
})();
