const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup/popup.ts',
    background: './src/background/background.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  // Add devtool and optimization settings for CSP compatibility
  devtool: false,
  optimization: {
    minimize: false
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "public/viewer-upload.html", to: "" },
        { from: "public/viewer-upload.js", to: "" },
        { from: "images/icon16.png", to: "icon16.png" },
        { from: "images/icon32.png", to: "icon32.png" },
        { from: "images/icon64.png", to: "icon64.png" },
        { from: "images/icon128.png", to: "icon128.png" },
        { from: "src/popup/popup.css", to: "popup.css" }
      ]
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup']
    })
  ]
};