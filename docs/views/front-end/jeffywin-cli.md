---
title: jeffywin-cli 脚手架
date: 2020-06-02
sidebar: true
sidebarDepth: 0
tags:
- "开发规范"
- JavaScript Node.js
categories:
- "前端"
isShowComments: false
---


## 自定义脚手架

- 1. 需要用到的库
``` 
    commander: 参数解析 比如 --help 
    inquirer: 交互式命令工具，实现命令行选择
    ora: loading
    download-git-repo: 在git中下载模版
    chalk: 粉笔画出控制台各种颜色
    metalsmith: 读取所有文件，实现模版渲染
    consolidate: 实现统一模版引擎
    ncp: 拷贝文件夹
```
  [commander](https://github.com/tj/commander.js/blob/HEAD/Readme_zh-CN.md)

- 2. 创建bin/www 
``` js
    #! /usr/bin/env node 
    // 用node执行，node在env中
    require('../src/main.js');
```

- 3. npm link命令 =>
jeffywin-cli 命令执行bin中的www文件，并通过sudo npm link去链接这个命令
```json
  "bin": {
    "jeffywin-cli": "./bin/www"
  },
```

- 4. 解析用户命令行输入的参数
``` js

// commander库用来解析用户输入的命令
// program.parse(arguments)会处理参数
const commander = require('commander');
const { version } = require('./constants.js');
commander.version(version).parse(process.argv); // --version 命令 拿到常量文件中的version 返回给用户

// 每个命令单独抽出一个文件，通过匹配action，来require这个同名action文件
   commander
    .command(action) // 命令名称
    .alias(mapActions[action].alias) // 别名
    .description(mapActions[action].description) // 描述
    .action(() => {
        if(action !== '*') {
            // 分配任务 [node, jeffywin-cli, create, xxx] slice(3)拿到create后传的参数
            require(path.resolve(__dirname, action))(...process.argv.slice(3))
        }
    })
```

- mapAction 文件

``` js
const mapActions = {
    create: {
        alias: 'c',
        description: 'create project',
        examples: [
            'jeffywin-cli create <project-name>'
        ]
    },
    config: {
        alias: 'conf',
        description: 'config project variable',
        examples: [
            'jeffywin-cli config set <k><v>',
            'jeffywin-cli config get <k>'
        ]
    },
    '*': {
        alias: '',
        description: 'command not found',
        examples: []
    }
}
module.exports = {
    mapActions
}

```

- 拉取代码思路
  1. 获取项目列表，通过[api.github.com](https://api.github.com/users/jeffywin/repos)
  2. 获取tag分支
  3. 下载代码保存到本地 /Users/xxx/.template
  4. 如果是简单模版，直接ncp复制到当前项目
  5. 复杂模版，检测如果有ask.js文件，拿到用户输入，通过consolidate渲染

``` js
const axios = require('axios');
const ora = require('ora');
const Inquirer = require('inquirer'); // 交互式命令工具，实现命令行选择
const {promisify} = require('util');
const path = require('path');
const fs = require('fs');
let downloadGitRepo = require('download-git-repo');
const Metalsmith = require('metalsmith'); // 遍历文件夹，找需不需要模版引擎
let {render} = require('consolidate').ejs; // 选择ejs模版
render = promisify(render);
const {downloadDirectory} = require('./constants.js');
let ncp = require('ncp');
ncp = promisify(ncp);

downloadGitRepo = promisify(downloadGitRepo); // 转成promise
// 获取项目列表
const featchRepoList = async () => {
    const api = 'https://api.github.com/users/jeffywin/repos';
    const {data} = await axios.get(api)
    return data;
}
const waitLoading = (fn, message) => async (...args) => {
    const spinner = ora(message);
    spinner.start();
    const data = await fn(...args);
    spinner.succeed();
    return data;
}

const fechTagList = async (repo) => {
    const { data } = await axios.get(`https://api.github.com/repos/jeffywin/${repo}/tags`);
    return data;
}
// 模版名字，分支名字
const download = async (repo, tag) => {
    let api = `jeffywin/${repo}`;
    if (tag) {
        api += `#${tag}`;
    }
    // /Users/xxx/模版名字 先下载到本地，再拷贝到当前目录
    const dest = `${downloadDirectory}/${repo}`
    await downloadGitRepo(api, dest); //下载模版到目录
    return dest
}

module.exports = async (projectName) => {
    let repos = await waitLoading(featchRepoList, 'featching template ....')();
    // let repos = await featchRepoList();
    repos = repos.map((item) => item.name);
    const { repo } = await Inquirer.prompt({ // repo vue-simple-template 模版名字
        name: 'repo',
        type: 'list',
        message: '请选择一个模版',
        choices: repos
    })

    // 通过当前项目，拉取对应的模版
    let tags = await waitLoading(fechTagList, 'featching tags ...')(repo);
    tags = tags.map((item) => item.name); // 具体的分支名
    const { tag } = await Inquirer.prompt({ // 选择某一个分支
        name: 'tag',
        type: 'list',
        message: '请选择一个分支',
        choices: tags
    })

    // 拿到最终下载的路径 /Users/xxx/.template/vue-simple-template
    const result = await waitLoading(download, 'downing template...')(repo, tag);
    // const result = await download(repo, tag);
    if (!fs.existsSync(path.resolve(result, 'ask.js'))) {
        // 简单： 拿到现在的目录，把.template下的文件直接拷贝到当前目录下
        await ncp(result, path.resolve(projectName));
    } else {
        // 复杂 需要模版渲染， 渲染后直接拷贝, 如果有ask.js 文件，就是复杂模版
        // 1. 让用户填信息， 2.根据用户的信息渲染模版
       await new Promise((resolve, reject) => {
            Metalsmith(__dirname) // 默认遍历当前文件夹的src目录
            .source(result)
            .destination(path.resolve(projectName)) // 渲染
            .use(async (files, metal, done) => {
                const args = require(path.join(result, 'ask.js'))
                const obj = await Inquirer.prompt(args) // 拿到用户输入的信息
                let meta = metal.metadata(); // 用户输入的结果
                Object.assign(meta, obj); // 把用户输入的信息传递给下一个meta
                delete files['ask.js']
                done()
            })
            .use((files, metal, done) => {
               const metalData = metal.metadata();
               Reflect.ownKeys(files).forEach(async (file) => {
                if (file.includes('js') || file.includes('json')) {
                    let content = files[file].contents.toString(); // 文件内容
                    if (content.includes('<%')) {
                        content = await render(content, metalData); // 用对象渲染模版
                        files[file].contents = Buffer.from(content);
                    }
                }
               })
               done()
            })
            .build((err, files) => {
                if (err) {
                    reject()
                } else {
                    resolve()
                }
            })
       })
    }   
  
   
}
```