var nunjucks    = require('nunjucks');
var path        = require('path');
var fs          = require('fs');
var mkdirp      = require('mkdirp');
var consul      = require('consul')();
var config      = require('config');
var env         = new nunjucks.Environment(new nunjucks.FileSystemLoader('.'));
var exec = require('child_process').exec;

env.addFilter('split', function(str, seperator) {
    return str.split(seperator);
});

consul.agent.self(function(err, result) {
    if (err) return console.log(err);
    var nodeName = result.Config.NodeName;
    startWatcher(nodeName);
});

function startWatcher(node) {
    var watch = consul.watch({ method: consul.catalog.node.services, options: {'node': node}});

    watch.on('change', function(data, res) {
        console.log(data.Services);
        config.get("templates").forEach(function (element) {
            var result = env.render(element.source, { data: data });
            var templateDir = path.join(element.path);
            var filename = element.filename;
            mkdirp.sync(templateDir);
            fs.writeFileSync(path.join(templateDir, filename), result);

            exec(element.command, function(error, stdout, stderr) {
                if (error) return console.log(error);
                console.log(stderr);
                console.log(stdout);
                  // command output is in stdout
            });

            console.log(result);
        });
    });

    watch.on('error', function(err) {
          console.log('error:', err);
    });
}

// setTimeout(function() { watch.end(); }, 30 * 1000);
