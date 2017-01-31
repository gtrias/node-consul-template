# node-consul-template

Caution! This is Work-in-progress and is not production ready yet.

Consul generated templates.

This is an opinated template renderer written in nodejs. Heavily based on [consul-template](https://github.com/hashicorp/consul-template).

At the moment it only supports nunjucks templates but others can be easy integrated.

## Install

```bash
npm install
```

## Run using docker

```bash
docker run -d --name node-consul-template gtrias/node-consul-template
```

## Run as standalone

```bash
npm start
```

## Configuration file

The templates to be rendered and the command to run after successful generated template can be configured in a json file (or environment variable).

Configuration anatomy:

```javascript
{
    "templates": [
        {
            "source": "templates/haproxy.cnf.njk",                                                 // Nunjunks template
            "path": "dump",                                                                        // Path where the generated template will be rendered
            "filename": "haproxy.cfg",                                                             // Filename for generated template
            "command": "/usr/bin/haproxy -D -p /var/run/haproxy.pid  -f /etc/haproxy/haproxy.cfg " // Command to run after configuration generation
        },
        {
            "source": "templates/certificates.sh.njk",
            "path": "dump/",
            "filename": "certificates.sh",
            "command": "dump/certificates.sh"
        }
    ]
}
```

## Included templates

### haproxy

The included template expects you define your services adding the next tags in key=value format.
Consul doesn't support key-value attributes yet [(See status)](https://github.com/hashicorp/consul/issues/1107) so this is a workaround to allow define container configuration
using tags.

If you are using [gliderlabs/registrator](https://github.com/gliderlabs/registrator), then you can define your
tags as follow environment:

```yml
    whoami1:
        image: emilevauge/whoami
        ports:
        - 80
        environment:
        'SERVICE_TAGS=VIRTUAL_HOST=whoami.example.com,SSL_VIRTUAL_HOST=example.com,SSL_EMAIL=info@example.com'
```

- VIRTUAL_HOST: will be used to configure haproxy to listen that host
- SSL_VIRTUAL_HOST: will be used to configure haproxy SSL host to listen.
- SSL_EMAIL: will be used to configure SSL contact email needed by letsencrypt.

### cerbot certificates generation sh

This template reders a `.sh` script to execute cerbot for all services containing SSL_VIRTUAL_HOST and SSL_EMAIL.

It is inspired on [phylor/letsencrypt-consul](https://github.com/phylor/letsencrypt-consul)


## Quickstart

### Start environment

To start Playground just run docker-compose as follows:

```bash
docker-compose up
```
Once all containers are running you will see all related services logs

### Make some requests

Then you can send requests to whoami as follows:

```bash
watch curl -H Host:whoami.example.com  127.0.0.1:<port>
```

Note: By default docker-compose will not expose anything to 80 port so you will have to run `docker ps` to see which port is set to the consul-template-haproxy container...

You can see how the results are changing indicating that each request is propertly balanced.

### Testing container deregisters

Keep watching the results of above curl and run the next command.

```bash
docker stop nodeconsultemplate_whoami_1
```
Then you can see how no request arrives to that container (you can check this seeing the id)

### Testing container registers

Same as before, we will start again the same container:

```bash
docker start nodeconsultemplate_whoami_1
```

## Extending container

This container is prepared to be a wrapper of other containers with the command you need to run
with your discovered services.
To make your own integration just make your own `Dockerfile` FROM gtrias/node-consul-template

Example with HAproxy installed:

```
FROM gtrias/node-consul-template

# add jessie-backports for Docker package
RUN echo "deb http://http.debian.net/debian jessie-backports main" > /etc/apt/sources.list.d/backports.list

RUN apt-get update && apt-get install -y unzip haproxy && apt-get install -y certbot -t jessie-backports

EXPOSE 80 443
```

## Specifing configuration for exposed port

If you want to define which VIRTUAL_HOST or SSL_VIRTUAL_HOST should have a specific port (Consul see each port as a different service).
You can use (registrator specific notation)[http://gliderlabs.com/registrator/latest/user/services/#container-overrides].

For example define `SERVICE_9091_TAGS` instead of `SERVICE_TAGS` to configure the tags that the port 9091 should receive.

## Registrator internal VS no internal

gliderlabs/registrator can register the internal Docker IP (i.e 172.19.0.2) with its internal exposed ports or external one (only exposed ones) with
the host IP (i.e 192.168.55.101). [more about internal registration](http://gliderlabs.com/registrator/latest/user/services/)
For this purpose there're two HAproxy templates to handle those thow behaviors.

Check `templates/haproxy.cnf.njk` and `templates/haproxy-internal.cnf.njk`.

The `haproxy-internal.cnf.njk` will check if the service is registered in the same machine where haproxy is running and getting the internal
IP address and port to reach that service. If the service is from other host it will get the host IP address with default 80 port to bypass the
balancing to the other host haproxy.
