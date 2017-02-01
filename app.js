var _                = require('underscore');
var nunjucks         = require('nunjucks');
var path             = require('path');
var fs               = require('fs');
var mkdirp           = require('mkdirp');
var config           = require('config');
var async            = require('async');
var concat           = require('concat-files');
var consulHost       = config.get('consul.host');
var child_process    = require('child_process');
var consul           = require('consul')({
    host: consulHost
});
var env              = new nunjucks.configure({
  trimBlocks: true,
  lstripBlocks: true
});

env.addFilter('split', function(str, seperator) {
  return str.split(seperator);
});

env.addFilter('groupBy', function(arr, field) {
  return _.groupBy(arr, field);
});

env.addGlobal('fileExists', function(file) {
  return fs.existsSync(file);
});


// Getting consul agent nodename to start watcher
function startListen() {
  consul.agent.self(function(err, result) {
    if (err) {
      console.log(err);
      startListen();
    } else {
      startWatcher(result);
    }
  });
}
// First execution
startListen();

// Starting watcher
function startWatcher(node) {
  var nodeName = node.Config.NodeName;
  console.log(node);
  console.log('Starting watcher');
  var watch = consul.watch({ method: consul.catalog.service.list, options: {'node': nodeName}});

  watch.on('change', function(data, res) {
    var services = [];

    async.forEachOf(data, function(service, key, callback) {
      consul.catalog.service.nodes(key, function(err, result) {
        if (err) throw err;

        services.push({
          ID: key,
          nodes: result
        });

        callback();
      });
    }, function (err) {
      if (err) return console.log(err);
      renderTemplates({
        Services: services,
        Node: node
      });
    });

  });

  watch.on('error', function(err) {
    console.log('error:', err);
  });
}

function renderTemplates(data) {
  config.get("templates").forEach(function (element) {
    console.log(data);
    var result = env.render(element.source, { data: data, templateGlobals: config.get('templateGlobals') });
    console.log(result);
    var templateDir = path.join(element.path);
    var filename = element.filename;
    mkdirp.sync(templateDir);
    fs.writeFileSync(path.join(templateDir, filename), result);

    startCommand(element.command);
  });
}

var startCommand = function (daemon) {
  var command = child_process.exec(daemon);

  // Capturing stdout
  command.stdout.on('data',
    function (data) {
      console.log('tail output: ' + data);
    }
  );

  // Capturing stderr
  command.stderr.on('data',
    function (data) {
      console.log('err data: ' + data);
    }
  );

  process.on('exit', function () {
    command.kill();
  });
};

// Haproxy need the combination of
// fullchanin.pem and privkey.pem
/* var keysToHaproxy = function (data, cb) {
  data.Services.forEach(function (service) {
    service.nodes.forEach(function (node) {
      if (node.ServiceTags) {
        node.ServiceTags.forEach(function (tag) {
          var kvTag = tag.split('=');
          if (kvTag[0] === 'SSL_VIRTUAL_HOST') {
            var virtualHost = kvTag[1];
            var certPath = '/certificates/etc/live/' + virtualHost + '/fullchain.pem';
            var privPath = '/certificates/etc/live/' + virtualHost + '/privkey.pem';
            if(fs.existsSync(certPath) && fs.existsSync(privPath) ) {
              var dest = '/certificates/etc/live/' + virtualHost + '/haproxy.pem';
              concat([
                  certPath,
                  privPath
              ], dest, function (err) {
                if (err) return cb(err);

                console.log("successfully created");

                return cb();
              });
            }
          }
        });
      }
    });
  });
}; */

// setTimeout(function() { watch.end(); }, 30 * 1000);
