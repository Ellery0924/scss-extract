## 简介

scss-extract是一个工具函数, 可以通过一个入口js递归地查找js内部引用的scss文件,
并按引用的顺序输出一个scss路径(绝对路径)列表。

## 安装

```
npm install --save @qnpm/scss-extract
```

## 使用

```
var Path = require('path');
var scssExtract = require('scss-extract');
// cwd, 一般为工程根路径
var cwd = process.cwd();
// 入口js, 必须是绝对路径
var entrance = Path.resolve(cwd, './src/page/approval/index.js');
// resolve, webpack.config.resolve对象 目前只支持alias
var resolve = {
     alias: {
        'Component': '/src/component',
        'Const': '/src/const',
        'Util': '/src/lib/util',
        'YoComponent': '@qnpm/yo/component',
        'Router': '/src/router',
        'Flux': '/src/lib/'
     }
};

console.log(scssExtract(entrance, resolve, cwd));

```

## 输出示例

```
[ '/Users/Ellery1/Documents/qunarzz2.com/psapproval/src/page/approval/detail/index.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/touchable/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/scroller/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/src/component/page/index.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/src/component/error/index.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/toast/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/loading/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/alert/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/confirm/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/datetimepicker/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/picker/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/popup/src/style.scss',
  '/Users/Ellery1/Documents/qunarzz2.com/psapproval/node_modules/@qnpm/yo/component/modal/src/style.scss' ]

```