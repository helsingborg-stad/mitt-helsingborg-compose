/* eslint-disable no-console */
const git = require('simple-git/promise');
const url = require('url');
const fs = require('fs');
const { exec } = require('child_process');
const isGitUrl = require('is-git-url');
const appRoot = require('app-root-path');
const DockerManager = require('./docker.manager');

module.exports = function (plop) {
  /**
   * Setup enviroment
   * @command plop setup | npm run plop setup
   */
  plop.setGenerator('setup', {
    description: 'application setup logic',
    prompts: [],
    actions: data => {
      let actions = [];

      const repositoriesDir = `${appRoot}/repos`;
      const dockerFileTemplatePath = fs.existsSync(`${appRoot}/templates/template.Dockerfile`) ? `${appRoot}/templates/template.Dockerfile` : false;
      const services = Object.values(DockerManager.find());

      services.forEach(service => {
        const {build, image} = service;
        const repositoryPath = `${repositoriesDir}/${image}`;
        const exampleEnvPath = fs.existsSync(`${repositoryPath}/example.env`) ? `${repositoryPath}/example.env` : false;

        actions.push({
          type: 'git clone',
          remote: build,
          targetPath: repositoryPath,
          abortOnFail: false
        });
  
        actions.push({
          type: 'git fetch',
          targetPath: repositoryPath,
          abortOnFail: false
        });
      
        actions.push({
          type: 'git checkout',
          targetPath: repositoryPath,
          branch: 'develop',
          abortOnFail: false
        });
    
        actions.push({
          type: 'npm',
          targetPath: repositoryPath,
          command: 'install',
          abortOnFail: false
        });

        if (exampleEnvPath) {
          actions.push({
            type: 'add',
            path: `${repositoryPath}/.env`,
            templateFile: exampleEnvPath,
            skipIfExists: true,
            abortOnFail: false
          });
        }

        if (dockerFileTemplatePath) {
          actions.push({
            type: 'add',
            path: `${repositoryPath}/DockerFile`,
            templateFile: dockerFileTemplatePath,
            skipIfExists: false,
            abortOnFail: false,
            force: true
          });
        }
      });

      actions.push({
        type: 'add',
        path: `${appRoot}/.env`,
        templateFile: `${appRoot}/example.env`,
        skipIfExists: true,
        abortOnFail: false,
      });

      return actions;
    }
  });

  /**
   * Add new service configuration
   * @command plop service add | npm run plop service add
   */
  plop.setGenerator('service add', {
    description: 'application controller logic',
    prompts: [
      {
        type: 'input',
        name: 'serviceName',
        message: 'Service name',
        transformer: (input) => {
          return plop.getHelper('dashCase')(input);
        },
        validate: input => {
          if (input.length > 0) {
            return true;
          }

          return 'Please enter a name';
        }
      },
      {
        type: 'input',
        name: 'serviceRepository',
        message: 'Github Repository',
        validate: input => {
          if (isGitUrl(input)) {
            return true;
          }

          return 'Please enter a valid GIT URL';
        }
      },
      {
        type: 'input',
        name: 'servicePort',
        message: 'PORT',
        default: '3030',
        validate: input => {
          if (!isNaN(input)) {
            return true;
          }

          return 'Please enter a valid PORT number';
        }
      }
    ],
    actions: function(data) {
      const { servicePort, serviceRepository } = data;
      let { serviceName } = data;
      serviceName = plop.getHelper('lowerCase')(serviceName);

      let actions = [];

      actions.push({
        type: 'docker-compose.yml',
        serviceName: serviceName, 
        serviceObject: {
          image: serviceName,
          build: `${serviceRepository}`,
          networks: ['backend']
        }, 
        successMessage: 'Succesfully added service to global config'
      });

      actions.push({
        type: 'docker-compose-dev.yml',
        serviceName: serviceName, 
        serviceObject: {
          build: `./repositories/${serviceName}`,
          volumes: [`./repositories/${serviceName}:/usr/src/app`],
          ports: [`${servicePort}:${servicePort}`],
          command: 'npm run dev',
          environment: [
            'NODE_ENV=development',
            `PORT=${servicePort}`
          ]
        }, 
        successMessage: 'Succesfully added service to develop config'
      });

      return actions;
    },
  });

  plop.setActionType('git clone', async function (answers, config, plop) {
    try {
      const {remote, targetPath} = config;
      if (fs.existsSync(targetPath)) {
        throw `Target path already exists: ${targetPath}`;
      }
  
      const {protocol, host, path} = url.parse(remote);
      const remoteRepo = `${protocol}//${host}${path}`;
  
      await git().clone(remoteRepo, targetPath);

    } catch(e) {
      throw e;
    }
  });

  plop.setActionType('git fetch', async function (answers, config, plop) {
    try {
      const {targetPath} = config;
      if (!fs.existsSync(targetPath)) {
        throw `Target path does not exists: ${targetPath}`;
      }
  
      git(`${targetPath}`).fetch();
    } catch(e) {
      throw e;
    }
  });

  plop.setActionType('git checkout', async function (answers, config, plop) {
    const {targetPath} = config;

    if (!fs.existsSync(targetPath)) {
      throw `Target path does not exists: ${targetPath}`;
    }

    let { branch } = config;

    // Get remote branches
    const remoteBranches = await git(`${targetPath}`).branch(['-r']);

    // Make sure our branch exists remotely
    branch = remoteBranches['all'].includes(`origin/${branch}`) ? branch : 'master';
    
    //Checkout branch
    git(`${targetPath}`).checkout(branch);
  });

  plop.setActionType('npm', async function (answers, config, plop) {
    try {
      const {targetPath, command} = config;
      await exec(`cd ${targetPath} && npm ${command}`, async (err, stdout, stderr) => {
        if (err) {
          console.log(err);
        }
      });
  
      return `${command} ${targetPath}`;
    } catch(e) {
      console.log(e);
    }
  });

  // TODO: Refactor this
  const configureDockerComposeService = (env) => (async function (answers, config, plop) {
    const {serviceName, serviceObject, successMessage} = config;
    try {
      console.log(DockerManager.create(plop.getHelper('lowerCase')(serviceName), serviceObject, env));

      return successMessage ? successMessage : 'Success!';
    } catch (e) {
      throw e;
    }
  });
  plop.setActionType('docker-compose.yml', configureDockerComposeService('default'));
  plop.setActionType('docker-compose-dev.yml', configureDockerComposeService('develop'));
};