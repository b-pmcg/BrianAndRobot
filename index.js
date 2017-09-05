/* jshint node: true, esversion: 6 */
'use strict';
const request = require('request');
const Twit = require('twit');
const config = require('./config');
const T = new Twit(config.twitConfig);
const http = require('http');
const P = config.pnetConfig;
let count = 0;

http.createServer().listen(3005);

var stream = T.stream('user');

//1st call, listens for activity on BrianAndRobot account
stream.on('tweet', function(tweet) {
    //if hashtag exists, create an object to store data
    //TODO: move object into seperate class
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
        //assign the name of the person who tweeted to the userObject & the hashtag
        userObject.user = tweet.user.screen_name;
        userObject.hashtag = [hashtag.text];
        //if there's a hashtag send the object to prepareDate
        prepareDate(userObject);
    } else if (!hashtag) {
        console.log(`No Hashtag for ${tweet.user.screen_name}`);
    }
});

//Mock the user object for debugging and pass to prepareDate()
// const userObject = {
//     user: 'obiwan2',
//     hashtag: 'Summer94',
//     dates: {
//         first: {
//             season: '',
//             year: ''
//         },
//         second: {
//             year: '',
//             month: ''
//         }
//     }
// };
// prepareDate(userObject);

// 2nd call seperates the season and year from the hashtag
function prepareDate(userObject) {
    const dates = userObject.hashtag.toString();
    const index = dates.search(/\d/);
    userObject.dates.first.season = dates.substr(0, index);
    userObject.dates.first.year = dates.substr(index);
    console.log(`Step 1: Prepping date ${userObject.dates.first.season} & ${userObject.dates.first.year}`);
    if (isNaN(userObject.dates.first.year)) {
        console.log("Not a number.");
        return;
    }
    buildDate(userObject);
}

// 3rd call converts season into a random month and formats year properly for pnet API
function buildDate(userObject) {
    count++;
    const season = userObject.dates.first.season;
    const year = userObject.dates.first.year;
    let months = [];
    let yr;
    //set months to an array of three numbers based on season input
    switch (season.toLowerCase()) {
        case "fall":
        case "autumn":
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
    // Prefix two digit year with 19 or 20
    if (year > 20 && year < 100) {
        yr = '19' + year;
    } else {
        yr = '20' + year;
    }
    // Pick a random month within selected season
    const month = months[Math.floor(Math.random() * months.length)];
    userObject.dates.second.year = yr;
    userObject.dates.second.month = month;
    console.log(`Step 2: Building query with ${userObject.dates.second.month} & ${userObject.dates.second.year}`);
    composeTweet(userObject);
}

// 4th call queries pnet API and composes the tweet.
function composeTweet(userObject) {
    const year = userObject.dates.second.year;
    const month = userObject.dates.second.month;
    const season = userObject.dates.first.season;

    // Pnet API returns all shows from specified month and year
    //TODO: rewrite for phish.net API v 3
    request.get({
            url: `https://api.phish.net/api.js?api=2.0&method=pnet.shows.query&format=json&year=${year}&month=${month}&apikey=${P.apikey}`
        },
        function(err, response, data) {
            if (err) {
                console.log(err);
            }
            const jsonData = JSON.parse(data);
            //if pnet API reports no shows found, run buildDate again
            if (data === '{"success":0,"reason":"No Shows Found"}') {
                console.log(`No shows found with ${month} & ${year}, trying again...`);
                // We only want to do this 10 times, then quit
                if (count < 10) {
                    console.log(`Count: ${count}`);
                    buildDate(userObject);
                } else if (count >= 10) {
                    console.log(`Count is ${count}, terminating.`);
                    // TODO: probably should return some info back to the user here.
                    return;
                }
            } else {
                // check to see if show exists on phishtracks.com
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
                            const show = jsonData[Math.floor(Math.random() * jsonData.length)];
                            const phishTracksUrl = `http://phishtracks.com/shows/${show.showdate}`;
                            const message = `@${userObject.user} ${show.venue}, ${show.nicedate}: ${phishTracksUrl} #phish`;
                            console.log("Success! Sending tweet.");
                            console.log(`message: ${message}`);
                            sendTweet(message);
                        }
                    });
            }
        });
}

// 5th and final call, sends tweet
function sendTweet(message) {
    T.post('statuses/update', { status: message }, function(err, reply) {
        if (err) {
            console.log('error:', err);
        } else {
            console.log('tweet:', reply.text);
            // Set count back to 0 since tweet was successful
            count = 0;
            return;
        }
    });
}