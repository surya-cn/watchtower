const cheerio = require('cheerio');
fetch('https://steamcommunity.com/app/2807960/discussions/search/?q=crash')
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    $('.forum_topic').slice(0, 2).each((i, el) => {
      console.log('--- TOPIC ---');
      console.log($(el).html());
    });
  });
