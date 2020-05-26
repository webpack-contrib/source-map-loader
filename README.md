<div align="center">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![tests][tests]][tests-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]
[![size][size]][size-url]

# source-map-loader

Extracts source maps from existing source files (from their <code>sourceMappingURL</code>).

## Getting Started

To begin, you'll need to install `source-map-loader`:

```bash
npm i -D source-map-loader
```

Then add the plugin to your `webpack` config. For example:

**file.js**

```js
import css from 'file.css';
```

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
    ],
  },
};
```

`source-map-loader` extracts existing source maps from all JavaScript entries.
This includes both inline source maps as well as those linked via URL.
All source map data is passed to webpack for processing as per a chosen [source map style](https://webpack.js.org/configuration/devtool/) specified by the `devtool` option in [webpack.config.js](https://webpack.js.org/configuration/).
This loader is especially useful when using 3rd-party libraries having their own source maps.
If not extracted and processed into the source map of the webpack bundle, browsers may misinterpret source map data. `source-map-loader` allows webpack to maintain source map data continuity across libraries so ease of debugging is preserved.
`source-map-loader` will extract from any JavaScript file, including those in the `node_modules` directory.
Be mindful in setting [include](https://webpack.js.org/configuration/module/#rule-include) and [exclude](https://webpack.js.org/configuration/module/#rule-exclude) rule conditions to maximize bundling performance.

And run `webpack` via your preferred method.

## Options

### `brokenMapUrlReportType`

Type: `String`
Default: `warning`

Type of error message, when the map failed to load.

Possible values:

- `ignore`
- `warning`
- `error`

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: [
          {
            loader: 'source-map-loader',
            options: {
              brokenMapUrlReportType: 'ignore',
            },
          },
        ],
      },
    ],
  },
};
```

### `brokenMapParseReportType`

Type: `String`
Default: `warning`

Type of error message, when the card is received, but cannot be correctly parsed.

Possible values:

- `ignore`
- `warning`
- `error`

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: [
          {
            loader: 'source-map-loader',
            options: {
              brokenMapParseReportType: 'ignore',
            },
          },
        ],
      },
    ],
  },
};
```

### `brokenSourceUrlReportType`

Type: `String`
Default: `warning`

Type of error message, when the source (from `map.sources`) failed to load.

Possible values:

- `ignore`
- `warning`
- `error`

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: [
          {
            loader: 'source-map-loader',
            options: {
              brokenSourceUrlReportType: 'ignore',
            },
          },
        ],
      },
    ],
  },
};
```

### `unresolveSourceFetcher`

Type: `Function`
Default: `undefined`

The option allows you to fetching the remote content.

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: [
          {
            loader: 'source-map-loader',
            options: {
              async unresolveSourceFetcher(url) {
                if (/^https?:\/\//i.test(url)) {
                  const response = await fetch(url);
                  const result = await response.text();

                  return result;
                }

                throw new Error(`${url} is not supported`);
              },
            },
          },
        ],
      },
    ],
  },
};
```

## Contributing

Please take a moment to read our contributing guidelines if you haven't yet done so.

[CONTRIBUTING](./.github/CONTRIBUTING.md)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/source-map-loader.svg
[npm-url]: https://npmjs.com/package/source-map-loader
[node]: https://img.shields.io/node/v/source-map-loader.svg
[node-url]: https://nodejs.org
[deps]: https://david-dm.org/webpack-contrib/source-map-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/source-map-loader
[tests]: https://github.com/webpack-contrib/source-map-loader/workflows/source-map-loader/badge.svg
[tests-url]: https://github.com/webpack-contrib/source-map-loader/actions
[cover]: https://codecov.io/gh/webpack-contrib/source-map-loader/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/source-map-loader
[chat]: https://badges.gitter.im/webpack/webpack.svg
[chat-url]: https://gitter.im/webpack/webpack
[size]: https://packagephobia.now.sh/badge?p=source-map-loader
[size-url]: https://packagephobia.now.sh/result?p=source-map-loader
