const path = require('path');

const Koa = require('koa');
const mount = require('koa-mount');
const logger = require('koa-logger');
const static = require('koa-static');
const httpProxy = require('http-proxy');

const app = new Koa();

app.use(logger());

app.use(mount('/env', ctx => {
	ctx.body = JSON.stringify(process.env);
}));

const proxy = httpProxy.createProxyServer({
	target: { host: 'localhost', port: '6020' }
});

app.use(mount(
	'/deepstream', ctx => {
		ctx.respond = false;
		proxy.web(ctx.req, ctx.res);
	}
));

app.use(mount('/', static(path.join(__dirname, '../static'))));

const server = app.listen(process.env.PORT);

server.on('upgrade', proxy.ws.bind(proxy));
