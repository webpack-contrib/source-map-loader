var path = require("path");
var fs = require("fs");
var should = require("should");
var loader = require("../");

function execLoader(filename, callback) {
	var async = false;
	var deps = [];
	var context = {
		context: path.dirname(filename),
		resolve: function(context, request, callback) {
			process.nextTick(function() {
				callback(null, path.join(context, request));
			});
		},
		addDependency: function(dep) {
			deps.push(dep);
		},
		callback: function(err, res, map) {
			async = true;
			callback(err, res, map, deps);
		},
		async: function() {
			async = true;
			return this.callback;
		}
	};
	var res = loader.call(context, fs.readFileSync(filename, "utf-8"));
	if(!async) return callback(null, res, null, deps);
}

describe("source-map-loader", function() {
	it("should leave normal files untouched", function(done) {
		execLoader(path.join(__dirname, "fixtures", "normal-file.js"), function(err, res, map, deps) {
			should.equal(err, null);
			should.equal(res, "without SourceMap"),
			should.equal(map, null);
			deps.should.be.eql([]);
			done();
		});
	});
	it("should process inlined SourceMaps", function(done) {
		execLoader(path.join(__dirname, "fixtures", "inline-source-map.js"), function(err, res, map, deps) {
			should.equal(err, null);
			should.equal(res, "with SourceMap\n\n// comment"),
			map.should.be.eql({
				"version":3,
				"file":"inline-source-map.js",
				"sources":[
					path.join(__dirname, "fixtures", "inline-source-map.txt")
				],
				"sourcesContent":["with SourceMap"],
				"mappings":"AAAA"
			});
			deps.should.be.eql([]);
			done();
		});
	});
	it("should process external SourceMaps", function(done) {
		execLoader(path.join(__dirname, "fixtures", "external-source-map.js"), function(err, res, map, deps) {
			should.equal(err, null);
			should.equal(res, "with SourceMap\n\n// comment"),
			map.should.be.eql({
				"version":3,
				"file":"external-source-map.js",
				"sources":[
					path.join(__dirname, "fixtures", "external-source-map.txt")
				],
				"sourcesContent":["with SourceMap"],
				"mappings":"AAAA"
			});
			deps.should.be.eql([
				path.join(__dirname, "fixtures", "external-source-map.map")
			]);
			done();
		});
	});
	it("should process external SourceMaps (external sources)", function(done) {
		execLoader(path.join(__dirname, "fixtures", "external-source-map2.js"), function(err, res, map, deps) {
			should.equal(err, null);
			should.equal(res, "with SourceMap\n\n// comment"),
			map.should.be.eql({
				"version":3,
				"file":"external-source-map2.js",
				"sources":[
					path.join(__dirname, "fixtures", "external-source-map2.txt")
				],
				"sourcesContent":["with SourceMap"],
				"mappings":"AAAA"
			});
			deps.should.be.eql([
				path.join(__dirname, "fixtures", "data", "external-source-map2.map"),
				path.join(__dirname, "fixtures", "external-source-map2.txt")
			]);
			done();
		});
	});
});