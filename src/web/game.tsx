import React = require('react');

function positionTo2dPosition(position: number, player: number) {
	const y = (player === 0) ? 1 : -1;

	if(position < 4) { return { x: 3 - position, y: y }; }
	if(position >= 4 && position <= 11) { return { x: position - 4, y: 0 }; }
	if(position > 11) { return { x: 19 - position, y: y }; }

	return null;
}

function screenCoords(position: number, player: number) {
	const coords = positionTo2dPosition(position, player);

	if(coords == null) return null;

	const { x, y } = coords;

	return { x: 74*x + 40, y: 74*(y+1) + 51 };
}

export function Game({ state, onAction }) {
	if(state == null) { return <p>No game here, create a new one or something!</p>; }

	const pieceMapper = player => (piece, index) => {
		const coords = screenCoords(piece.position, player);

		if(coords == null) return null;

		const { x, y } = coords;

		return <div
			className={['piece', `player-${player+1}`].join(' ')}
			style={{ top: y, left: x }}
			onClick={() => onAction({ type: 'movePiece', index })}>
			{index}
		</div>;
	};

	const player1 = state.players[0];
	const player2 = state.players[1];

	const player1Pieces = player1.fieldedPieces.map(pieceMapper(0));
	const player2Pieces = player2.fieldedPieces.map(pieceMapper(1));

	const onRoll = () =>
		onAction({ type: 'setDiceRolls', roll: Math.floor(Math.random() * 5) });

	return <div>
		<div className='board'>
			{player1Pieces}
			{player2Pieces}
		</div>
		<h1>Player #{state.currentPlayer+1}'s turn!!</h1>
		<p>PLAYER #1 (won pieces: {player1.wonPieces}) (remaining pieces: {player1.outOfPlayPieces})</p>
		<p>PLAYER #2 (won pieces: {player2.wonPieces}) (remaining pieces: {player2.outOfPlayPieces})</p>
		<button onClick={onRoll}>Roll</button>
		<button onClick={() => onAction({ type: 'addPiece' })}>Add piece</button>
		<button onClick={() => onAction({ type: 'pass' })}>Pass</button>
		<p>Last dice roll: {state.lastRoll}</p>
	</div>;
}
