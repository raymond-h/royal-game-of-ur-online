const path = require('path');

const Koa = require('koa');
const mount = require('koa-mount');
const logger = require('koa-logger');
const static = require('koa-static');
const httpProxy = require('http-proxy');

const deepstream = require('deepstream.io-client-js');

const app = new Koa();

app.use(logger());

app.use(mount(
	'/deepstream', ctx => {
		ctx.respond = false;
		proxy.web(ctx.req, ctx.res);
	}
));

app.use(mount('/', static(path.join(__dirname, '../static'))));

const server = app.listen(process.env.PORT);

const proxy = httpProxy.createProxyServer({
	target: { host: 'localhost', port: '6020' }
});

server.on('upgrade', proxy.ws.bind(proxy));

const client = deepstream('localhost:6020').login();

const record = client.record.getRecord('data');

record.whenReady(() => {
	record.set({ counter: 0 });

	setInterval(() => {
		record.set('counter', record.get('counter')+1);
	}, 1000);
});
