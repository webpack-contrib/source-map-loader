const path = require("path");

const webpack = require("webpack");

const { createFsFromVolume, Volume } = require("memfs");

module.exports = (
  fixture,
  loaderOptions = {},
  config = {},
  skipTestLoader = false
) => {
  const loaders = [
    {
      loader: path.resolve(__dirname, "../../src"),
      options: loaderOptions || {},
    },
  ];

  if (!skipTestLoader) {
    loaders.unshift({
      loader: require.resolve("./testLoader"),
    });
  }

  const fullConfig = {
    mode: "development",
    devtool: config.devtool || "source-map",
    context: path.resolve(__dirname, "../fixtures"),
    entry: path.resolve(__dirname, "../fixtures", fixture),
    output: {
      path: path.resolve(__dirname, "../outputs"),
      filename: "[name].bundle.js",
      chunkFilename: "[name].chunk.js",
      library: "sourceMapLoaderExport",
      // devtoolModuleFilenameTemplate: "[absolute-resource-path]"
    },
    module: {
      rules: [
        {
          test: /\.js/i,
          use: loaders,
        },

        {
          test: /\.css/i,
          use: loaders,
        },
      ],
    },
    plugins: [],
    ...config,
  };

  const compiler = webpack(fullConfig);

  if (!config.outputFileSystem) {
    compiler.outputFileSystem = createFsFromVolume(new Volume());
  }

  return compiler;
};
