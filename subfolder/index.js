const http = require('http');

http.createServer((req, res) => {
	res.end('What the dude!!!');
})
.listen(process.env.PORT);
