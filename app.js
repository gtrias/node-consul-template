var _                = require('underscore');
var nunjucks         = require('nunjucks');
var path             = require('path');
var fs               = require('fs');
var mkdirp           = require('mkdirp');
var config           = require('config');
var consulHost       = config.get('consul.host');
var consul           = require('consul')({
    host: consulHost
});
var env              = new nunjucks.Environment(new nunjucks.FileSystemLoader('.'));
var child_process    = require('child_process');

env.addFilter('split', function(str, seperator) {
    return str.split(seperator);
});

env.addFilter('groupBy', function(arr, field) {
    return _.groupBy(arr, field);
});

env.addFilter('fileExists', function(arr, file) {
    return fs.existsSync(file);
});


// Getting consul agent nodename to start watcher
function startListen() {
    consul.agent.self(function(err, result) {
        if (err) {
            console.log(err);
            startListen();
        } else {
            var nodeName = result.Config.NodeName;
            startWatcher(nodeName);
        }
    });
}
// First execution
startListen();

// Starting watcher
function startWatcher(node) {
    console.log('Starting watcher');
    var watch = consul.watch({ method: consul.catalog.node.services, options: {'node': node}});

    watch.on('change', function(data, res) {
        renderTemplates(data);
    });

    watch.on('error', function(err) {
        console.log('error:', err);
    });
}

function renderTemplates(data) {
    config.get("templates").forEach(function (element) {
        var result = env.render(element.source, { data: data });
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
}

// setTimeout(function() { watch.end(); }, 30 * 1000);
