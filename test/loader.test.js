import path from 'path';
import fs from 'fs';

import fetch from 'node-fetch';

import {
  compile,
  getCodeFromBundle,
  getCompiler,
  getErrors,
  normalizeMap,
  getWarnings,
  readAsset,
} from './helpers';

const isWin = process.platform === 'win32';

describe('source-map-loader', () => {
  it('should leave normal files untouched', async () => {
    const testId = 'normal-file.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should leave normal files with fake source-map untouched', async () => {
    const testId = 'normal-file2.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should process inlined SourceMaps', async () => {
    const testId = 'inline-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should process external SourceMaps', async () => {
    const testId = 'external-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);
    const deps = stats.compilation.fileDependencies;

    const dependencies = [
      path.resolve(__dirname, 'fixtures', 'external-source-map.map'),
    ];

    dependencies.forEach((fixture) => {
      expect(deps.has(fixture)).toBe(true);
    });
    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should process external SourceMaps (external sources)', async () => {
    const testId = 'external-source-map2.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);
    const deps = stats.compilation.fileDependencies;

    const dependencies = [
      path.resolve(__dirname, 'fixtures', 'data', 'external-source-map2.map'),
      path.resolve(__dirname, 'fixtures', 'external-source-map2.txt'),
    ];

    dependencies.forEach((fixture) => {
      expect(deps.has(fixture)).toBe(true);
    });
    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should resolve SourceMap.sources to http', async () => {
    const currentDirPath = path.join(__dirname, 'fixtures', 'fetch');

    const testId = path.join(currentDirPath, 'sources-http.js');
    const compiler = getCompiler(testId, {
      fetchReader(url) {
        return fetch(url)
          .then((res) => res.text())
          .then(() => 'some kind content');
      },
    });
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should not resolve SourceMap.sources to http', async () => {
    const currentDirPath = path.join(__dirname, 'fixtures', 'fetch');

    const testId = path.join(currentDirPath, 'sources-http.js');
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should reject http SourceMaps', async () => {
    const testId = 'http-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should reject not exist file: SourceMaps', async () => {
    const testId = isWin ? 'file-source-map-windows.js' : 'file-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const errorString = getWarnings(stats).join('');
    const warning = errorString.match(/TypeError \[ERR_INVALID_FILE/gi);

    expect(...warning).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should reject not support url', async () => {
    const testId = 'unSupport-file-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should use last SourceMap directive', async () => {
    const testId = 'multi-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should skip invalid base64 SourceMap', async () => {
    const testId = 'invalid-inline-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should warn on invalid base64 SourceMap', async () => {
    const testId = 'invalid-inline-source-map2.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should warn on invalid SourceMap', async () => {
    const testId = 'invalid-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);
    const deps = stats.compilation.fileDependencies;

    const dependencies = [
      path.resolve(__dirname, 'fixtures', 'invalid-source-map.map'),
    ];

    dependencies.forEach((fixture) => {
      expect(deps.has(fixture)).toBe(true);
    });
    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should warn on missing SourceMap', async () => {
    const testId = 'missing-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should warn on missing source file', async () => {
    const testId = 'missing-source-map2.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);
    const deps = stats.compilation.fileDependencies;

    const dependencies = [
      path.resolve(__dirname, 'fixtures', 'missing-source-map2.map'),
    ];

    dependencies.forEach((fixture) => {
      expect(deps.has(fixture)).toBe(true);
    });
    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should process inlined SourceMaps with charset', async () => {
    const testId = 'charset-inline-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should support absolute sourceRoot paths in sourcemaps', async () => {
    const sourceRoot = path.resolve(__dirname, 'fixtures');
    const javaScriptFilename = 'absolute-sourceRoot-source-map.js';
    const sourceFilename = 'absolute-sourceRoot-source-map.txt';
    const rootRelativeSourcePath = path.join(sourceRoot, sourceFilename);
    const sourceMapPath = path.join(
      sourceRoot,
      'absolute-sourceRoot-source-map.map'
    );

    // Create the sourcemap file
    const rawSourceMap = {
      version: 3,
      file: javaScriptFilename,
      sourceRoot,
      sources: [sourceFilename],
      mappings: 'AAAA',
    };
    fs.writeFileSync(sourceMapPath, JSON.stringify(rawSourceMap));

    const compiler = getCompiler(javaScriptFilename);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);
    const deps = stats.compilation.fileDependencies;

    const dependencies = [sourceMapPath, rootRelativeSourcePath];

    dependencies.forEach((fixture) => {
      expect(deps.has(fixture)).toBe(true);
    });
    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should support relative sourceRoot paths in sourcemaps', async () => {
    const sourceFilename = 'relative-sourceRoot-source-map.txt';
    const rootRelativeSourcePath = path.join(
      __dirname,
      'fixtures',
      'data',
      sourceFilename
    );
    const sourceMapPath = path.join(
      __dirname,
      'fixtures',
      'relative-sourceRoot-source-map.map'
    );

    const testId = 'relative-sourceRoot-source-map.js';
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);
    const deps = stats.compilation.fileDependencies;

    const dependencies = [sourceMapPath, rootRelativeSourcePath];

    dependencies.forEach((fixture) => {
      expect(deps.has(fixture)).toBe(true);
    });
    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should support indexed sourcemaps', async () => {
    const currentDirPath = path.join(
      __dirname,
      'fixtures',
      'indexed-sourcemap'
    );

    const testId = path.join(currentDirPath, 'file.js');
    const compiler = getCompiler(testId);
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);
    const deps = stats.compilation.fileDependencies;

    const dependencies = [
      path.join(currentDirPath, 'file.js'),
      path.join(currentDirPath, 'file.js.map'),
      path.join(currentDirPath, 'nested1.js'),
      `/different/root/nested2.js`,
    ];

    dependencies.forEach((fixture) => {
      expect(deps.has(fixture)).toBe(true);
    });
    expect(codeFromBundle.map).toBeDefined();
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should transform to webpack', async () => {
    const currentDirPath = path.join(
      __dirname,
      'fixtures',
      'indexed-sourcemap'
    );

    const testId = path.join(currentDirPath, 'file.js');
    const compiler = getCompiler(testId, {}, {}, true);
    const stats = await compile(compiler);
    const bundle = readAsset('main.bundle.js.map', compiler, stats);

    const dependencies = [
      'indexed-sourcemap/nested1.js',
      'nested2.js',
      'webpack/bootstrap',
    ];

    // Todo: rewrite when we will fix issue whith unresolved paths
    dependencies.forEach((fixture) => {
      expect(bundle.indexOf(fixture) !== -1).toBe(true);
    });
  });
});
