import path from 'path';
import fs from 'fs';
import loader from '../src';
import {expect} from 'chai';

const execLoader = (filename, callback) => {
  let async = false;
  const deps = [];
  const warns = [];
  const context = {
    context: path.dirname(filename),
    resolve(context, request, callback) {
      process.nextTick(() => {
        const p = path.join(context, request);
        if (fs.existsSync(p)) {
          callback(null, p);
        } else {
          callback(new Error('File not found'));
        }
      });
    },
    addDependency(dep) {
      deps.push(dep);
    },
    emitWarning(warn) {
      warns.push(warn);
    },
    callback(err, res, map) {
      async = true;
      callback(err, res, map, deps, warns);
    },
    async() {
      async = true;
      return this.callback;
    }
  };
  const res = loader.call(context, fs.readFileSync(filename, 'utf-8'));
  if (!async) return callback(null, res, null, deps, warns);
};

describe('source-map-loader', () => {
  let sourceMaps;
  const originalCode = 'let sourceMaps = true;\n';
  const compiledCode = '"use strict";\n\nvar sourceMaps = true;\n\n';

  beforeEach(() => {
    sourceMaps = {
      version: 3,
      sources: [path.join(__dirname, 'fixtures', 'test.es6.js')],
      names: [],
      mappings: ';;AAAA,IAAI,UAAU,GAAG,IAAI,CAAC',
      file: 'test.es5.js',
      sourcesContent: [originalCode]
    };
  });

  it('should leave normal files untouched', done => {
    const [sourceContent] = sourceMaps.sourcesContent;

    execLoader(path.join(__dirname, 'fixtures', 'test.es6.js'), (err, res, map, deps, warns) => {
      expect(err).to.be.null;
      expect(warns).to.eql([]);
      expect(res).to.equal(sourceContent);
      expect(map).to.be.undefined;
      expect(deps).to.eql([]);
      done();
    });
  });

  it('should process inlined SourceMaps', done => {
    const file = 'test.es5.inline.js';
    sourceMaps.file = file;

    execLoader(path.join(__dirname, 'fixtures', file), (err, res, map, deps, warns) => {
      expect(err).to.be.null;
      expect(warns).to.eql([]);
      expect(res).to.equal(compiledCode);
      expect(map).to.eql(sourceMaps);
      expect(deps).to.eql([]);
      done();
    });
  });

  it('should process external SourceMaps', done => {
    const file = 'test.es5.js';
    sourceMaps.file = file;

    execLoader(path.join(__dirname, 'fixtures', file), (err, res, map, deps, warns) => {
      expect(err).to.be.null;
      expect(warns).to.eql([]);
      expect(res).to.equal(compiledCode);
      expect(map).to.eql(sourceMaps);
      expect(deps).to.eql([
        path.join(__dirname, 'fixtures', 'test.es5.map')
      ]);
      done();
    });
  });

  it('should process external SourceMaps (external sources)', done => {
    const file = 'test.es5.external.js';
    const sourceMapSourcesFile = path.join(__dirname, 'fixtures', 'external.map.txt');
    const sourceMapFile = path.join(__dirname, 'fixtures', 'test.es5.external.map');
    sourceMaps.file = file;
    sourceMaps.sources = [sourceMapSourcesFile];

    execLoader(path.join(__dirname, 'fixtures', file), (err, res, map, deps, warns) => {
      expect(err).to.be.null;
      expect(warns).to.eql([]);
      expect(res).to.equal(compiledCode);
      expect(map).to.eql(sourceMaps);
      expect(deps).to.eql([sourceMapFile, sourceMapSourcesFile]);
      done();
    });
  });

  it('should warn on missing SourceMap', done => {
    const file = 'test.es5.missing.map.js';
    sourceMaps.file = file;

    execLoader(path.join(__dirname, 'fixtures', file), (err, res, map, deps, warns) => {
      expect(err).to.be.null;
      expect(warns).to.eql([
        'Cannot find SourceMap test.es5.missing.map: Error: File not found'
      ]);
      expect(res).to.equal(compiledCode + '//# sourceMappingURL=test.es5.missing.map\n');
      expect(map).to.be.undefined;
      expect(deps).to.eql([]);
      done();
    });
  });

  it('should warn on missing source file', done => {
    const file = 'test.es5.missing.external.map.js';
    const sourceMapFile = path.join(__dirname, 'fixtures', 'test.es5.missing.external.map');
    const sourceMapSourcesFile = path.join(__dirname, 'fixtures', 'missing.external.map.txt');
    sourceMaps.file = file;
    sourceMaps.sources = [sourceMapSourcesFile];
    sourceMaps.sourcesContent = [null];

    execLoader(path.join(__dirname, 'fixtures', file), (err, res, map, deps, warns) => {
      expect(err).to.be.null;
      expect(warns).to.eql([
        'Cannot find source file missing.external.map.txt: Error: File not found'
      ]);
      expect(res).to.equal(compiledCode);
      expect(map).to.eql(sourceMaps);
      expect(deps).to.eql([sourceMapFile]);
      done();
    });
  });

  it('should not overwrite sourceMaps that come from different packages/libraries', done => {
    // Lets say we have two libs (`hi` and `echo`) that have been compiled from ES6 to ES5 and provide us
    // their sourcemaps files. We want to be able to bundle them and load their sourcemaps, so we can debug not
    // just our code but the libraries that provide us their sourcemaps.
    // Because sourcemaps are generated with relative urls like this
    //  "sources": [
    //     "../index.js"
    //   ],
    // when a webpack bundle is generated, webpack will take the sourceMaps that `source-map-loader` emits
    // and they will be ovewritten if the source files between the different libraries are named the same way.
    //
    // To avoid this problem it is necessary to process the sourceMaps's `sources` and give them the context
    // of the library that is being processed

    const echoLib = path.join(__dirname, 'fixtures', 'libs', 'echo', 'lib', 'index.js');
    const hiLib = path.join(__dirname, 'fixtures', 'libs', 'hi', 'lib', 'index.js');

    execLoader(echoLib, (err, res, map, deps, warns) => {
      expect(err).to.be.null;
      expect(warns).to.eql([]);
      expect(map).to.eql({
        version: 3,
        sources: [echoLib],
        names: [],
        mappings: ';;;;;qBAAwB,IAAI;;AAAb,SAAS,IAAI,CAAC,CAAC,EAAE;AAC9B,SAAO,CAAC,CAAC;CACV',
        file: 'index.js',
        sourcesContent: ['export default function echo(a) {\n  return a;\n}\n']
      });

      execLoader(hiLib, (err, res, map, deps, warns) => {
        expect(err).to.be.null;
        expect(warns).to.eql([]);
        expect(map).to.eql({
          version: 3,
          sources: [hiLib],
          names: [],
          mappings: ';;;;;qBAAwB,EAAE;;AAAX,SAAS,EAAE,CAAC,IAAI,EAAE;AAC/B,SAAO,CAAC,GAAG,CAAC,IAAI,CAAC,CAAC;CACnB',
          file: 'index.js',
          sourcesContent: ['export default function hi(name) {\n  console.log(name);\n}\n']
        });
        done();
      });
    });
  });
});
