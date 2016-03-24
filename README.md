# source map loader for webpack

Extracts SourceMaps for source files that as added as `sourceMappingURL` comment.

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)


### example webpack config

``` javascript
module.exports = {
  module: {
    preLoaders: [
      {
        test: /\.js$/,
        loader: "source-map-loader"
      }
    ]
  }
};
```

This extracts SourceMaps from all js files (including node_modules). This is not very performant, so you may want to only apply the loader to relevant files.

## License

MIT (http://www.opensource.org/licenses/mit-license.php)
