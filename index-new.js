'use strict'
const request = require('request');
const Twit = require('twit');
const config = require('./config');
const T = new Twit(config.twitConfig);
const http = require('http');
const P = config.pnetConfig;
let count = 0;

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('Hola.')
  res.end();
}).listen(3005);

const botData = {};
var stream = T.stream('user')

//1st call, listens for activity on BrianAndRobot account
stream.on('tweet', function (tweet) {
    //if hashtag exists, create an object to store data
    //TODO: move object into seperate class
    if (tweet.entities.hashtags[0]) {
      //assign the name of the person who tweeted to the userObject & the hashtag
      botData.whoTweeted = tweet.user.screen_name;

      //if there's a hashtag send the object to prepareDate
      botData.inputData = prepareDate(tweet.entities.hashtags[0].text);
      debugger;
    } else if (!tweet.entities.hashtags[0].text){
      console.log(`No Hashtag for ${tweet.user.screen_name}`);
    };
});


//2nd call seperates the season and year from the hashtag
//TODO: couldn't this be a method of the user class?
function prepareDate(seasonDate) {
  console.log(seasonDate);
  for (let i = 0; i < seasonDate.length; i++) {
    const index = seasonDate[i].search(/\d/);

    let season = seasonDate[i].substr(0, index);
    let year = seasonDate[i].substr(index);
    if (isNaN(year)) {
      console.log(season + year + "Year is not a number.");
      return;
    }
    //TODO: use es6 single argument syntax here
    let dates = {season: season, year: year};
    debugger;
    return dates;
  }
};
