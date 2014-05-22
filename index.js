/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var SourceMap = require("source-map");
var fs = require("fs");
var path = require("path");
var async = require("async");
var loaderUtils = require("loader-utils");

var baseRegex = "\\s*[@#]\\s*sourceMappingURL\\s*=\\s*(.*)",
	// Matches /* ... */ comments
	regex1 = new RegExp("/\\*"+baseRegex+"\\s*\\*/"),
	// Matches // .... comments
	regex2 = new RegExp("//"+baseRegex+"($|\n|\r\n?)"),
	// Matches DataUrls
	regexDataUrl = /data:[^;\n]+;base64,(.*)/;

module.exports = function(input, inputMap) {
	this.cacheable && this.cacheable();
	var resolve = this.resolve;
	var addDependency = this.addDependency;
	var match = input.match(regex1) || input.match(regex2);
	if(match) {
		var url = match[1];
		var dataUrlMatch = regexDataUrl.exec(url);
		var callback = this.async();
		if(dataUrlMatch) {
			processMap(JSON.parse((new Buffer(dataUrlMatch[1], "base64")).toString()), this.context, callback);
		} else {
			resolve(this.context, loaderUtils.urlToRequest(url), function(err, result) {
				if(err) return callback(err);
				addDependency(result);
				fs.readFile(result, "utf-8", function(err, content) {
					if(err) return callback(err);
					processMap(JSON.parse(content), path.dirname(result), callback);
				});
			}.bind(this));
			return;
		}
	} else {
		this.callback(null, input, inputMap);
	}
	function processMap(map, context, callback) {
		if(!map.sourcesContent || map.sourcesContent.length < map.sources.length) {
			var missingSources = map.sourcesContent ? map.sources.slice(map.sourcesContent.length) : map.sources;
			async.map(missingSources, function(source, callback) {
				resolve(context, loaderUtils.urlToRequest(source), function(err, result) {
					if(err) return callback(null, null);
					addDependency(result);
					fs.readFile(result, "utf-8", function(err, content) {
						if(err) return callback(null, null);
						callback(null, content);
					});
				});
			}, function(err, sourcesContent) {
				map.sourcesContent = map.sourcesContent ? map.sourcesContent.concat(sourcesContent) : sourcesContent;
				processMap(map, context, callback);
			});
			return;
		}
		async.map(map.sources, function(url, callback) {
			resolve(context, loaderUtils.urlToRequest(url), callback);
		}, function(err, sources) {
			map.sources = sources;
			callback(null, input.replace(match[0], match[2]), map);
		});
	}
}
