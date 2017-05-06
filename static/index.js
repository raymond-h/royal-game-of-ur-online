const client = deepstream('thingie-deepstream.raymond-h.me').login();

const record = client.record.getRecord('data');

record.subscribe(data => {
	console.log('Got data:', data);
}, true);
