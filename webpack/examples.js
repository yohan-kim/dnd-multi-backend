const webpackMerge = require('webpack-merge');
const commonConfig = require('./core.js');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = webpackMerge(commonConfig(), {
  entry: {
    'dnd-multi-backend': './packages/dnd-multi-backend/examples/index.js',
    'react-dnd-multi-backend': './packages/react-dnd-multi-backend/examples/index.js',
    'react-dnd-preview': './packages/react-dnd-preview/examples/index.js',
  },
  output: {
    path: `${__dirname}/../examples`,
    filename: 'examples_[name].min.js',
  },
  plugins: [
    new CopyWebpackPlugin([{ from: 'dev/*', to: '.', flatten: true}]),
  ],
});
