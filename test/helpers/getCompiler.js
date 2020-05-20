import path from 'path';

import webpack from 'webpack';
import { createFsFromVolume, Volume } from 'memfs';

export default (
  fixture,
  loaderOptions = {},
  config = {},
  skipTestLoader = false
) => {
  const loaders = [
    {
      loader: path.resolve(__dirname, '../../src'),
      options: loaderOptions || {},
    },
  ];

  if (!skipTestLoader) {
    loaders.unshift({
      loader: require.resolve('./testLoader'),
    });
  }

  const fullConfig = {
    mode: 'development',
    devtool: config.devtool || 'source-map',
    context: path.resolve(__dirname, '../fixtures'),
    entry: path.resolve(__dirname, '../fixtures', fixture),
    output: {
      path: path.resolve(__dirname, '../outputs'),
      filename: '[name].bundle.js',
      chunkFilename: '[name].chunk.js',
      library: 'sourceMapLoaderExport',
    },
    module: {
      rules: [
        {
          test: /\.js/i,
          use: loaders,
        },
      ],
    },
    plugins: [],
    ...config,
  };

  const compiler = webpack(fullConfig);

  if (!config.outputFileSystem) {
    const outputFileSystem = createFsFromVolume(new Volume());
    // Todo remove when we drop webpack@4 support
    outputFileSystem.join = path.join.bind(path);

    compiler.outputFileSystem = outputFileSystem;
  }

  return compiler;
};
