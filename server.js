#!/usr/bin/env node
"use strict";

var express = require("express"),
  cors = require('cors'),
  config = require("config"),
  koop = require('koop')( config ),
  socrata = require('koop-socrata'),
  agol = require('koop-agol'),
  pgCache = require('koop-pgcache'),
  tiles = require('koop-tile-plugin');

var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    cluster.fork();
  });
} else {
  // this is not required but is helpful
  koop.registerCache( pgCache );

  //register providers with koop
  koop.register( socrata );
  koop.register( agol );

  // register the tiles plugin
  koop.register( tiles );

  // create an express app
  var app = express();
  app.use( cors() );

  app.use(function(req,res,next){
    var oldEnd = res.end;

    res.end = function() {
      oldEnd.apply(res, arguments);
    };

    next();
  });

  app.use(function (req, res, next) {
    res.removeHeader("Vary");
    next();
  });

  // add koop middleware
  app.use( koop );

  app.get('/status', function(req, res){
    res.json( koop.status );
  });

  app.set('view engine', 'ejs');
  app.use(express.static('views/public'));

  app.listen(process.env.PORT || config.server.port,  function() {
    console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
  });
}