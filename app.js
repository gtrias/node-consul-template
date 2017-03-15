var _                = require('underscore');
var nunjucks         = require('nunjucks');
var path             = require('path');
var fs               = require('fs');
var mkdirp           = require('mkdirp');
var config           = require('config');
var async            = require('async');
var concat           = require('concat-files');
var winston          = require('winston');
var consulHost       = config.get('consul.host');
var child_process    = require('child_process');
var consul           = require('consul')({
    host: consulHost
});
var env              = new nunjucks.configure({
  trimBlocks: true,
  lstripBlocks: true
});

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({timestamp : true})
  ]
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
      logger.error(err);
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
  logger.info(node);
  logger.info('Starting watcher');
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
      if (err) return logger.error(err);
      renderTemplates({
        Services: services,
        Node: node
      });
    });

  });

  watch.on('error', function(err) {
    logger.error('error:', err);
  });
}

function renderTemplates(data) {
  config.get("templates").forEach(function (element) {
    logger.info(data);
    var result = env.render(element.source, { data: data, templateGlobals: config.get('templateGlobals') });
    logger.info(result);
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
      logger.info('tail output: ' + data);
    }
  );

  // Capturing stderr
  command.stderr.on('data',
    function (data) {
      logger.error('err data: ' + data);
    }
  );

  process.on('exit', function () {
    command.kill();
  });
};
