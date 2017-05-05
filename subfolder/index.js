const Koa = require('koa');
const Router = require('koa-router');
const static = require('koa-static');
const proxy = require('koa-proxy');

const app = new Koa();

const router = new Router();

router.use('/static', static('./static'));

// router.get('/deepstream', proxy({
// 	url: 'http://localhost:6020/deepstream'
// }));

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(process.env.PORT);
