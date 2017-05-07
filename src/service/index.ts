import deepstream = require('deepstream.io-client-js');

const client = deepstream('thingie-deepstream.raymond-h.me').login();

const record = client.record.getRecord('data');

record.whenReady(() => {
	record.set({ counter: 0 });

	setInterval(() => {
		record.set('counter', record.get('counter')+1);
		record.set('processId', process.pid);
	}, 1000);
});
