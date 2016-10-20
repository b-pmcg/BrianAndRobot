'use strict'
const request = require('request');
const Twit = require('twit');
const config = require('./config');
const T = new Twit(config.twitConfig);
const http = require('http');
const P = config.pnetConfig;
let count = 0;

// get install twurl
//  twurl --authorize --consumerkey "key" --consumer-secret "secret" cat ~/.twurlrc


//TODO: implement server and monitor tweet stream for hashtags
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('hello, i know nodejitsu.')
  res.end();
}).listen(3000);

//var stream = T.stream('statuses/filter', { track: '#stashbot', language: 'en' })
var stream = T.stream('user')

stream.on('tweet', function (tweet) {
  //console.log(tweet)
  // const currentTweet = reply[i];;
    //check if hashtag exists:
    const hashtag = tweet.entities.hashtags[0];
    console.log('tweet text:', tweet.text);
    if (hashtag) {
      const userObject = {
        user: '',
        hashtag: '',
        dates: {
          first: {
            season: '',
            year: ''
          },
          second: {
            year: '',
            month: ''
          }
        }
      };
      userObject.user = tweet.user.screen_name;
      userObject.hashtag = [hashtag.text];
      console.log(userObject);
      prepareDate(userObject);
    } else if (!hashtag){
      console.log(`No Hashtag for ${tweet.user.screen_name}`);
    };
});


function sendTweet(message) {
  T.post('statuses/update', {status: message}, function(err, reply) {
    if (err) {
      console.log('error:', err);
    } else {
      console.log('tweet:', reply.text);
      count = 0;
      return;
    }
  });
};

// function getMentions() {
//   T.get('/statuses/mentions_timeline', {count: 10}, function(err, reply) {
//     if(err) {
//       console.log('error:', err);
//     } else {
//       for(let i = 0; i < reply.length; i++) {
//         const currentTweet = reply[i];;
//           //check if hashtag exists:
//           const hashtag = currentTweet.entities.hashtags[0];
//           if (hashtag) {
//             const userObject = {
//               iter_id: i,
//               user: '',
//               hashtag: '',
//               dates: {
//                 first: {
//                   season: '',
//                   year: 'whatevs'
//                 },
//                 second: {
//                   year: '',
//                   month: ''
//                 }
//               }
//             };
//             userObject.user = currentTweet.user.screen_name;
//             userObject.hashtag = [hashtag.text];
//             prepareDate(userObject);
//           } else if (!hashtag){
//             console.log(`No Hashtag for ${currentTweet.user.screen_name}`);
//           };
//       }
//     }
//   });
// };

//seperates the season and year from the hashtag
function prepareDate(userObject) {
  const dates = userObject.hashtag;
  for (let i = 0; i < dates.length; i++) {
    const index = dates[i].search(/\d/);
    userObject.dates.first.season = dates[i].substr(0, index);
    userObject.dates.first.year = dates[i].substr(index);
    // console.log("prepDate year type: " + (typeof userObject.dates.first.year));
    console.log(`Step 1: Prepping date ${userObject.dates.first.season} & ${userObject.dates.first.year}`);
    if (isNaN(userObject.dates.first.year)) {
      // console.log('isNaN is true, year is not a number.');
      // console.log(isNaN(userObject.dates.first.year));
      return;
    }
    buildDate(userObject);
  }
};

//runs app with twitter api:
//getMentions();

//converts season into a random month and formats year properly for pnet API
function buildDate(userObject) {
  count++
  const season = userObject.dates.first.season;
  const year = userObject.dates.first.year;
  let months = [];
  let yr;
  //set months to an array of three numbers based on season input
    switch (season) {
      case "fall":
        months = ['09', '10', '11'];
        break;
      case "winter":
        months = ['12', '01', '02'];
        break;
      case "spring":
        months = ['03', '04', '05'];
        break;
      case "summer":
        months = ['06', '07', '08'];
    }
    //check if two digit year should be prefixed with 19 or 20
    if (year > 20 && year < 100) {
      yr = '19' + year;;
    } else {
      yr = '20' + year;
    }
    const month = months[Math.floor(Math.random()*months.length)];
    //const yearString = yr.toString();
    userObject.dates.second.year = yr;
    userObject.dates.second.month = month;
    console.log(`Step 2: Building query with ${userObject.dates.second.month} & ${userObject.dates.second.year}`);
    composeTweet(userObject);
};

//queries pnet API and composes the tweet.
function composeTweet(userObject) {
  const year = userObject.dates.second.year;
  const month = userObject.dates.second.month;
  const season = userObject.dates.first.season;

  //pnet API returns all shows from specified month and year
  request.get({
    url: `https://api.phish.net/api.js?api=2.0&method=pnet.shows.query&format=json&year=${year}&month=${month}&apikey=${P.apikey}`
  },
  function(err, response, data) {
    if (err) {
      console.log(err);
    }
    const jsonData = JSON.parse(data);
    //if pnet API reports shows found, run buildDate again
    if (data === '{"success":0,"reason":"No Shows Found"}') {
      console.log(`No shows found with ${month} & ${year}, trying again...`);
      //check if count is less than 10
      if (count < 10) {
        console.log(`Count: ${count}`);
        buildDate(userObject);
      } else if (count >= 10) {
        console.log(`Count is ${count}, terminating.`);
        return;
      }
      //if a show is found on pnet API, reset count to zero
    } else {
      //check to see if show exists on phishtracks.com
      request.get({
        url: `http://phishtracks.com/shows/${jsonData[0].showdate}`
      },
      function(err, response, data) {
        if (err) {
          console.log(err);
        }
        //if show is not found on phishtracks.com, run buildDate again
        if (response.statusCode === 404) {
          console.log("Phishtracks doesn't seem to have this show online. Getting a new show...");
            buildDate(userObject);
        } else {
          //pick a random show out of pnet API results, get phishtracks.com link
          const show = jsonData[Math.floor(Math.random()*jsonData.length)];
          const phishTracksUrl = `http://phishtracks.com/shows/${show.showdate}`;
          const message = `@${userObject.user} ${show.venue}, ${show.nicedate}: ${phishTracksUrl} #phish`;
          console.log("Success! Sending tweet.");
          //console.log(message);
          sendTweet(message);
        }
      });
    }
  });
};
