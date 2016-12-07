/**
 * 从js入口中提取所有的scss/css依赖并去重合并
 * @author jiao.shen
 */
'use strict';
var fs = require('fs');
var Path = require('path');
var rimport = /@?import.*(?:(['"])([^'"]+)\1|url\((['"]?)([^)'"]+)\3\))/;
var rrequire = /require(?:\.async)?\s*\((['"])([^'")]+)\1\)/;
var rignore = /react|react-dom|yo-router|hysdk|babel-polyfill/;
var rscsspackage = /yo3|@qnpm\/yo/;
var rpossibleScssFileName = /([^\/]+\.scss)$/;
var rsinglelineComment = /\/\/.*(?:[\n\r]|$)/g;
var rmultilineComment = /\/\s*\*(?:(?!(\*\s*\/)).|[\n\r])*(?:\*\s*\/)/g;

function isIgnored(abspath, rscsspackage) {
    return abspath && abspath.match(/node_modules/) && !abspath.match(rscsspackage);
}

function getScssDependencies(entrance, resolve, context, scsspackage) {
    if (!scsspackage) {
        scsspackage = rscsspackage;
    }
    var entranceExist = fs.existsSync(entrance);
    if (entranceExist) {
        var content = fs.readFileSync(entrance, 'utf8')
            .replace(rsinglelineComment, '')
            .replace(rmultilineComment, '');
        var allLines = content.split(/[\n\r;]+/);
        var scssDeps = [];

        allLines.forEach(function (line) {
            var mimport = line.match(rimport);
            if (!mimport) {
                mimport = line.match(rrequire);
            }

            if (mimport) {
                var importPath = mimport[2] || mimport[4];
                var absImportPath = getAbsImportPath(entrance, importPath, resolve, context);
                if (!isIgnored(absImportPath, scsspackage)) {
                    // 如果是scss, 直接push
                    if (isScssFile(absImportPath)) {
                        // 尝试匹配以下划线开头的文件名
                        // scss是有病吗...
                        var alterEntrance = Path.extname(absImportPath) !== '.css' ? absImportPath.replace(rpossibleScssFileName, '_$1') : null;
                        if (alterEntrance && fs.existsSync(absImportPath) && fs.existsSync(alterEntrance)) {
                            throw new Error('[ykit-config-fekit]: 编译文件' + absImportPath + '失败，存在文件名冲突（请检查该文件目录下是否存在文件名加了下划线的同名文件）。');
                        }

                        if (!fs.existsSync(absImportPath) && fs.existsSync(alterEntrance)) {
                            absImportPath = alterEntrance;
                        }

                        scssDeps = scssDeps.concat(getScssDependencies(absImportPath, resolve, context, scsspackage));
                        scssDeps.push(absImportPath)
                    } else { // 否则递归查找js依赖中的scss依赖
                        scssDeps = scssDeps.concat(getScssDependencies(absImportPath, resolve, context, scsspackage));
                    }
                }
            }
        });

        return scssDeps;
    }
    return [];
}

function getAbsImportPath(entrance, importPath, resolve, context) {
    if (importPath.charAt(0) === '~') {
        importPath = Path.resolve(context, 'node_modules', importPath.slice(1));
    }
    var ret = importPath;
    // 替换alias, 只替换业务代码中的别名
    var alias = resolve.alias || {};
    var aliasMatched = Object.keys(alias).filter(function (key) {
        return importPath.split('/').some(function (dirname) {
            return dirname === key;
        });
    });
    var aliasFound = aliasMatched ? aliasMatched[0] : null;
    var aliasContent = alias[aliasFound];
    var isBizFolder = entrance.search('node_modules') === -1;

    if (aliasFound && isBizFolder) {
        importPath = importPath.replace(aliasFound, aliasContent);
    }
    // 优先尝试node_modules
    var nodeModule = tryLoadNodeModules(context, importPath);
    if (nodeModule) {
        ret = nodeModule;
    } else { // 最后尝试普通module
        ret = Path.resolve(Path.dirname(entrance), importPath);
        // 如果ret不存在，看看是不是fekit_modules里面的css
        if (Path.extname(entrance).match(/css/)) {
            if (!Path.isAbsolute(importPath) && !fs.existsSync(ret)) {
                var fekitPath = Path.resolve(context, 'fekit_modules');
                if (fs.existsSync(fekitPath)) {
                    var alternative = Path.resolve(fekitPath, importPath, 'src', 'index.css');
                    if (fs.existsSync(alternative)) {
                        ret = alternative;
                    }
                }
            }
        }
    }

    return tryEveryExtname(ret);
}

function tryLoadNodeModules(context, dirname) {
    dirname = Path.resolve(context, 'node_modules', dirname);
    var packageJsonPath = Path.resolve(dirname, 'package.json');
    try {
        var main = 'index.js';
        // 如果找到了package.json,说明是一个npm的包
        if (fs.existsSync(packageJsonPath)) {
            var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            // 获取包的入口,默认是index.js
            main = packageJson.main || 'index.js';
            var ret = tryEveryExtname(Path.resolve(dirname, main));
            if (ret && fs.existsSync(ret)) {
                return ret;
            }
        } else { // 反之,是npm包内部的一个文件
            ret = tryEveryExtname(Path.resolve(dirname));
            if (ret && fs.existsSync(ret)) {
                return ret;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

function tryEveryExtname(path) {
    var extnames = [
        '.js',
        '.scss',
        '.css',
        '/index.js',
        '/index.scss',
        '/index.css',
        'index.js',
        'index.scss',
        'index.css'
    ];
    var existedExt = Path.extname(path);
    if (existedExt) {
        return path;
    }

    for (var i = 0; i < extnames.length; i++) {
        var extToBeAppend = extnames[i];
        var renderedPath = path + extToBeAppend;
        if (fs.existsSync(renderedPath)) {
            return renderedPath;
        }
    }

    return null;
}

function isScssFile(absPath) {
    // 居然有一种奇葩的写法是require('./'),这里会抛异常
    try {
        return Path.extname(absPath) === '.scss' || Path.extname(absPath) === '.css';
    } catch (e) {
        return false;
    }
}

function group(arr) {
    var ret = [];
    for (var i = 0; i < arr.length; i++) {
        if (ret.indexOf(arr[i]) === -1) {
            ret.push(arr[i]);
        }
    }
    return ret;
}

function extractAllScssDependencies(entrance, resolve, context, ignore) {
    return group(getScssDependencies(entrance, resolve, context, ignore));
}

function removeRedundantCode(importList) {
    var ret = '';
    var deps = [];
    importList.split(/[\n\r;]/).forEach(function (importStmt) {
        var rimp = /@import\s+(['"])([^'"]+)\1;?/;
        var m = importStmt.match(rimp);
        if (m) {
            var dep = m[2];
            deps.push(dep);
            var content = fs.readFileSync(dep, 'utf8');
            ret += content
                .replace(/@import\s+(['"])[^'"]+\1;?/g, '')
                .replace(/@charset\s+(['"])[^'"]+\1;?/g, '')
        }
    });
    return { code: ret, deps: deps };
}

function combine(entrance, resolve, context, ignore) {
    var ret = '';
    var deps = extractAllScssDependencies(entrance, resolve, context, ignore);
    if (Path.extname(entrance).match(/scss|css/) && deps.indexOf(entrance) === -1) {
        deps.push(entrance);
    }
    deps.forEach(function (dep) {
        var content = fs.readFileSync(dep, 'utf8');
        ret += content
            .replace(/@import\s+(?:url)?(?:(['"])[^'"]+\1;?|\([^)]+\));?/g, '')
            .replace(/require\s*\([^)]+\);?/g, '')
            .replace(/@charset\s+(['"])[^'"]+\1;?/g, '');
    });
    var isCss = deps.reduce(function (ret, dep) {
        if (dep.match(/\.scss$/)) {
            ret = false;
        }
        return ret;
    }, true);

    return { code: ret, deps: deps, isCss: isCss };
}

module.exports = combine;
module.exports.removeRedundantCode = removeRedundantCode;