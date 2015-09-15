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
      sources: ['test.es6.js'],
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
    sourceMaps.file = file;
    sourceMaps.sources = ['missing.external.map.txt'];
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
});
