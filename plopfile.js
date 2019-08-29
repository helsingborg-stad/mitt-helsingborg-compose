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
    description: 'Download repositories & setup configuration',
    prompts: [
      {
        type: 'confirm',
        name: 'gitClone',
        message: 'Do you want to clone repositories?',
      },
      {
        type: 'confirm',
        name: 'gitCheckout',
        message: 'Do you want to checkout repositories to develop branch (if exists)?',
      },
      {
        type: 'confirm',
        name: 'npmInstall',
        message: 'Do you want to install NPM dependencies?',
      },
      {
        type: 'confirm',
        name: 'copyEnv',
        message: 'Do you want to copy enviroment files?',
      },
      {
        type: 'confirm',
        name: 'copyDockerFile',
        message: 'Do you want to copy DockerFiles?',
      },
      {
        type: 'confirm',
        name: 'appendService',
        message: 'Do you want to append servies to dev config?',
      }
    ],
    actions: answers => {
      const {gitClone, gitCheckout, npmInstall, copyEnv, copyDockerFile, appendService} = answers;

      let actions = [];
      let port = 3030; // Starting port for all services

      const repositoriesDir = `${appRoot}/repos`;
      const dockerFileTemplatePath = fs.existsSync(`${appRoot}/templates/template.Dockerfile`) ? `${appRoot}/templates/template.Dockerfile` : false;
      const services = Object.values(DockerManager.find());

      services.forEach(service => {
        const {build, image} = service;
        const repositoryPath = `${repositoriesDir}/${image}`;
        const exampleEnvPath = fs.existsSync(`${repositoryPath}/example.env`) ? `${repositoryPath}/example.env` : false;

        if (gitClone) {
          actions.push({
            type: 'git clone',
            remote: build,
            targetPath: repositoryPath,
            abortOnFail: false
          });
        }
  
        if (gitCheckout) {
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
        }

        if (npmInstall) {
          actions.push({
            type: 'npm',
            targetPath: repositoryPath,
            command: 'install',
            abortOnFail: false
          });
        }
    
        if (exampleEnvPath && copyEnv) {
          actions.push({
            type: 'add',
            path: `${repositoryPath}/.env`,
            templateFile: exampleEnvPath,
            skipIfExists: true,
            abortOnFail: false
          });
        }

        if (dockerFileTemplatePath && copyDockerFile) {
          actions.push({
            type: 'add',
            path: `${repositoryPath}/DockerFile`,
            templateFile: dockerFileTemplatePath,
            skipIfExists: false,
            abortOnFail: false,
            force: true
          });
        }

        if (appendService) {
          actions.push({
            type: 'docker service append',
            serviceName: image, 
            serviceData: {
              build: `./repositories/${image}`,
              volumes: [`./repositories/${image}:/usr/src/app`],
              ports: [`${port}:${port}`],
              command: 'npm run dev',
              environment: [
                'NODE_ENV=development',
                `PORT=${port}`
              ]
            }, 
            enviroment: 'develop'
          });
        }

        port++;
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
        type: 'docker service append',
        serviceName: serviceName, 
        serviceData: {
          image: serviceName,
          build: `${serviceRepository}`,
          networks: ['backend']
        }, 
        enviroment: 'default'
      });

      actions.push({
        type: 'docker service append',
        serviceName: serviceName, 
        serviceData: {
          build: `./repositories/${serviceName}`,
          volumes: [`./repositories/${serviceName}:/usr/src/app`],
          ports: [`${servicePort}:${servicePort}`],
          command: 'npm run dev',
          environment: [
            'NODE_ENV=development',
            `PORT=${servicePort}`
          ]
        }, 
        enviroment: 'develop'
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

  plop.setActionType('docker service append', async function (answers, config, plop) {
    try {
      const {serviceName, serviceData, enviroment} = config;
      DockerManager.put(plop.getHelper('lowerCase')(serviceName), serviceData, enviroment);
      return `Append config to ${serviceName} in ${DockerManager.getConfigPath(enviroment)}`;
    } catch(e) {
      console.log(e);
    }
  });
};