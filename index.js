/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var fs = require("fs");
var path = require("path");
var loaderUtils = require("loader-utils");
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

const DEFAULT_OPTIONS = {
	// Prevent the loader to rewrite all sources as absolute paths
	keepRelativeSources: false
};

module.exports = function(input, inputMap) {
	const options = Object.assign({}, DEFAULT_OPTIONS, loaderUtils.getOptions(this));
	this.cacheable && this.cacheable();
	var addDependency = this.addDependency;
	var emitWarning = this.emitWarning || function() {};
	var match = input.match(regex1) || input.match(regex2);
	var callback;
	if(match) {
		var url = match[1];
		var dataUrlMatch = regexDataUrl.exec(url);
		callback = this.async();
		if(dataUrlMatch) {
			var mapBase64 = dataUrlMatch[1];
			var mapStr = Buffer.from(mapBase64, "base64").toString();
			var map;
			try {
				map = JSON.parse(mapStr)
			} catch (e) {
				emitWarning(new Error("Cannot parse inline SourceMap '"
					+ mapBase64.substr(0, 50) + "': " + e));
				return untouched();
			}
			processMap(map, this.context, callback);
		} else {
			resolveAbsolutePath(this.context, url, function(err, absoluteFilepath) {
				if(err) {
					emitWarning(new Error("Cannot find SourceMap '" + url + "': " + err));
					return untouched();
				}
				fs.readFile(absoluteFilepath, "utf-8", function(err, content) {
					if(err) {
						emitWarning(new Error("Cannot open SourceMap '" + absoluteFilepath + "': " + err));
						return untouched();
					}
					addDependency(absoluteFilepath);
					var map;
					try {
						map = JSON.parse(content);
					} catch (e) {
						emitWarning(new Error("Cannot parse SourceMap '" + url + "': " + e));
						return untouched();
					}
					processMap(map, path.dirname(absoluteFilepath), callback);
				});
			}.bind(this));
		}
	} else {
		callback = this.callback;
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
		const sourcePrefix = map.sourceRoot ? map.sourceRoot + "/" : "";
		const sources = map.sources.map(function(s) { return sourcePrefix + s; });
		delete map.sourceRoot;
		const sourcesContent = map.sourcesContent || [];
		const sourcesPromises = sources.map((source, sourceIndex) => new Promise((resolveSource) => {
			resolveAbsolutePath(context, source, function(err, absoluteFilepath) {
				if(err) {
					emitWarning(new Error("Cannot find source file '" + source + "': " + err));
					return resolveSource({
						source: source,
						content: sourcesContent[sourceIndex] != null ? sourcesContent[sourceIndex] : null
					});
				}
				if(sourcesContent[sourceIndex] != null) {
					return resolveSource({
						source: absoluteFilepath,
						content: sourcesContent[sourceIndex]
					});
				}
				fs.readFile(absoluteFilepath, "utf-8", function(err, content) {
					if(err) {
						emitWarning(new Error("Cannot open source file '" + absoluteFilepath + "': " + err));
						return resolveSource({
							source: absoluteFilepath,
							content: null
						});
					}
					addDependency(absoluteFilepath);
					resolveSource({
						source: absoluteFilepath,
						content: content
					});
				});
			});
		}));
		Promise.all(sourcesPromises)
			.then((results) => {
				if (!options.keepRelativeSources) {
					map.sources = results.map(res => res.source);
				}
				map.sourcesContent = results.map(res => res.content);
				callback(null, input.replace(match[0], ""), map);
			});
	}
}
