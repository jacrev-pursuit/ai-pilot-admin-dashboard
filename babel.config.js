export default {
  presets: [
    '@babel/preset-react'
  ],
  env: {
    test: {
      plugins: ['@babel/plugin-transform-modules-commonjs']
    }
  }
}; 