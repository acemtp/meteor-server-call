Package.describe({
  name: 'acemtp:server-call',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'Be able to do method call on the server',
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  api.addFiles('server-call.js');
});
