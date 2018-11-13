/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var fs = require("fs");
var path = require("path");
var async = require("async");
var urlUtils = require("url");

// Matches only the last occurrence of sourceMappingURL
var baseRegex = "\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)(?![\\S\\s]*sourceMappingURL)",
	// Matches /* ... */ comments
	regex1 = new RegExp("/\\*"+baseRegex+"\\s*\\*/"),
	// Matches // .... comments
	regex2 = new RegExp("//"+baseRegex+"($|\n|\r\n?)"),
	// Matches DataUrls
	regexDataUrl = /data:[^;\n]+(?:;charset=[^;\n]+)?;base64,([a-zA-Z0-9+/]+={0,2})/,
	// Matches url with scheme, doesn't match Windows disk
	regexUrl = /[a-zA-Z]{2,}:/;

const FILE_SCHEME = "file:";

module.exports = function(input, inputMap) {
	this.cacheable && this.cacheable();
	var addDependency = this.addDependency;
	var emitWarning = this.emitWarning || function() {};
	var match = input.match(regex1) || input.match(regex2);
	if(match) {
		var url = match[1];
		var dataUrlMatch = regexDataUrl.exec(url);
		var callback = this.async();
		if(dataUrlMatch) {
			var mapBase64 = dataUrlMatch[1];
			var mapStr = (new Buffer(mapBase64, "base64")).toString();
			var map;
			try {
				map = JSON.parse(mapStr)
			} catch (e) {
				emitWarning("Cannot parse inline SourceMap '" + mapBase64.substr(0, 50) + "': " + e);
				return untouched();
			}
			processMap(map, this.context, callback);
		} else {
			resolveAbsolutePath(this.context, url, function(err, absoluteFilepath) {
				if(err) {
					emitWarning("Cannot find SourceMap '" + url + "': " + err);
					return untouched();
				}
				fs.readFile(absoluteFilepath, "utf-8", function(err, content) {
					if(err) {
						emitWarning("Cannot open SourceMap '" + absoluteFilepath + "': " + err);
						return untouched();
					}
					addDependency(absoluteFilepath);
					var map;
					try {
						map = JSON.parse(content);
					} catch (e) {
						emitWarning("Cannot parse SourceMap '" + url + "': " + e);
						return untouched();
					}
					processMap(map, path.dirname(absoluteFilepath), callback);
				});
			}.bind(this));
		}
	} else {
		var callback = this.callback;
		return untouched();
	}
	function untouched() {
		callback(null, input, inputMap);
	}
	function resolveAbsolutePath(context, url, resolveAbsolutePathCallback) {
		let filepath = url;
		if(regexUrl.test(filepath) && !filepath.startsWith(FILE_SCHEME)) {
			resolveAbsolutePathCallback("URL scheme not supported");
			return;
		}
		if(filepath.startsWith(FILE_SCHEME)) {
			if(urlUtils.fileURLToPath) {
				filepath = urlUtils.fileURLToPath(filepath);
			} else {
				resolveAbsolutePathCallback("file URL scheme support requires node 10.x");
				return;
			}
		}
		resolveAbsolutePathCallback(null, path.resolve(context, filepath));
	}
	function processMap(map, context, callback) {
		if(!map.sourcesContent || map.sourcesContent.length < map.sources.length) {
			var sourcePrefix = map.sourceRoot ? map.sourceRoot + "/" : "";
			map.sources = map.sources.map(function(s) { return sourcePrefix + s; });
			delete map.sourceRoot;
			var missingSources = map.sourcesContent ? map.sources.slice(map.sourcesContent.length) : map.sources;
			async.map(missingSources, function(source, callback) {
				resolveAbsolutePath(context, source, function(err, absoluteFilepath) {
					if(err) {
						emitWarning("Cannot find source file '" + source + "': " + err);
						return callback(null, null);
					}
					fs.readFile(absoluteFilepath, "utf-8", function(err, content) {
						if(err) {
							emitWarning("Cannot open source file '" + absoluteFilepath + "': " + err);
							return callback(null, null);
						}
						addDependency(absoluteFilepath);
						callback(null, {
							source: absoluteFilepath,
							content: content
						});
					});
				});
			}, function(err, info) {
				map.sourcesContent = map.sourcesContent || [];
				info.forEach(function(res) {
					if(res) {
						map.sources[map.sourcesContent.length] = res.source;
						map.sourcesContent.push(res.content);
					} else {
						map.sourcesContent.push(null);
					}
				});
				processMap(map, context, callback);
			});
			return;
		}
		callback(null, input.replace(match[0], ""), map);
	}
}
