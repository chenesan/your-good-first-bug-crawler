module.exports = (function(){
  var count = 1;
  return {
    repoIsNew: () => { return true; },
    saveIssue: () => {
      //console.log(count);
      count += 1;
    },
    saveRepo: (repo) => {
      //console.log(repo.name);
    }
  };
})();
