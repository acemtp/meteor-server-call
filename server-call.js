ServerCall = {};

if (Meteor.isServer) {

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

    Meteor.methods({
      'server.result': function (docId, res) {
        check(docId, String);
        if(ServerCall._callbacks[docId]) {
          ServerCall._callbacks[docId](res);
          delete ServerCall._callbacks[docId];
        }
        ServerCall.calls.remove(docId);
      }
    });

    // extend the connection so we can call directly on it
    Meteor.onConnection(function (connection) {
      console.log(connection.id, 'extend ddp connection', connection, arguments);
      connection.call = function(name /* .. [arguments] .. callback */) {
        // if it's a function, the last argument is the result callback,
        // not a parameter to the remote method.
        var args = Array.prototype.slice.call(arguments, 1);
        var callback;
        if (args.length && typeof args[args.length - 1] === 'function')
          callback = args.pop();

        var docId = ServerCall.calls.insert({
          connectionId: connection.id,
          createdAt: new Date(),
          createdBy: Meteor.userId && Meteor.userId(),
          name: name,
          args: args
        });
        if(callback)
          ServerCall._callbacks[docId] = callback;
      };

    });

  });

}

// set the ddp connection as a bi directional call
ServerCall.init = function (connection) {
  connection.subscribe('server.calls');
  connection._methodHandlers = {};

  connection.methods = function (method) {
    var self = connection;
    _.each(method, function (func, name) {
      if (self._methodHandlers[name])
        throw new Error("A method named '" + name + "' is already defined");
      self._methodHandlers[name] = func;
    });
  };

  connection.serverCalls = new Mongo.Collection('server.calls', { connection: connection });

  var query = connection.serverCalls.find();
  var handle = query.observe({
    added: function (doc) {
      var stub = connection._methodHandlers[doc.name];
      if (stub) {
        var res = stub.apply(null, doc.args);
        Meteor.call('server.result', doc._id, res);
      }
    },
  });

};
