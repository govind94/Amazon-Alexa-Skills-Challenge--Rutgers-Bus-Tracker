var http       = require('http'), 
    AlexaSkill = require('./AlexaSkill'),
    APP_ID     = 'amzn1.ask.skill.4954f828-6fae-45b8-a8c9-b6a7ad5d4e9f';  

var url = function(stopId){
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
        } else {
            string += ".";
        }
    }
    return string;
}

var getXmlFromNextbus = function(stopId, callback){
  
  http.get(url(stopId), function(res){
    var nextBusResponseString = '';

    res.on('data', function(data){
      nextBusResponseString += data;
    });

    res.on('end', function(){
      var data = []
      var parseString = require('xml2js').parseString;
      try {
          var nextBusResponseObject = parseString(nextBusResponseString, function (err, result) {
          for(var i = 0; i < result.body.predictions.length; i++) {
              var currPredictions = result.body.predictions[i];
              if (currPredictions.direction != undefined) {
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
  }).on('error', function(e){
    console.log('Error: ' + e);
``});
};

var handleNextBusRequest = function(intent, session, response){
  getXmlFromNextbus(intent.slots.stop.value, function(err, data){
    var speechOutput;
    if (err) {
        speechOutput = "Sorry, the Next Bus service is experiencing a problem. Please try again later";
    } else {
        speechOutput = "The next buses are " + data;
    }
    heading = "BusTimes";
    response.tellWithCard(speechOutput, heading, speechOutput);
  });
};

var NextBus = function(){
  AlexaSkill.call(this, APP_ID);
};

NextBus.prototype = Object.create(AlexaSkill.prototype);
NextBus.prototype.constructor = NextBus;

NextBus.prototype.eventHandlers.onLaunch = function(launchRequest, session, response){
  var output = 'Welcome to Next Bus. ' +
    'Say the number of a bus stop to get bus schedules.';

  var reprompt = 'Which bus stop do you want to find more about?';

  response.ask(output, reprompt);
};

NextBus.prototype.intentHandlers = {
  GetBusesByStopIntent: function(intent, session, response){
    handleNextBusRequest(intent, session, response);
  },

  HelpIntent: function(intent, session, response){
    var speechOutput = 'Get the distance from arrival for all Rutgers buses for any stop. ' +
      'Which bus stop would you like?';
    response.ask(speechOutput);
  }
};

exports.handler = function(event, context) {
    var skill = new NextBus();
    skill.execute(event, context);
};
