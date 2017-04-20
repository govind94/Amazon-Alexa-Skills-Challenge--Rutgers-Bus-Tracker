var http       = require('http'),
    AlexaSkill = require('./AlexaSkill'),
    fs = require('fs'),
    xml2js = require('xml2js'),
    APP_ID     = 'amzn1.ask.skill.38e0b38e-1e18-4ac7-8a69-aa883b92ab32';

function httpGet(url, callback) {
    http.get(url, function(res) {
        var body = '';
        res.on('data', function(data) {
            body += data;
        });
        res.on('end', function() {
            callback(body);
        });
    });
};

var getSchedule = function(data) {
    var timings = "";
    var n = data.length;
    for (var i = 0; i < n; i++) {
        timings += data[i]["routeTitle"] + " in " + data[i]["timeMinutes"] + (data[i]["timeMinutes"] == 1 ? " minute" : " minutes");
        if (i < (n - 1)) {
            timings += ", ";
            if (i == (n - 2)) {
                timings += "and ";
            }
        } 
        else timings += ".";
    }
    return timings;
};

var getBusList = function(stopId, buses, callback) {
    var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=rutgers&stopId='+stopId;
    httpGet(url, function(res) {
        var data = [];
        var parseString = require('xml2js').parseString;
        try {
            var response = parseString(res, function (err, result) {
                for (var i = 0; i < result.body.predictions.length; i++) {
                    var predictions = result.body.predictions[i];
                    if (buses.indexOf(predictions.$.routeTag) > -1) {
                        for (var j = 0; j < predictions.direction.length; j++) {
                            for (var k = 0; k < predictions.direction[j].prediction.length; k++) {
                                var schedule = {};
                                schedule["routeTitle"] = predictions.$.routeTitle;
                                schedule["timeMinutes"] = Number(predictions.direction[j].prediction[k].$.minutes);
                                data[data.length] = schedule;
                            }
                        }
                    }
                }
                data.sort(function(a, b) {
                    if (a["timeMinutes"] < b["timeMinutes"]) return -1;
                    if (a["timeMinutes"] > b["timeMinutes"]) return 1;
                    return 0;
                });
            });
        }
        catch(e) {
            console.log("Error: " + e);
            callback(1, getSchedule(data));
        }
        callback(null, getSchedule(data));
    });
};

var getXmlFromNextbus = function(stopId, callback) {
    var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=rutgers&stopId='+stopId;
    httpGet(url, function(res) {
        var data = [];
        var parseString = require('xml2js').parseString;
        try {
            var response = parseString(res, function (err, result) {
                for (var i = 0; i < result.body.predictions.length; i++) {
                    var predictions = result.body.predictions[i];
                    if (predictions.direction !== undefined) data[data.length] = predictions.$.routeTag;
                }
            });
        }
        catch(e) {
            console.log("Error: " + e); 
            callback(1, data); 
        }
        callback(null, data);
    });
};

var handleRequest = function(intent, session, response) {
    var buses = [], source, destination, sourceStopId, destinationStopId;
    var parser = new xml2js.Parser();
    fs.readFile("/var/task/DB.xml", function (err, content) {
        parser.parseString(content, function(err, result) {
            for (var i = 0; i < result.body.stop.length; i++) {
                var busStop = result.body.stop[i];
                var isEqual = (busStop.$.name).toUpperCase() === (intent.slots.source.value).toUpperCase();
                if (isEqual) sourceStopId = busStop.$.id;
                isEqual = (busStop.$.name).toUpperCase() === (intent.slots.destination.value).toUpperCase();
                if (isEqual) destinationStopId = busStop.$.id;
            }
            getXmlFromNextbus(sourceStopId, function(err, sourceStops) {
                if (err) console.log("Error!");
                else source = sourceStops;
                
                getXmlFromNextbus(destinationStopId, function(err, destinationStops) {
                    if (err) console.log("Error!");
                    else destination = destinationStops;
                    
                    for (var x in source) {
                        for (var y in destination) {
                            if (source[x] === destination[y]) buses[buses.length] = source[x];
                        }
                    }
                    
                    getBusList(sourceStopId, buses, function(err, data) {
                        var speechOutput;
                        if (err) speechOutput = "Sorry! Rutgers Bus Tracker is experiencing a problem. Please try again later";
                        else {
                            if (data) speechOutput = "The next buses are " + data;
                            else speechOutput = "There are no direct buses from " + intent.slots.source.value + " to " + intent.slots.destination.value;
                        }
                        
                        var heading = "Bus Schedules";
                        response.tellWithCard(speechOutput, heading, speechOutput);
                    });
                });
            });
        });
    });
};

var RutgersBusTracker = function() {
    AlexaSkill.call(this, APP_ID);
};

RutgersBusTracker.prototype = Object.create(AlexaSkill.prototype);
RutgersBusTracker.prototype.constructor = RutgersBusTracker;

RutgersBusTracker.prototype.eventHandlers.onLaunch = function(launchRequest, session, response) {
    var output = 'Welcome to Rutgers Bus Tracker. ' + 'Say the name of the source bus stop and the destination bus stop to get bus schedules.';
    var reprompt = 'Which bus stops do you want to find more about?';
    response.ask(output, reprompt);
};

RutgersBusTracker.prototype.intentHandlers = {
    GetBusesByStopIntent: function(intent, session, response) {
        handleRequest(intent, session, response);
    },
    
    HelpIntent: function(intent, session, response) {
        var speechOutput = 'Request bus timings from one stop to another inside the University campus.';
        response.ask(speechOutput);
    }
};

exports.handler = function(event, context) {
    var skill = new RutgersBusTracker();
    skill.execute(event, context);
};
