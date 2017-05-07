var http = require('http'),
    AlexaSkill = require('./AlexaSkill'),
    fs = require('fs'),
    xml2js = require('xml2js'),
    APP_ID = /* YOUR_APP_ID */,
    parser = new xml2js.Parser();

function httpGet(url, callback) {
    http.get(url, function(res) {
        var body = '';
        res.on('data', function(data) {
            body += data;
        });
        res.on('end', function() {
            callback(body);
        });
    }).on('error', function(e){
    console.log('Error: ' + e);
    });
}

var getSchedule = function(data) {
    var timings = "";
    var n = data.length;
    for (var i = 0; i < n; i++) {
        timings += data[i].routeTitle + " in " + data[i].timeMinutes + (data[i].timeMinutes == 1 ? " minute" : " minutes");
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
        var parseString = xml2js.parseString;
            var reply = parseString(res, function (err, result) {
                for (var i = 0; i < result.body.predictions.length; i++) {
                    var predictions = result.body.predictions[i];
                    if (buses.indexOf(predictions.$.routeTag) != -1 && predictions.direction !== undefined) {
                        for (var j = 0; j < predictions.direction.length; j++) {
                            for (var k = 0; k < predictions.direction[j].prediction.length; k++) {
                                var schedule = {};
                                schedule.routeTitle = predictions.$.routeTitle;
                                schedule.timeMinutes = Number(predictions.direction[j].prediction[k].$.minutes);
                                data[data.length] = schedule;
                            }
                        }
                    }
                }
                data.sort(function(a, b) {
                    if (a.timeMinutes < b.timeMinutes) return -1;
                    if (a.timeMinutes > b.timeMinutes) return 1;
                    return 0;
                });
            });
        if (reply.error) {
            console.log("Error: " + reply.error.message);
            callback(1, new Error(reply.error.message));
        } 
        else {
            callback(0, getSchedule(data));
        }
    });
};

var getXmlFromNextbus = function(stopId, callback) {
    var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=rutgers&stopId='+stopId;
    httpGet(url, function(res) {
        var data = [];
        var parseString = xml2js.parseString;
            var reply = parseString(res, function (err, result) {
                for (var i = 0; i < result.body.predictions.length; i++) {
                    var predictions = result.body.predictions[i];
                    if (predictions.direction !== undefined) data[data.length] = predictions.$.routeTag;
                }
            });
            if (reply.error) {
            console.log("Error: " + reply.error.message);
            callback(1, new Error(reply.error.message));
            } 
            else {
                callback(0, data);
            }
    });
};

var handleRequest = function(intent, response) {
    var output, reprompt;
    if ((intent.slots.destination.value) === undefined) {
        output = "You did not say the destination bus stop. Please say the name of the source bus stop and the destination bus stop to get bus schedules.";
        reprompt = "Which bus stops do you want to find more about?";
        response.ask(output, reprompt);
    }
    
    else if ((intent.slots.source.value) === undefined) {
        output = "You did not say the source bus stop. Please say the name of the source bus stop and the destination bus stop to get bus schedules.";
        reprompt = "Which bus stops do you want to find more about?";
        response.ask(output, reprompt);
    }
    
    else if ((BUS_STOPS.indexOf((intent.slots.source.value).toUpperCase()) == -1) || (BUS_STOPS.indexOf((intent.slots.destination.value).toUpperCase()) == -1)) {
        output = "Incorrect stop name.";
        reprompt = "Which bus stops do you want to find more about?";
        response.ask(output, reprompt);
    }
    else {
    var buses = [], source, destination, sourceStopId, destinationStopId;
    fs.readFile("/var/task/DB.xml", function (err, content) {
        parser.parseString(content, function(err, result) {
            for (var i = 0; i < result.body.stop.length; i++) {
                var busStop = result.body.stop[i];
                var sEqual = (busStop.$.name).toUpperCase() === (intent.slots.source.value).toUpperCase();
                if (sEqual) sourceStopId = busStop.$.id;
                var dEqual = (busStop.$.name).toUpperCase() === (intent.slots.destination.value).toUpperCase();
                if (dEqual) destinationStopId = busStop.$.id;
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
    }
}

var RutgersBusTracker = function() {
    AlexaSkill.call(this, APP_ID);
}

RutgersBusTracker.prototype = Object.create(AlexaSkill.prototype);
RutgersBusTracker.prototype.constructor = RutgersBusTracker;

RutgersBusTracker.prototype.eventHandlers.onLaunch = function(launchRequest, session, response) {
    var output = 'Welcome to Rutgers Bus Tracker. ' + 'Say the name of the source bus stop and the destination bus stop to get bus schedules.';
    var reprompt = 'Which bus stops do you want to find more about?';
    response.ask(output, reprompt);
}

RutgersBusTracker.prototype.intentHandlers = {
    GetBusesByStopIntent: function(intent, session, response) {
        handleRequest(intent, response);
    },
    
    "AMAZON.HelpIntent": function(intent, session, response) {
        var speechOutput = 'Request bus timings from one stop to another inside the University campus. You could ask, "Get next buses from College Hall to Scott Hall."';
        var reprompt = 'Which bus stops do you want to find more about?';
        response.ask(speechOutput, reprompt);
    },
    
    "AMAZON.StopIntent": function(intent, session, response) {
      response.tell("Goodbye!");
    },
    
    "AMAZON.CancelIntent": function(intent, session, response) {
      response.tell("Goodbye!");  
    }
}

exports.handler = function(event, context) {
    var skill = new RutgersBusTracker();
    skill.execute(event, context);
}

var BUS_STOPS = [
    "LIPMAN HALL",
    "COLLEGE HALL",
    "COLLEGE WHOLE",
    "COLLEGE HOLE",
    "BRAVO SUPERMARKET",
    "HILL CENTER NORTH",
    "HILL CENTER SOUTH",
    "ALLISON ROAD CLASSROOMS",
    "PUBLIC SAFETY BUILDING SOUTH",
    "ROCKOFF HALL",
    "RED OAK LANE",
    "LIVINGSTON PLAZA",
    "LIVINGSTON STUDENT CENTER",
    "SCOTT HALL",
    "SCOTT HOLE",
    "SCOTT WHOLE",
    "SCOTT HOME",
    "SCOUT HOME",
    "TRAIN STATION",
    "PATERSON STREET",
    "FOOD SCIENCES BUILDING",
    "BIEL ROAD",
    "HENDERSON",
    "KATZENBACH",
    "GIBBONS",
    "PUBLIC SAFETY BUILDING NORTH",
    "LIBERTY STREET",
    "ZIMMERLI ARTS MUSEUM",
    "STUDENT ACTIVITIES CENTER",
    "STUDENT ACTIVITY CENTER",
    "RUTGERS STUDENT CENTER",
    "VISITOR CENTER",
    "STADIUM",
    "WERBLIN BACK ENTRANCE",
    "SCIENCE BUILDING",
    "LIBRARY OF SCIENCE",
    "BUSCH SUITES",
    "BUSCH CAMPUS CENTER",
    "BUELL APARTMENTS",
    "WERBLIN MAIN ENTRANCE",
    "QUADS",
    "DAVIDSON HALL",
    "NURSING SCHOOL",
    "COLONY HOUSE"
    ];
