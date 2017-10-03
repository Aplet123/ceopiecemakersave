'use strict';
var express = require('express');
var http = require("https");
var bodyParser = require("body-parser");
var { URLSearchParams } = require('url');
var app = express();
require("dotenv").config();

var AWS = require("aws-sdk");
var s3 = new AWS.S3();

var auth = {};
var saves = {};
var rateLimits = {};

s3.getObject({
    Bucket: "tranquilitytestbucket",
    Key: "ceopiecemakersaves/auth.json"
}, function(err, data) {
    if (err) {
        throw err;
    } else {
        auth = JSON.parse(data.Body.toString("utf8"));
    }
});
s3.getObject({
    Bucket: "tranquilitytestbucket",
    Key: "ceopiecemakersaves/saves.json"
}, function(err, data) {
    if (err) {
        throw err;
    } else {
        saves = JSON.parse(data.Body.toString("utf8"));
    }
});


app.set('port', (process.env.PORT || 5000));

app.use(function(req, res, next) {
	res.set({"Access-Control-Allow-Origin": "*"});
	next();
});

app.use(bodyParser.json());
app.use(function (err, req, res, next) {
	if (err) {
		res.status(400).send(err);
	} else {
		next();
	}
});

app.use(function(req, res, next) {
	if (req.method == "POST") {
		for (let i in req.body) {
			if (req.body[i].length > 3000) {
				res.sendStatus(400);
				return;
			}
		}
		if (req.path.startsWith(process.env.ADMIN)) {
			if (! (req.body.method || req.body.param1 || req.body.param2 || req.body.param3)) {
				res.sendStatus(400);
			}
			if (req.body.method == "deletesave") {
				delete saves[req.body.param1.toLowerCase()][req.body.param2.toLowerCase()];
				s3.upload({
					Bucket: "tranquilitytestbucket",
					Key: "ceopiecemakersaves/saves.json",
					ContentType: "application/json",
					ACL: "public-read",
					Body: JSON.stringify(saves)
				}, function (err, data) {
					if (err) {
						throw err;
					}
					res.end("");
				});
			} else if (req.body.method == "deleteuser") {
				delete auth[req.body.param1.toLowerCase()];
				s3.upload({
					Bucket: "tranquilitytestbucket",
					Key: "ceopiecemakersaves/auth.json",
					Body: JSON.stringify(auth)
				}, function (err, data) {
					if (err) {
						throw err;
					}
					res.end("");
				});
			} else if (req.body.method == "createuser") {
				auth[req.body.param1.toLowerCase()] = req.body.param2;
				s3.upload({
					Bucket: "tranquilitytestbucket",
					Key: "ceopiecemakersaves/auth.json",
					ContentType: "application/json",
					Body: JSON.stringify(auth)
				}, function (err, data) {
					if (err) {
						throw err;
					}
					res.end("");
				});
			} else if (req.body.method == "createsave") {
				saves[req.body.param1.toLowerCase()][req.body.param2.toLowerCase()] = req.body.param3;
				s3.upload({
					Bucket: "tranquilitytestbucket",
					Key: "ceopiecemakersaves/saves.json",
					ContentType: "application/json",
					ACL: "public-read",
					Body: JSON.stringify(saves)
				}, function (err, data) {
					if (err) {
						throw err;
					}
					res.end("");
				});
			} else {
				res.sendStatus(400);
			}
		} else if (req.path.startsWith("/save")) {
			if (! (req.body.username || req.body.auth || req.body.data || req.body.name)) {
				res.sendStatus(400);
			} else {
				if (rateLimits[req.body.username] && Date.now() - rateLimits[req.body.username] <= 30000) {
					res.sendStatus(429);
					return;
				}
				rateLimits[req.body.username] = Date.now();
				if (! /^(?:[^,]*,){3}[^,]*\n(?:(?:\w*#\w*)|(?:[0-9a-fN]*),)*(?:(?:\w*#\w*)|(?:[0-9a-fN]*))?\n(?:\d*,[^,]*,(?:\w+:[0-9a-f]*,)*(?:\w+:[0-9a-f]*)?\n){4}(?:c\d+,[^,]+,[^,]*,[^,]*,(?:\d*,){12}(?:(?:true)|(?:false))\n)*$/.test(req.body.data)) {
					res.sendStatus(400);
				} else if (auth[req.body.username.toLowerCase()] === req.body.auth) {
					if (! saves[req.body.username.toLowerCase()]) {
						saves[req.body.username.toLowerCase()] = {};
					}
					saves[req.body.username.toLowerCase()][req.body.name.toLowerCase()] = req.body.data;
					s3.upload({
						Bucket: "tranquilitytestbucket",
						Key: "ceopiecemakersaves/saves.json",
						ContentType: "application/json",
						ACL: "public-read",
						Body: JSON.stringify(saves)
					}, function (err, data) {
						if (err) {
							throw err;
						}
					});
					var params = new URLSearchParams({
						user: req.body.username,
						name: req.body.name
					});
					res.end(process.env.DEPLOYED + "/save?" + params.toString());
				} else {
					res.sendStatus(401);
				}
			}
		} else {
			next();
		}
	} else {
		next();
	}
});

app.use(function(req, res, next) {
	if (req.method == "GET") {
		if (req.path.startsWith("/save")) {
			if (! (req.query.user || req.query.name)) {
				res.sendStatus(400);
			} else {
				if (saves[req.query.user.toLowerCase()] && saves[req.query.user.toLowerCase()][req.query.name.toLowerCase()]) {
					res.redirect("https://ceopiecemaker.github.io/index.html?q=" + encodeURIComponent(saves[req.query.user.toLowerCase()][req.query.name.toLowerCase()]));
				} else {
					res.sendStatus(403);
				}
			}
		} else {
			next();
		}
	} else {
		next();
	}
});

if (process.env.DEPLOYED) {
	setInterval(function () {
		http.get(process.env.DEPLOYED);
	}, 600000);
}

app.use(function(req, res) {
    res.redirect("https://ceopiecemaker.github.io/");
});

app.listen(app.get('port'), function() {
  console.log(`Yo yo yo wazzup iz ya boi ${app.get("port")} which is pretty dank!`);
});