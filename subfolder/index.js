const path = require('path');

const Koa = require('koa');
const mount = require('koa-mount');
const static = require('koa-static');
const proxy = require('koa-proxy');

const app = new Koa();

app.use(mount('/static', static(path.join(__dirname, '../static'))));

app.use(mount(
	'/deepstream', proxy({ url: 'http://localhost:6020/deepstream' })
));

app.listen(process.env.PORT);
