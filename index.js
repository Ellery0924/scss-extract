'use strict';
const fs = require('fs');
const Path = require('path');
const rimport = /^import.*(['"])([^'"]+)\1/;
const rrequire = /require\s*\((['"])([^'"]+)\1\)/;
const rignore = /react|react-dom|yo-router|hysdk/;

function getScssDependencies(entrance, resolve, context) {
    if (fs.existsSync(entrance)) {
        const allLines = fs.readFileSync(entrance, 'utf8').split(/[\n\r]+/);
        let scssDeps = [];

        allLines.forEach((line)=> {
            let mimport = line.match(rimport);
            if (!mimport) {
                mimport = line.match(rrequire);
            }

            if (mimport) {
                const importPath = mimport[2];
                if (importPath.match(rignore) === null) {
                    const absImportPath = getAbsImportPath(entrance, importPath, resolve, context);
                    if (isScssFile(absImportPath)) {
                        scssDeps.push(absImportPath);
                    } else {
                        scssDeps = scssDeps.concat(getScssDependencies(absImportPath, resolve, context));
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
    let ret = importPath;

    // 替换alias, 只替换业务代码中的别名
    const alias = resolve.alias;
    const aliasFound = Object.keys(alias).find(key=> {
        return importPath.split('/').some(dirname=> {
            return dirname === key;
        });
    });
    const aliasContent = alias[aliasFound];
    const isBizFolder = entrance.search('node_modules') === -1;

    if (aliasFound && isBizFolder) {
        if (Path.isAbsolute(aliasContent)) {
            importPath = importPath.replace(aliasFound, Path.join(context, aliasContent));
        } else {
            importPath = importPath.replace(aliasFound, aliasContent);
        }
    }
    //优先尝试node_modules
    const nodeModule = tryLoadNodeModules(context, importPath);
    if (nodeModule) {
        ret = nodeModule;
    } else { // 最后尝试普通module
        ret = Path.resolve(Path.dirname(entrance), importPath);
    }

    return tryEveryExtname(ret);
}

function tryLoadNodeModules(context, dirname) {
    dirname = Path.resolve(context, 'node_modules', dirname);
    const packageJsonPath = Path.resolve(dirname, 'package.json');
    try {
        let main = 'index.js';
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            main = packageJson.main || 'index.js';
            const ret = tryEveryExtname(Path.resolve(dirname, main));
            if (ret && fs.existsSync(ret)) {
                return ret;
            }
        } else {
            const ret = tryEveryExtname(Path.resolve(dirname));
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
    const extnames = ['.js', '.scss', '/index.js', '/index.scss', 'index.js', 'index.scss'];
    const existedExt = Path.extname(path);
    if (existedExt) {
        return path;
    }

    for (let i = 0; i < extnames.length; i++) {
        const extToBeAppend = extnames[i];
        const renderedPath = path + extToBeAppend;
        if (fs.existsSync(renderedPath)) {
            return renderedPath;
        }
    }

    return null;
}

function isScssFile(absPath) {
    const ext = Path.extname(absPath);
    if (ext === '.scss') {
        return true;
    }
    return false;
}

function group(arr) {
    let ret = [];
    for (let i = 0; i < arr.length; i++) {
        if (ret.indexOf(arr[i]) === -1) {
            ret.push(arr[i]);
        }
    }
    return ret;
}

function extractAllScssDependencies(entrance, resolve, context) {
    return group(getScssDependencies(entrance, resolve, context));
}

module.exports = extractAllScssDependencies;