import game = require('.');
import R = require('ramda');

export function rollLikelihood(roll: number) {
	return [1, 2, 3, 2, 1][roll];
}

function dangerPosedAt(state: game.State, position: number, opponentPosition: number): number {
	const distance = position - opponentPosition;

	return (distance < 0 || distance > 4) ? 0 : rollLikelihood(distance);
}

export function dangerLevelAt(state: game.State, position: number) {
	if(!game.isDangerZone(position) || game.isSafeSpot(position)) {
		return 0;
	}

	const opponentPieces = state
		.players[game.opponentPlayer(state, state.currentPlayer)]
		.fieldedPieces;

	return opponentPieces
		.map(opponentPiece => dangerPosedAt(state, position, opponentPiece.position))
		.reduce(R.add, 0);
}

export function nextMove(state: game.State) {
	const potentialMoves = game.potentialMoves(state);

	console.log(potentialMoves);

	if(potentialMoves.length == 1 && (potentialMoves[0].type == 'pass' || potentialMoves[0].type == 'roll')) {
		return potentialMoves[0];
	}

	// 1: win with a piece
	const winnablePieceMove = potentialMoves.find(move => move.type == 'movePiece' && move.to == 14);
	if(winnablePieceMove) {
		return winnablePieceMove;
	}

	// 2: knock out opponent piece
	const opponentPieces = state.players[game.opponentPlayer(state, state.currentPlayer)].fieldedPieces;

	const knockOutPieceMoves =
		potentialMoves.filter(move =>
			move.type === 'movePiece' && R.any(
				piece => game.isDangerZone(move.to as number) && piece.position == move.to,
				opponentPieces
			)
		);
	if(knockOutPieceMoves.length > 0) {
		// TODO: Make it smarter?
		return knockOutPieceMoves[0];
	}

	// 3: add new piece
	const addPieceMove = potentialMoves.find(move => move.type == 'addPiece');
	if(addPieceMove) {
		return addPieceMove;
	}

	// 4: move to flower
	const rerollMoves =
		potentialMoves.filter(move =>
			move.type === 'movePiece' && game.isRerollSpot(move.to as number)
		);
	if(rerollMoves.length > 0) {
		const bestRerollMove = rerollMoves.reduce(
			R.maxBy<{ type: string, to: number }>(move => move.to)
		);

		return bestRerollMove;
	}

	// 5: move to regular
	const bestRegularMove = potentialMoves
		.filter(move => move.type === 'movePiece')
		.reduce(
			R.maxBy<{ type: string, index: number, to: number }>(move =>
				dangerLevelAt(state, move.to)
			)
		);
}
