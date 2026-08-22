(()=>{
const fixed={
  ninja:'https://ninja-y-game.cwhit.chatgpt.site/',
  ninjay:'https://ninja-y-game.cwhit.chatgpt.site/',
  mowing:'https://malachis-mowing-fort-scott.cwhit.chatgpt.site/',
  brainrot:'https://brainrot-movie-maker.cwhit.chatgpt.site/'
};
for(const [id,url] of Object.entries(fixed)) localStorage.setItem('project-url-'+id,url);
window.CalculatorProjectLinks=Object.freeze({...fixed});
})();