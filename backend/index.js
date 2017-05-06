const path = require('path');

const Koa = require('koa');
const mount = require('koa-mount');
const logger = require('koa-logger');
const static = require('koa-static');

const app = new Koa();

app.use(logger());

app.use(mount('/env', ctx => {
	ctx.body = JSON.stringify(process.env);
}));

app.use(mount('/', static(path.join(__dirname, '../static'))));

app.listen(process.env.PORT);
