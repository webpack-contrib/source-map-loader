import {
  compile,
  getCodeFromBundle,
  getCompiler,
  getErrors,
  normalizeMap,
  getWarnings,
} from './helpers';

describe('filterSourceMappingUrl option', () => {
  it('should work', async () => {
    expect.assertions(6);

    const testId = 'external-source-map.js';
    const compiler = getCompiler(testId, {
      filterSourceMappingUrl: (sourceMappingURL, resourcePath) => {
        expect(sourceMappingURL).toBeDefined();
        expect(resourcePath).toBeDefined();

        return true;
      },
    });
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should work with true value', async () => {
    const testId = 'external-source-map.js';
    const compiler = getCompiler(testId, {
      filterSourceMappingUrl: () => true,
    });
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(normalizeMap(codeFromBundle.map)).toMatchSnapshot('map');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should work with "skip" value', async () => {
    const testId = 'http-source-map.js';
    const compiler = getCompiler(testId, {
      filterSourceMappingUrl: () => 'skip',
    });
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should work with "remove" value', async () => {
    const testId = 'http-source-map.js';
    const compiler = getCompiler(testId, {
      filterSourceMappingUrl: () => 'remove',
    });
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should work with false value', async () => {
    const testId = 'http-source-map.js';
    const compiler = getCompiler(testId, {
      filterSourceMappingUrl: () => false,
    });
    const stats = await compile(compiler);
    const codeFromBundle = getCodeFromBundle(stats, compiler);

    expect(codeFromBundle.map).toBeUndefined();
    expect(codeFromBundle.css).toMatchSnapshot('css');
    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });

  it('should emit error', async () => {
    const testId = 'external-source-map.js';
    const compiler = getCompiler(testId, {
      filterSourceMappingUrl: () => {
        throw new Error('error');
      },
    });
    const stats = await compile(compiler);

    expect(getWarnings(stats)).toMatchSnapshot('warnings');
    expect(getErrors(stats)).toMatchSnapshot('errors');
  });
});
