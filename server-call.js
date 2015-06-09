ServerCall = {};

if (Meteor.isClient) {
  log = function () {
    var arr = Array.prototype.slice.call(arguments);
    if (arguments.length > 1) {
      arr[0] = '%c' + arguments[0] + '>';
      arr.splice(1, 0, 'color: #0a0');
    }
    return console.log.apply(console, arr);
  };
}


if (Meteor.isServer) {

  log = function () {
    var arr = Array.prototype.slice.call(arguments);
    if (arguments.length > 1) {
      arr[0] = (arguments[0] + '>').green;
    }
    return console.log.apply(console, arr);
  };

  Meteor.startup(function () {

    ServerCall.calls = new Mongo.Collection('server.calls');

    Meteor.publish('server.calls', function () {
      return ServerCall.calls.find({ connectionId: this.connection.id });
    });

    ServerCall.calls.deny({
      insert: function () { return true; },
      update: function () { return true; },
      remove: function () { return true; }
    });

    ServerCall._callbacks = {};

    ServerCall.call = function(connectionId, name /* .. [arguments] .. callback */) {
      // if it's a function, the last argument is the result callback,
      // not a parameter to the remote method.
      var args = Array.prototype.slice.call(arguments, 2);
      var callback;
      if (args.length && typeof args[args.length - 1] === 'function')
        callback = args.pop();

      var docId = ServerCall.calls.insert({
        connectionId: connectionId,
        createdAt: new Date(),
        //createdBy: this.userId || Meteor.userId && Meteor.userId(),
        name: name,
        args: args
      });
log('ServerCall:call', 'exec new command', docId, ', for connectionId ', connectionId);
      if(callback)
        ServerCall._callbacks[docId] = callback;
    };

    Meteor.methods({
      'server.result': function (docId, err, res) {
        check(docId, String);
log('ServerCall:server.result', 'call callback for ', docId, err, res);
//        this.unblock();
        if(ServerCall._callbacks[docId]) {
          ServerCall._callbacks[docId](err, res);
          delete ServerCall._callbacks[docId];
        }
        ServerCall.calls.remove(docId);
      }
    });

    // extend the connection so we can call directly on it
    Meteor.onConnection(function (connection) {
      //log(connection.id, 'extend ddp connection', connection, arguments);
      connection.call = function(name /* .. [arguments] .. callback */) {
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(connection.id);
log('ServerCall:connection:call', 'append connection.id ', connection.id, ', to call ', args);
        ServerCall.call.apply(null, args);
      };

    });
  });

}

// set the ddp connection as a bi directional call
ServerCall.init = function (connection) {
log('ServerCall:init', 'id: connection.methods: ', _.keys(connection.methods), ' unblock ???', connection.unblock);
  connection.subscribe('server.calls');
  connection._methodHandlers = {};

  connection.methods = function (method) {
log('ServerCall:connection:methods: add method', _.keys(method));
    var self = connection;
    _.each(method, function (func, name) {
      if (self._methodHandlers[name])
        throw new Error("A method named '" + name + "' is already defined");
      self._methodHandlers[name] = func;
    });
  };

  if(!connection.serverCalls)
    connection.serverCalls = new Mongo.Collection('server.calls', { connection: connection });

  var query = connection.serverCalls.find();
  var handle = query.observe({
    added: function (doc) {
log('ServerCall:handler:added', '', doc);
      var res, err;
      var stub = connection._methodHandlers[doc.name];
log('ServerCall:handler:added', 'stub ', stub, connection._methodHandlers);
      if (stub) {
        try {
          res = stub.apply(null, doc.args);
//log('ServerCall:handler:added', 'stub, res ', res);

        } catch (e) {
          err = new Meteor.Error('servercall-added-failed', e.stack);
log('ServerCall:handler:added', 'stub error'.red, e.stack);
        }
        connection.call('server.result', doc._id, err, res);
      }
    },
  });

};
