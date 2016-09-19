module.exports = (function(){
  var count = 1;
  return {
    repoIsNew: () => { return true; },
    save: () => {
      console.log(count);
      count += 1;
    },
  };
})();
