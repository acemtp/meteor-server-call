Package.describe({
  name: 'acemtp:server-call',
  version: '0.0.7',
  summary: 'Be able to do method call on the server',
  git: 'https://github.com/acemtp/meteor-server-call',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  api.addFiles('server-call.js');

  api.use('nooitaf:colors', 'server');

  api.export('ServerCall');
  api.export('log');
});
