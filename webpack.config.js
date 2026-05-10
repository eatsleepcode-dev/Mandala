//@ts-check
'use strict';

const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/** @type {import('webpack').Configuration[]} */
module.exports = [
  // Extension host bundle (Node.js)
  {
    name: 'extension',
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
    },
    externals: { vscode: 'commonjs vscode' },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
      rules: [{ test: /\.ts$/, exclude: /node_modules/, use: 'ts-loader' }],
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: { level: 'log' },
  },

  // Webview bundle (browser)
  {
    name: 'webview',
    target: 'web',
    mode: 'none',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist', 'webview'),
      filename: 'webview.js',
    },
    resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: { loader: 'ts-loader', options: { configFile: 'tsconfig.webview.json' } },
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: 'webview.css' }),
    ],
    devtool: 'nosources-source-map',
  },
];
