import deepstream = require('deepstream.io-client-js');
import game = require('../game');

let clientData;

const client = deepstream(process.env.DEEPSTREAM_URL).login({
	internalService: true,
	internalToken: process.env.INTERNAL_SERVICE_TOKEN
}, (success, data) => {
	clientData = data;
});

client.rpc.provide('newGame', (data, res) => {
	const gameId = client.getUid();

	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.set(game.initialState);

	stateRecord.discard();

	res.send({ gameId });
});

client.rpc.provide('performAction', ({ gameId, action }, res) => {
	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.whenReady(() => {
		const state = stateRecord.get();

		try {
			const newState = game.reducer(state, action);

			stateRecord.set(newState);
			res.send('ok');
		}
		catch(e) {
			console.error(e.stack);
			res.error(e.message);
		}
		finally {
			stateRecord.discard();
		}
	});
});
