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

It is based on [phylor/letsencrypt-consul](https://github.com/phylor/letsencrypt-consul)
