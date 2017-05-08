import deepstream = require('deepstream.io-client-js');
import game = require('../game');

const client = deepstream('thingie-deepstream.raymond-h.me').login();

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
