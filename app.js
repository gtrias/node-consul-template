var nunjucks = require('nunjucks');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var consul = require('consul')({
    host: '127.0.0.1',
    promisify: true
});

consul.agent.self(function(err, result) {
    var nodeName = result.Config.NodeName;
    startWatcher(nodeName);
});

function startWatcher(node) {
    var watch = consul.watch({ method: consul.catalog.node.services, options: {'node': node}});


    watch.on('change', function(data, res) {
        console.log(data.Services);
        var result = nunjucks.render('templates/haproxy.cnf.jinja', { data: data });
        var templateDir = path.join(__dirname, 'dump', 'haproxy');
        mkdirp.sync(templateDir);
        fs.writeFileSync(path.join(templateDir, 'haproxy.cfg'), result);
        console.log(result);
    });

    watch.on('error', function(err) {
          console.log('error:', err);
    });
}

// setTimeout(function() { watch.end(); }, 30 * 1000);
