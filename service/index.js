const deepstream = require('deepstream.io-client-js');

const client = deepstream('localhost:6020').login();

const record = client.record.getRecord('data');

record.whenReady(() => {
	record.set({ counter: 0, processId: process.pid });

	setInterval(() => {
		record.set('counter', record.get('counter')+1);
	}, 1000);
});
