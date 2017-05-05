const client = deepstream(location.host).login();

const record = client.record.getRecord('data');

record.subscribe(data => {
	console.log('Got data:', data);
}, true);
