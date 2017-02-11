var http       = require('http'),
    AlexaSkill = require('./AlexaSkill'),
    APP_ID     = 'amzn1.ask.skill.189d0dbf-9d16-443f-b1d9-bc34e1ee4eb3';  

var url = function(stopId) {
    return 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=rutgers&stopId=' + stopId;
};

var convertToString = function(data) {
    var string = "";
    var n = data.length;
    for (var i = 0; i < n; i++) {
        string += data[i]["route"] + " in " + data[i]["minutes"] + (data[i]["minutes"] == 1 ? " minute" : " minutes");
        if (i < (n - 1)) {
            string += ", ";
            if (i == (n - 2)) {
                string += "and ";
            }
        } 
        else string += ".";
    }
    return string;
}

var getCorrectBus = function(stopId, data1, callback) {
    http.get(url(stopId), function(res) {
        var nextBusResponseString = '';
        res.on('data', function(data) {
            nextBusResponseString += data;
        });
        res.on('end', function() {
            var data = [];
            var parseString = require('xml2js').parseString;
            try {
                var nextBusResponseObject = parseString(nextBusResponseString, function (err, result) {
                    for (var i = 0; i < result.body.predictions.length; i++) {
                        var currPredictions = result.body.predictions[i];
                        if (data1.indexOf(currPredictions.$.routeTag) > -1) {
                            for (var j = 0; j < currPredictions.direction.length; j++) {
                                for (var k = 0; k < currPredictions.direction[j].prediction.length; k++) {
                                    var dict = {};
                                    dict["route"] = currPredictions.$.routeTitle;
                                    dict["minutes"] = Number(currPredictions.direction[j].prediction[k].$.minutes);
                                    data[data.length] = dict;
                                }
                            }
                        }
                    }
                    data.sort(function(a, b) {
                        if (a["minutes"] < b["minutes"]) return -1;
                        if (a["minutes"] > b["minutes"]) return 1;
                        return 0;
                    });
                });
            }
            catch(e) {
                console.log("Error");
                callback(1, convertToString(data));
            }
            callback(null, convertToString(data));
        });
    }).on('error', function(e) {
        console.log('Error: ' + e);
    });
};

var getXmlFromNextbus = function(stopId, callback) {
    http.get(url(stopId), function(res) {
        var nextBusResponseString = '';
        res.on('data', function(data) {
            nextBusResponseString += data;
        });
        res.on('end', function() {
            var data = [];
            var parseString = require('xml2js').parseString;
            try {
                var nextBusResponseObject = parseString(nextBusResponseString, function (err, result) {
                    for (var i = 0; i < result.body.predictions.length; i++) {
                        var currPredictions = result.body.predictions[i];
                        if (currPredictions.direction != undefined) data[data.length] = currPredictions.$.routeTag;
                    }
                });
            }
            catch(e) {
                console.log("Error" + e); 
                callback(1, data); 
            }
            callback(null, data);
        });
    }).on('error', function(e) {
        console.log('Error: ' + e);
    });
};

var handleNextBusRequest = function(intent, session, response) {
    var myData = [], source, destination;
    getXmlFromNextbus(intent.slots.src.value, function(err, srcData) {
        if (err) console.log("Error");
        else source = srcData;
        
        getXmlFromNextbus(intent.slots.dest.value, function(err, destData) {
            if (err) console.log("Error");
            else destination = destData;
            
            for (var x in source) {
                for (var y in destination) {
                    if (source[x] === destination[y]) myData[myData.length] = source[x];
                }
            }
            
            getCorrectBus(intent.slots.src.value, myData, function(err, data) {
                var speechOutput;
                if (err) speechOutput = "Sorry, the Next Bus service is experiencing a problem. Please try again later";
                else speechOutput = "The next buses are " + data;
                heading = "BusTimes";
                response.tellWithCard(speechOutput, heading, speechOutput);
            });
        });
    });
};

var NextBus1 = function() {
    AlexaSkill.call(this, APP_ID);
};

NextBus1.prototype = Object.create(AlexaSkill.prototype);
NextBus1.prototype.constructor = NextBus1;

NextBus1.prototype.eventHandlers.onLaunch = function(launchRequest, session, response) {
    var output = 'Welcome to Next Bus. ' + 'Say the number of source bus stop and destination bus stop to get bus schedules.';
    var reprompt = 'Which bus stops do you want to find more about?';
    response.ask(output, reprompt);
};

NextBus1.prototype.intentHandlers = {
    GetBusesByStopIntent: function(intent, session, response) {
        handleNextBusRequest(intent, session, response);
    },
    
    HelpIntent: function(intent, session, response) {
        var speechOutput = 'Request buses from a particular stop to a particular stop.';
        response.ask(speechOutput);
    }
};

exports.handler = function(event, context) {
    var skill = new NextBus1();
    skill.execute(event, context);
};
