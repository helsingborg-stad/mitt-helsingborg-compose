# Mitt Helsingborg Dockyard

Development enviroment for Mitt Helsingborg Backend Services using Docker.

## Getting started

### Installation

#### 1. Install Docker

[Install Docker for Mac](https://docs.docker.com/docker-for-mac/install/)

[Install Docker for Windows](https://docs.docker.com/docker-for-windows/install/)

#### 2. Verify installation

```bash
$ docker --version
Docker version 19.03.1, build 74b1e89
```

#### 3. Clone this repo & install dependencies

```bash
$ cd <PATH_TO_REPO> && npm install
```

#### 4. Setup enviroment
Run following script to clone & setup repositories (found in docker-compose-yml):
```bash
$ npm run plop setup
```



### Docker CLI
#### Create and start containers (with dev config):
```bash
$ docker-compose -f docker-compose.yml -f docker-compose-develop.yml up
```

#### Stop & remove containers:
```bash
$ docker-compose down
```

#### List containers:
```bash
$ docker ps -a
```

More commands can be found at:
https://docs.docker.com/compose/reference/overview/


### Generators
This project use [Plop](https://plopjs.com/) to manage repositories, docker configs & project files. Logic for each generator can be found in plopfile.js. Generators can be run using (from project directory):

```bash
$ npm run plop <GENERATOR NAME>
```

#### Tip: Install Plop globally
```bash
npm install -g plop
```

Then you can use the following command instead:
```bash
$ plop <GENERATOR NAME>
```