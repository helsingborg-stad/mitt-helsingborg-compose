const fs = require('fs');
const appRoot = require('app-root-path');
const { readSync, writeSync } = require('node-yaml');

const DOCKER_COMPOSE_YML_TEMPLATE = `${appRoot}/templates/docker-compose-template.yml`;

const DOCKER_COMPOSE_YML_FILES = {
  'default': `${appRoot}/docker-compose.yml`,
  'develop': `${appRoot}/docker-compose-develop.yml`,
  'stage': `${appRoot}/docker-compose-stage.yml`,
  'production': `${appRoot}/docker-compose-production.yml`,
};

class DockerManager {
  constructor(dockerCompose) {
    this.dockerCompose = {};
    this.services = {};
    this.defaultEnv = 'all';

    this._init(dockerCompose);
  }
    
  find(env = 'default') {
    if (env === 'all') {
      return this._find(Object.keys(this.dockerCompose));
    }

    if (Array.isArray(env)) {
      return env.map(envItem => (this.find(envItem))).filter(service => (service));
    }

    return this._enviromentExists(env) ? Object.assign({}, this.services[env]) : false;
  }

  get(service, env = 'default') {
    if (env === 'all') {
      return this.get(service, Object.keys(this.dockerCompose));
    }

    if (Array.isArray(env)) {
      return env.map(envItem => (this.get(service, envItem))).filter(service => (service));
    }
    
    return this._enviromentExists(env) && this.services[env][service] ? Object.assign({}, this.services[env][service]) : false;
  }

  create(service, data, env = 'default') {
    if (env === 'all') {
      return this.create(service, data, Object.keys(this.dockerCompose));
    }

    if (Array.isArray(env)) {
      return env.map(envItem => (this.create(service, data, envItem))).filter(service => (service));
    }

    if (this._enviromentExists(env) && !this.get(service, env)) {
      const yml = this._readConfig(env);
      yml.services[service] = Object.assign({}, data);
      this.services[env] = Object.assign({}, yml.services);
      this._writeConfig(yml, env);

      return this.get(service, env);
    }

    return false;
  }
  
  update(service, data, env = 'default') {
    if (env === 'all') {
      return this.update(service, data, Object.keys(this.dockerCompose));
    }

    if (Array.isArray(env)) {
      return env.map(envItem => (this.update(service, data, envItem))).filter(service => (service));
    }

    if (this._enviromentExists(env) && this.get(service, env)) {
      const yml = this._readConfig(env);
      yml.services[service] = Object.assign({}, data);
      this.services[env] = Object.assign({}, yml.services);
      this._writeConfig(yml, env);

      return this.get(service, env);
    }

    return false;
  }

  put(service, data, env = 'default') {
    console.log('TCL: DockerManager -> put -> env', env);
    if (env === 'all') {
      return this.put(service, data, Object.keys(this.dockerCompose));
    }

    if (Array.isArray(env)) {
      return env.map(envItem => (this.put(service, data, envItem))).filter(service => (service));
    }

    if (this._enviromentExists(env) && this.get(service, env)) {
      const yml = this._readConfig(env);
      yml.services = Object.assign(yml.services, {[service]: data});
      this.services[env] = Object.assign({}, yml.services);
      this._writeConfig(yml, env);

      return this.get(service, env);
    }

    return false;
  }

  delete(service, env = 'default') {
    if (env === 'all') {
      return this.delete(service, Object.keys(this.dockerCompose));
    }

    if (Array.isArray(env)) {
      return env.map(envItem => (this.delete(service, envItem))).filter(service => (service));
    }

    if (this._enviromentExists(env) && this.get(service, env)) {  
      const clone = Object.assign({}, this.get(service, env));
      const yml = this._readConfig(env);
      delete yml.services[service];
      this.services[env] = Object.assign({}, yml.services);
      this._writeConfig(yml, env);

      return clone;
    }

    return false;
  }

  _init(dockerCompose) {    
    Object.entries(dockerCompose).forEach(file => {
      const env = file[0];
      const path = file[1];

      // Make sure config file exists
      if (!fs.existsSync(path)) {
        if (!fs.existsSync(DOCKER_COMPOSE_YML_TEMPLATE)) {
          throw `Cannot locate docker-compose template: ${DOCKER_COMPOSE_YML_TEMPLATE}`;
        }

        const ymlTemplate = readSync(DOCKER_COMPOSE_YML_TEMPLATE);
        ymlTemplate.services = {};

        // Create config from template
        writeSync(path, ymlTemplate, {noCompatMode: true, encoding: 'utf8'});
      }

      this.dockerCompose[env] = path;
      const yml = readSync(path);
      this.services[env] = yml.services ? yml.services : {};
    });
  }

  _readConfig(env) {
    if (!this._enviromentExists(env)) {
      return false;
    }
    
    return readSync(this.dockerCompose[env]);
  }
  
  _writeConfig(data, env, options = {noCompatMode: true, encoding: 'utf8'}) {
    if (!this._enviromentExists(env)) {
      return false;
    }
    
    return writeSync(this.dockerCompose[env], data, options);
  }

  _enviromentExists(env) {
    if (typeof env !== 'string' || !this.dockerCompose[env]) {
      return false;
    }

    return true;
  }
}

module.exports = new DockerManager(DOCKER_COMPOSE_YML_FILES);