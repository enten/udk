import './shared';


console.log('hello client!!!');

if (module.hot) {
  module.hot.accept();
  module.hot.accept('./shared', () => require('./shared'))
}
// xxx
